import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { confirmCodeSchema, fieldErrors } from "@/lib/validation";
import { BUYER_SESSION_COOKIE } from "@/server/admin-auth";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { checkCode, flushStore, hydrateStore, signBuyerSession } from "@/server/store";

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
    const messages: Record<typeof result.reason, string> = {
      unknown: "Ask for a fresh code first.",
      expired: "That code expired. Send yourself a new one.",
      locked: "Too many wrong codes. Request a new one.",
      mismatch:
        result.attemptsLeft > 0
          ? `Not that one. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "try" : "tries"} left.`
          : "Too many wrong codes. Request a new one.",
    };
    return NextResponse.json(
      { error: messages[result.reason], fields: { code: messages[result.reason] } },
      { status: 400 },
    );
  }

  const token = signBuyerSession(parsed.data.email);
  const cookieStore = await cookies();
  cookieStore.set(BUYER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  await flushStore();
  return NextResponse.json({ ok: true, email: parsed.data.email });
}
