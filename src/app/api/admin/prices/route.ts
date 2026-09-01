import { NextResponse } from "next/server";

import { fieldErrors, passPricesSchema } from "@/lib/validation";
import { getAdminSession } from "@/server/admin-session";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { flushStore, getPassPrices, hydrateStore, setPassPrices } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await hydrateStore();
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  return NextResponse.json(getPassPrices());
}

export async function POST(request: Request) {
  await hydrateStore();
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const limited = rateLimit(clientKey(request, "admin-prices"), 20, 10 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Slow down a little." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = passPricesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the prices.", fields: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const prices = setPassPrices(parsed.data);
  await flushStore();
  return NextResponse.json({ ok: true, ...prices });
}
