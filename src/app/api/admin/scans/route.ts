import { NextResponse } from "next/server";

import { getAdminSession } from "@/server/admin-session";
import { hydrateStore, listScans } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await hydrateStore();
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  return NextResponse.json({ scans: listScans(300) });
}
