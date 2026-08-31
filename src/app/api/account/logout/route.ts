import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { BUYER_SESSION_COOKIE, PASS_WALLET_COOKIE } from "@/server/admin-auth";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(BUYER_SESSION_COOKIE);
  cookieStore.delete(PASS_WALLET_COOKIE);
  return NextResponse.json({ ok: true });
}
