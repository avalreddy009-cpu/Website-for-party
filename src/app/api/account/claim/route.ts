import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { passClaimTokenSchema } from "@/lib/validation";
import { BUYER_SESSION_COOKIE, cookieSecure } from "@/server/admin-auth";
import { upsertPassWallet } from "@/server/pass-wallet";
import { flushStoreForHttp, hydrateStore, importWalletPass, signBuyerSession, verifyPassClaim } from "@/server/store";
import { getBuyerSession } from "@/server/admin-session";
import { clientKey, rateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await hydrateStore();

  const limited = rateLimit(clientKey(request, "account-claim"), 12, 10 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Slow down a little." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const token = passClaimTokenSchema.safeParse(
    typeof body === "object" && body && "token" in body ? body.token : undefined,
  );
  const claim = token.success ? verifyPassClaim(token.data) : null;
  if (!claim) {
    return NextResponse.json({ error: "That pass link is invalid or expired." }, { status: 400 });
  }

  const session = await getBuyerSession();
  if (session && session.email !== claim.email) {
    return NextResponse.json(
      { error: "You're signed in as a different email. Sign out and open the link again." },
      { status: 403 },
    );
  }

  const order = importWalletPass(claim);
  if (!order) {
    return NextResponse.json(
      { error: "That pass was moved. Ask AVION for the new email." },
      { status: 410 },
    );
  }
  await upsertPassWallet(claim.email, order);

  if (!session) {
    const cookieStore = await cookies();
    cookieStore.set(BUYER_SESSION_COOKIE, signBuyerSession(claim.email), {
      httpOnly: true,
      secure: cookieSecure(),
      sameSite: "lax",
      path: "/",
      maxAge: 12 * 60 * 60,
    });
  }

  const saved = await flushStoreForHttp();
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 503 });
  return NextResponse.json({ ok: true, email: claim.email, reference: order.reference });
}
