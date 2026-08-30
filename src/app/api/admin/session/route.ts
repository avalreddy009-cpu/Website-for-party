import { NextResponse } from "next/server";

import { getAdminSession } from "@/server/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Polled by nothing public — CMS session only. Header LOGIN uses /api/account/session. */
export async function GET() {
  const session = await getAdminSession();
  return NextResponse.json({
    authenticated: Boolean(session),
    username: session?.username ?? null,
  });
}
