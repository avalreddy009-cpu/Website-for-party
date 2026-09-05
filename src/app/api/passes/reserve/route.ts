import { NextResponse } from "next/server";

import { cartFromUnknown } from "@/lib/cart";
import { EVENT } from "@/lib/event";
import { priceCart } from "@/lib/pricing";
import { fieldErrors, reserveSchema } from "@/lib/validation";
import { sendOrderConfirmation } from "@/server/mailer";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { upsertPassWallet } from "@/server/pass-wallet";
import {
  canReserveWithToken,
  createOrder,
  flushStoreForHttp,
  getPassPrice,
  hydrateStore,
  markEmailReserved,
} from "@/server/store";
import { getUpiConfig } from "@/server/upi";
import { renderUpiPayment } from "@/server/upi-qr";

export const runtime = "nodejs";

/**
 * Create the reservation. Prices are recomputed server-side, so a tampered
 * client payload can't change what gets charged. UPI details are generated
 * here too — the QR the browser shows is this server's QR, not one it invented.
 */
export async function POST(request: Request) {
  await hydrateStore();
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

  const { name, email, phone, verificationToken } = parsed.data;
  const cart = cartFromUnknown(parsed.data);

  if (!canReserveWithToken(verificationToken, email)) {
    return NextResponse.json(
      { error: "Verify your email again to book." },
      { status: 401 },
    );
  }

  const prices = { early: getPassPrice("early"), vip: getPassPrice("vip") };
  const totals = priceCart(cart, prices);
  const upi = getUpiConfig();

  if (!upi.configured) {
    return NextResponse.json(
      { error: "UPI isn't set up on this deployment yet. Email us the reservation and we'll take it offline." },
      { status: 503 },
    );
  }

  const order = createOrder(
    {
      passId: totals.passId,
      quantity: totals.quantity,
      unitPrice: totals.unitPrice,
      subtotal: totals.subtotal,
      fee: totals.fee,
      total: totals.total,
      buyer: { name, email, phone },
      lines: totals.lines,
    },
    EVENT.holdMinutes,
  );

  const payment = await renderUpiPayment(order.total, order.reference);

  try {
    await sendOrderConfirmation(order);
  } catch (error) {
    console.error("[utopia] confirmation email failed", error);
  }

  await upsertPassWallet(email, order);
  markEmailReserved(email);
  const saved = await flushStoreForHttp();
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 503 });

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    reference: order.reference,
    total: order.total,
    holdExpiresAt: order.holdExpiresAt,
    vpa: payment.vpa,
    payeeName: payment.payeeName,
    upiUri: payment.upiUri,
    upiQr: payment.upiQr,
  });
}
