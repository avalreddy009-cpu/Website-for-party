import { NextResponse } from "next/server";

import { fieldErrors, passPricesSchema } from "@/lib/validation";
import { getAdminSession } from "@/server/admin-session";
import { clientKey, rateLimit } from "@/server/rate-limit";
import {
  flushStoreForHttp,
  getPassPrices,
  hydrateStore,
  repriceOpenReservations,
  setPassPrices,
} from "@/server/store";
import { renderUpiPayment } from "@/server/upi-qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0, must-revalidate" };

async function pricesWithUpi(updatedHolds = 0) {
  const prices = getPassPrices();
  const [early, vip] = await Promise.all([
    renderUpiPayment(prices.early, ""),
    renderUpiPayment(prices.vip, ""),
  ]);
  return { ...prices, updatedHolds, upi: { early, vip } };
}

export async function GET() {
  await hydrateStore();
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: NO_STORE });
  }
  return NextResponse.json(await pricesWithUpi(), { headers: NO_STORE });
}

export async function POST(request: Request) {
  await hydrateStore();
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: NO_STORE });
  }

  const limited = rateLimit(clientKey(request, "admin-prices"), 20, 10 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Slow down a little." }, { status: 429, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400, headers: NO_STORE });
  }

  const parsed = passPricesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the prices.", fields: fieldErrors(parsed.error) },
      { status: 422, headers: NO_STORE },
    );
  }

  setPassPrices(parsed.data);
  const updatedHolds = repriceOpenReservations();
  const saved = await flushStoreForHttp();
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: 503, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true, ...(await pricesWithUpi(updatedHolds)) }, { headers: NO_STORE });
}
