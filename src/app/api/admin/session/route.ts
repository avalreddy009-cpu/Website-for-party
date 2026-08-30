import { NextResponse } from "next/server";

import { getAdminSession } from "@/server/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Polled by the header to decide between "LOGIN" and "DASHBOARD". */
export async function GET() {
  const session = await getAdminSession();
  return NextResponse.json({
    authenticated: Boolean(session),
    username: session?.username ?? null,
  });
}
