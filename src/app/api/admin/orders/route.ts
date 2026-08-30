import { NextResponse } from "next/server";

import { summarizeOrders } from "@/lib/order-stats";
import { getAdminSession } from "@/server/admin-session";
import { hydrateStore, isDurableStore, listOrders } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await hydrateStore();
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const orders = listOrders();
  return NextResponse.json({
    orders,
    stats: summarizeOrders(orders),
    durable: isDurableStore(),
  });
}
