import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { confirmCodeSchema, fieldErrors } from "@/lib/validation";
import { BUYER_SESSION_COOKIE, cookieSecure } from "@/server/admin-auth";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { checkCode, flushStoreForHttp, hydrateStore, signBuyerSession } from "@/server/store";

export const runtime = "nodejs";

const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export async function POST(request: Request) {
  await hydrateStore();
  const limited = rateLimit(clientKey(request, "account-confirm"), 30, 10 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many tries. Wait a few minutes." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = confirmCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the code.", fields: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const result = checkCode(parsed.data.email, parsed.data.code);
  if (!result.ok) {
    return NextResponse.json(
      { error: "That code didn't work. Request a new one if it expired." },
      { status: 400 },
    );
  }

  const token = signBuyerSession(parsed.data.email);
  const cookieStore = await cookies();
  cookieStore.set(BUYER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  const saved = await flushStoreForHttp();
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 503 });
  return NextResponse.json({ ok: true, email: parsed.data.email });
}
