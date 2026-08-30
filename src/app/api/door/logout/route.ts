import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { DOOR_SESSION_COOKIE } from "@/server/admin-auth";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(DOOR_SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
