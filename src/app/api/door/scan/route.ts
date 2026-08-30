import { NextResponse } from "next/server";

import { fieldErrors, scanPayloadSchema } from "@/lib/validation";
import { getDoorSession } from "@/server/admin-session";
import { sendEntryNotice } from "@/server/mailer";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { listScans, scanPass } from "@/server/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getDoorSession();
  if (!session) {
    return NextResponse.json({ error: "Unlock the door panel first." }, { status: 401 });
  }

  const limited = rateLimit(clientKey(request, "door-scan"), 80, 10 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Slow down a little." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = scanPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Scan or type the pass.", fields: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const { result, order, scan } = scanPass(parsed.data.payload, session.username);

  if (result === "admitted" && order) {
    try {
      await sendEntryNotice(order);
    } catch (error) {
      console.error("[utopia] entry email failed", error);
    }
  }

  return NextResponse.json({
    ok: result === "admitted" || result === "already-in",
    result,
    scan,
    pass: order
      ? {
          name: order.buyer.name,
          passCode: order.passCode,
          reference: order.reference,
          quantity: order.quantity,
          passId: order.passId,
          enteredAt: order.enteredAt,
          status: order.status,
        }
      : null,
  });
}

export async function GET() {
  const session = await getDoorSession();
  if (!session) {
    return NextResponse.json({ error: "Unlock the door panel first." }, { status: 401 });
  }
  return NextResponse.json({ scans: listScans(80) });
}
