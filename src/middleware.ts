import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), payment=()",
  "X-DNS-Prefetch-Control": "off",
};

const STAFF_PREFIXES = ["/admin", "/door", "/api/admin", "/api/door"];

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  const path = request.nextUrl.pathname;
  if (STAFF_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Cache-Control", "no-store");
  }

  if (path.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|media/).*)"],
};
