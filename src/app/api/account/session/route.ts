import { NextResponse } from "next/server";

import { getBuyerSession } from "@/server/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getBuyerSession();
  return NextResponse.json({
    authenticated: Boolean(session),
    email: session?.email ?? null,
  });
}
