import { NextResponse } from "next/server";

import { fieldErrors, refreshHoldSchema } from "@/lib/validation";
import { clientKey, rateLimit } from "@/server/rate-limit";
import {
  applyLivePricesToReservation,
  flushStore,
  getOrderByReference,
  hydrateStore,
  verifyToken,
} from "@/server/store";
import { renderUpiPayment } from "@/server/upi-qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rebuild the checkout UPI QR from live CMS prices while the hold is still unpaid. */
export async function POST(request: Request) {
  await hydrateStore();
  const limited = rateLimit(clientKey(request, "refresh-hold"), 30, 10 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Slow down." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = refreshHoldSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "We couldn't refresh that payment.", fields: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const { email, reference, verificationToken } = parsed.data;
  if (!verifyToken(verificationToken, email)) {
    return NextResponse.json(
      { error: "That email verification expired. Verify again." },
      { status: 401 },
    );
  }

  const order = getOrderByReference(reference);
  if (!order || order.buyer.email !== email) {
    return NextResponse.json({ error: "We couldn't find that reservation." }, { status: 404 });
  }
  if (order.status !== "reserved") {
    return NextResponse.json(
      { error: "This order is already decided. Check your email for the pass." },
      { status: 409 },
    );
  }

  applyLivePricesToReservation(order);
  const payment = await renderUpiPayment(order.total, `UTOPIA ${order.reference}`);
  await flushStore();

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
