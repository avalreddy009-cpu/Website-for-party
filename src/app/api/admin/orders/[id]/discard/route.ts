import { NextResponse } from "next/server";

import { orderIdSchema } from "@/lib/validation";
import { getAdminSession } from "@/server/admin-session";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { discardOpenHold, flushStoreForHttp, hydrateStore } from "@/server/store";

export const runtime = "nodejs";

/** Drop an unpaid hold that never sent money. Does not touch paid passes. */
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

  const result = discardOpenHold(parsedId.data);
  if (!result.ok) {
    if (result.reason === "not-found") {
      return NextResponse.json({ error: "That order doesn't exist." }, { status: 404 });
    }
    return NextResponse.json(
      { error: "That hold already has payment on it — reject it instead of dropping it." },
      { status: 409 },
    );
  }

  const saved = await flushStoreForHttp();
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 503 });
  return NextResponse.json({ ok: true, id: parsedId.data, reference: result.order.reference });
}
