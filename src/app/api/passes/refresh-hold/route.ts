import { NextResponse } from "next/server";

import { fieldErrors, refreshHoldSchema } from "@/lib/validation";
import { clientKey, rateLimit } from "@/server/rate-limit";
import {
  flushStoreForHttp,
  getOrderByReference,
  hydrateStore,
  repriceReservation,
  verifyToken,
} from "@/server/store";
import { renderUpiPayment } from "@/server/upi-qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Re-issue the UPI QR for a hold the buyer is still looking at. Checkout polls
 * this so a price change in the CMS reaches an open pay screen instead of
 * leaving a QR that collects the old amount.
 */
export async function POST(request: Request) {
  await hydrateStore();
  const limited = rateLimit(clientKey(request, "refresh-hold"), 60, 10 * 60 * 1000);
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
  if (order.status === "expired") {
    return NextResponse.json(
      { error: "This hold ran out. Start again, or send us the UTR if you already paid." },
      { status: 409 },
    );
  }
  if (order.status !== "reserved") {
    return NextResponse.json(
      { error: "This order is already decided. Check your email for the pass." },
      { status: 409 },
    );
  }

  const repriced = repriceReservation(order);
  const payment = await renderUpiPayment(order.total, `UTOPIA ${order.reference}`);
  if (repriced) {
    const saved = await flushStoreForHttp();
    if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    reference: order.reference,
    total: order.total,
    holdExpiresAt: order.holdExpiresAt,
    repriced,
    vpa: payment.vpa,
    payeeName: payment.payeeName,
    upiUri: payment.upiUri,
    upiQr: payment.upiQr,
  });
}
