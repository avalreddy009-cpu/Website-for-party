import { NextResponse } from "next/server";

import { getDoorSession } from "@/server/admin-session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getDoorSession();
  return NextResponse.json({
    authenticated: Boolean(session),
    role: session ? "door" : null,
  });
}
