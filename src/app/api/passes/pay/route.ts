import { NextResponse } from "next/server";

import { fieldErrors, payProofSchema } from "@/lib/validation";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { upsertPassWallet } from "@/server/pass-wallet";
import { attachPaymentProof, hydrateStore, verifyToken } from "@/server/store";

export const runtime = "nodejs";

/** Buyer says they paid. Requires a 12-digit UTR and screenshot; order stays reserved until CMS approval. */
export async function POST(request: Request) {
  await hydrateStore();
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

  const { email, reference, verificationToken, utr, proofName, proofMime, proofData } =
    parsed.data;

  if (!verifyToken(verificationToken, email)) {
    return NextResponse.json(
      { error: "That email verification expired. Verify again." },
      { status: 401 },
    );
  }

  const result = attachPaymentProof(reference, email, {
    utr,
    proofName,
    proofMime,
    proofData,
  });
  if (!result.ok) {
    if (result.reason === "already-decided") {
      return NextResponse.json(
        { error: "This order is already decided. Check your email for the pass." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "We couldn't find that reservation." }, { status: 404 });
  }

  await upsertPassWallet(email, result.order);

  return NextResponse.json({
    ok: true,
    reference: result.order.reference,
    status: result.order.status,
  });
}
