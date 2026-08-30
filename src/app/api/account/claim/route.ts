import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { BUYER_SESSION_COOKIE } from "@/server/admin-auth";
import { upsertPassWallet } from "@/server/pass-wallet";
import { hydrateStore, importWalletPass, signBuyerSession, verifyPassClaim } from "@/server/store";
import { getBuyerSession } from "@/server/admin-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await hydrateStore();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const token = typeof body === "object" && body && "token" in body ? String(body.token) : "";
  const claim = verifyPassClaim(token);
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
  await upsertPassWallet(claim.email, order);

  if (!session) {
    const cookieStore = await cookies();
    cookieStore.set(BUYER_SESSION_COOKIE, signBuyerSession(claim.email), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 12 * 60 * 60,
    });
  }

  return NextResponse.json({ ok: true, email: claim.email, reference: order.reference });
}
