import { NextResponse } from "next/server";

import { fieldErrors, payProofSchema } from "@/lib/validation";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { attachPaymentProof, verifyToken } from "@/server/store";

export const runtime = "nodejs";

/** Buyer says they paid. We record the UTR; the order stays reserved until CMS approval. */
export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "pay-proof"), 20, 10 * 60 * 1000);
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

  const parsed = payProofSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the UTR and try again.", fields: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const { email, reference, verificationToken, utr } = parsed.data;

  if (!verifyToken(verificationToken, email)) {
    return NextResponse.json(
      { error: "That email verification expired. Verify again." },
      { status: 401 },
    );
  }

  const result = attachPaymentProof(reference, email, utr);
  if (!result.ok) {
    if (result.reason === "already-decided") {
      return NextResponse.json(
        { error: "This order is already decided. Check your email for the pass." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "We couldn't find that reservation." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    reference: result.order.reference,
    status: result.order.status,
  });
}
