import { NextResponse } from "next/server";

import { EVENT } from "@/lib/event";
import { getPassById } from "@/lib/passes";
import { priceOrder } from "@/lib/pricing";
import { fieldErrors, reserveSchema } from "@/lib/validation";
import { sendOrderConfirmation } from "@/server/mailer";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { createOrder, verifyToken } from "@/server/store";

export const runtime = "nodejs";

/**
 * Step 3: create the reservation. Prices are recomputed server-side, so a
 * tampered client payload can't change what gets charged later.
 */
export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "reserve"), 20, 10 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many orders from this connection. Slow down." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = reserveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const { name, email, phone, passId, quantity, verificationToken } = parsed.data;

  if (!verifyToken(verificationToken, email)) {
    return NextResponse.json(
      { error: "That email verification expired. Verify again." },
      { status: 401 },
    );
  }

  const pass = getPassById(passId);
  const totals = priceOrder(passId, quantity);

  const order = createOrder(
    {
      passId,
      quantity,
      unitPrice: totals.unitPrice,
      subtotal: totals.subtotal,
      fee: totals.fee,
      total: totals.total,
      buyer: { name, email, phone },
    },
    EVENT.holdMinutes,
  );

  // A failed receipt shouldn't lose a reservation we already recorded.
  try {
    await sendOrderConfirmation(order, pass.name);
  } catch (error) {
    console.error("[utopia] confirmation email failed", error);
  }

  return NextResponse.json({
    ok: true,
    reference: order.reference,
    total: order.total,
    holdExpiresAt: order.holdExpiresAt,
  });
}
