import { NextResponse } from "next/server";

import { orderIdSchema } from "@/lib/validation";
import { getAdminSession } from "@/server/admin-session";
import { getOrderById, hydrateStore } from "@/server/store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await hydrateStore();
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const { id } = await params;
  const parsed = orderIdSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const order = getOrderById(parsed.data);
  if (!order?.paymentProofData) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({
    src: order.paymentProofData,
    name: order.paymentProofName,
  });
}
