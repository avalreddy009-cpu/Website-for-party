import { NextResponse } from "next/server";

import { orderIdSchema } from "@/lib/validation";
import { getAdminSession } from "@/server/admin-session";
import { sendPassApproved } from "@/server/mailer";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { approveOrder, flushStoreForHttp, hydrateStore, toStaffOrder } from "@/server/store";

export const runtime = "nodejs";

/**
 * Manual stand-in for a payment-gateway webhook's success callback. Wire the
 * real webhook to `approveOrder()` directly when the PG is added — it can
 * skip this HTTP hop and this route stays as the human override.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await hydrateStore();
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const limited = rateLimit(clientKey(request, "admin-decision"), 60, 10 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Slow down a little." }, { status: 429 });
  }

  const { id } = await params;
  const parsedId = orderIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "That order doesn't exist." }, { status: 404 });
  }

  const result = approveOrder(parsedId.data, session.username);

  if (!result.ok) {
    if (result.reason === "not-found") {
      return NextResponse.json({ error: "That order doesn't exist." }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Already decided — refresh the list." },
      { status: 409 },
    );
  }

  try {
    await sendPassApproved(result.order);
  } catch (error) {
    console.error("[utopia] approval email failed", error);
  }

  const saved = await flushStoreForHttp();
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 503 });
  return NextResponse.json({ ok: true, order: toStaffOrder(result.order) });
}
