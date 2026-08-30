import { NextResponse } from "next/server";

import { getBuyerSession } from "@/server/admin-session";
import { listOrdersByEmail } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getBuyerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const orders = listOrdersByEmail(session.email).map((order) => ({
    reference: order.reference,
    passId: order.passId,
    quantity: order.quantity,
    total: order.total,
    status: order.status,
    createdAt: order.createdAt,
    passCode: order.status === "paid" ? order.passCode : undefined,
    enteredAt: order.enteredAt,
    utr: order.utr,
  }));

  return NextResponse.json({ email: session.email, orders });
}
