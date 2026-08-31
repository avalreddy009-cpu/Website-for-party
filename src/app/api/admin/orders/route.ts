import { NextResponse } from "next/server";

import { summarizeOrders } from "@/lib/order-stats";
import { getAdminSession } from "@/server/admin-session";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { hydrateStore, listOrders, toStaffOrder } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await hydrateStore();
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const limited = rateLimit(clientKey(request, "admin-list"), 60, 10 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Slow down a little." }, { status: 429 });
  }

  const orders = listOrders();
  return NextResponse.json({
    orders: orders.map(toStaffOrder),
    stats: summarizeOrders(orders),
  });
}
