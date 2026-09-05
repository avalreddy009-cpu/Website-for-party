import { NextResponse } from "next/server";

import { orderIdSchema } from "@/lib/validation";
import { getAdminSession } from "@/server/admin-session";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { flushStoreForHttp, hydrateStore, purgeOrder } from "@/server/store";

export const runtime = "nodejs";

/** Take a pass off CMS and the door. Paid and scanned rows included. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await hydrateStore();
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const limited = rateLimit(clientKey(request, "admin-decision"), 60, 10 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Slow down a little." }, { status: 429 });
  }

  const { id } = await params;
  const parsedId = orderIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "That order doesn't exist." }, { status: 404 });
  }

  const result = purgeOrder(parsedId.data);
  const saved = await flushStoreForHttp();
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 503 });
  return NextResponse.json({
    ok: true,
    id: parsedId.data,
    reference: result.order?.reference,
  });
}
