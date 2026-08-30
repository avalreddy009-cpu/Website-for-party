import { NextResponse } from "next/server";

import { TEST_USER, isTestUserEmail } from "@/lib/test-user";
import { emailLoginSchema, fieldErrors } from "@/lib/validation";
import { isDevMailer, sendLoginCode } from "@/server/mailer";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { issueCode } from "@/server/store";

export const runtime = "nodejs";

/** Guest login step 1: email a 6-digit code. Not the CMS. */
export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "account-login"), 12, 10 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many attempts from this connection. Give it a few minutes." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = emailLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That email doesn't look right.", fields: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  if (isTestUserEmail(parsed.data.email)) {
    return NextResponse.json({
      ok: true,
      resendAfterSeconds: 0,
      demoCode: TEST_USER.code,
    });
  }

  const issued = issueCode(parsed.data.email);
  if (!issued.ok) {
    const message =
      issued.reason === "cooldown"
        ? `Hang on ${issued.retryAfterSeconds}s before asking for another code.`
        : "That address has had too many codes today. Try again later.";
    return NextResponse.json(
      { error: message, retryAfterSeconds: issued.retryAfterSeconds },
      { status: 429 },
    );
  }

  try {
    await sendLoginCode(parsed.data.email, issued.code);
  } catch (error) {
    console.error("[utopia] login email failed", error);
    return NextResponse.json(
      { error: "We couldn't send that email. Try again in a moment." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    expiresAt: issued.expiresAt,
    resendAfterSeconds: issued.resendAfter,
    devCode:
      isDevMailer() && process.env.NODE_ENV !== "production" ? issued.code : undefined,
  });
}
