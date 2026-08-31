/**
 * Single HMAC secret for sessions, QR tokens, door codes, and claim links.
 * Production refuses to boot crypto on the well-known dev fallback.
 */
const DEV_FALLBACK = "utopia-dev-secret-change-me";

export function getAuthSecret(): string {
  const value = process.env.AUTH_SECRET?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production.");
  }
  return DEV_FALLBACK;
}
