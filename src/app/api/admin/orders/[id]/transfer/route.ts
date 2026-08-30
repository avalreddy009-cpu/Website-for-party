import { NextResponse } from "next/server";

import { getPassById } from "@/lib/passes";
import { fieldErrors, orderIdSchema, transferOrderSchema } from "@/lib/validation";
import { getAdminSession } from "@/server/admin-session";
import { sendPassApproved, sendPassTransferredAway } from "@/server/mailer";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { flushStore, hydrateStore, transferOrder } from "@/server/store";

export const runtime = "nodejs";

/**
 * Staff-only remint. Guests cannot hit this route. Old QR / door code die
 * here; the new inbox gets a fresh pass email.
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

  const limited = rateLimit(clientKey(request, "admin-transfer"), 30, 10 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Slow down a little." }, { status: 429 });
  }

  const { id: rawId } = await params;
  const idParsed = orderIdSchema.safeParse(rawId);
  if (!idParsed.success) {
    return NextResponse.json({ error: "That order doesn't exist." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = transferOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the new name, email, and phone.", fields: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const result = transferOrder(idParsed.data, parsed.data, session.username);

  if (!result.ok) {
    if (result.reason === "not-found") {
      return NextResponse.json({ error: "That order doesn't exist." }, { status: 404 });
    }
    if (result.reason === "not-paid") {
      return NextResponse.json(
        { error: "Approve the pass before you transfer it." },
        { status: 409 },
      );
    }
    if (result.reason === "already-entered") {
      return NextResponse.json(
        { error: "Already scanned at the door — can't transfer." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "That's already the name on this pass." },
      { status: 409 },
    );
  }

  const pass = getPassById(result.order.passId);

  try {
    if (result.previousBuyer.email !== result.order.buyer.email) {
      await sendPassTransferredAway(result.previousBuyer, result.order.reference, pass.name);
    }
  } catch (error) {
    console.error("[utopia] transfer notice to previous owner failed", error);
  }

  try {
    await sendPassApproved(result.order, pass.name);
  } catch (error) {
    console.error("[utopia] transfer pass email failed", error);
  }

  await flushStore();
  return NextResponse.json({ ok: true, order: result.order });
}
