import { NextResponse } from "next/server";

import { confirmCodeSchema, fieldErrors } from "@/lib/validation";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { checkCode } from "@/server/store";

export const runtime = "nodejs";

/** Step 2: exchange a correct code for a short-lived signed token. */
export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "confirm"), 30, 10 * 60 * 1000);
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

  return NextResponse.json({ ok: true, verificationToken: result.token });
}
