import { NextResponse } from "next/server";

import { orderIntentSchema, fieldErrors } from "@/lib/validation";
import { isDevMailer, sendVerificationCode } from "@/server/mailer";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { flushStoreForHttp, hydrateStore, issueCode } from "@/server/store";

export const runtime = "nodejs";

/** Step 1 of checkout: email a 6-digit code to the address on the order. */
export async function POST(request: Request) {
  await hydrateStore();
  const limited = rateLimit(clientKey(request, "verify"), 12, 10 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json(
      {
        error: "Too many attempts from this connection. Give it a few minutes.",
        retryAfterSeconds: limited.retryAfterSeconds,
      },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = orderIntentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const { email, name } = parsed.data;
  const issued = issueCode(email);

  if (!issued.ok) {
    const message =
      issued.reason === "cooldown"
        ? `Hang on ${issued.retryAfterSeconds}s before asking for another code.`
        : "That address has had too many codes today. Try again later or email us.";
    return NextResponse.json(
      { error: message, retryAfterSeconds: issued.retryAfterSeconds },
      { status: 429 },
    );
  }

  try {
    await sendVerificationCode(email, name, issued.code);
  } catch (error) {
    console.error("[utopia] verification email failed", error);
    return NextResponse.json(
      { error: "We couldn't send that email. Try again in a moment." },
      { status: 502 },
    );
  }

  const saved = await flushStoreForHttp();
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 503 });
  return NextResponse.json({
    ok: true,
    expiresAt: issued.expiresAt,
    resendAfterSeconds: issued.resendAfter,
    // Without mail credentials there is no inbox to check, so surface the code.
    devCode:
      isDevMailer() && process.env.NODE_ENV !== "production" ? issued.code : undefined,
  });
}
