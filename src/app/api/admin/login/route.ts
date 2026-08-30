import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { fieldErrors, phraseLoginSchema } from "@/lib/validation";
import { ADMIN_SESSION_COOKIE, checkUnlockPhrase, unlockConfigured } from "@/server/admin-auth";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { signAdminSession } from "@/server/store";

export const runtime = "nodejs";

const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "admin-login"), 8, 10 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a bit before trying again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  if (!unlockConfigured("cms")) {
    return NextResponse.json(
      { error: "CMS phrase isn't configured on this server yet." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = phraseLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That's 12 words, in order.", fields: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  if (!checkUnlockPhrase("cms", parsed.data.phrase)) {
    return NextResponse.json({ error: "That phrase doesn't unlock this." }, { status: 401 });
  }

  const token = signAdminSession("cms");
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ ok: true, role: "cms" });
}
