import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { BUYER_SESSION_COOKIE } from "@/server/admin-auth";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(BUYER_SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
