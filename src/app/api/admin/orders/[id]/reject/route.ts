import { NextResponse } from "next/server";

import { getPassById } from "@/lib/passes";
import { fieldErrors, rejectOrderSchema } from "@/lib/validation";
import { getAdminSession } from "@/server/admin-session";
import { sendPassRejected } from "@/server/mailer";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { flushStore, hydrateStore, rejectOrder } from "@/server/store";

export const runtime = "nodejs";

/** Manual stand-in for a payment-gateway webhook's failure callback. */
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

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = rejectOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That reason is too long.", fields: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const { id } = await params;
  const result = rejectOrder(id, parsed.data.reason, session.username);

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
    const pass = getPassById(result.order.passId);
    await sendPassRejected(result.order, pass.name, parsed.data.reason);
  } catch (error) {
    console.error("[utopia] rejection email failed", error);
  }

  await flushStore();
  return NextResponse.json({ ok: true, order: result.order });
}
