import { NextResponse } from "next/server";

import { getPassPrices, hydrateStore } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await hydrateStore();
  return NextResponse.json(getPassPrices(), {
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
    },
  });
}
