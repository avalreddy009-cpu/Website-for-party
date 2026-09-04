import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

import { PASS_WALLET_COOKIE, cookieSecure } from "./admin-auth";
import { getAuthSecret } from "./secret";
import { toWalletPass, type Order, type WalletPass } from "./store";

const WALLET_MAX_AGE = 60 * 60 * 24 * 40;

/** Browsers drop a cookie over ~4KB without telling anyone. Leave room for the name and attributes. */
const COOKIE_BUDGET = 3600;

function secret() {
  return getAuthSecret();
}

function sign(body: string): string {
  const signature = createHmac("sha256", secret()).update(`pass-wallet:${body}`).digest("base64url");
  return `${body}.${signature}`;
}

function readSigned(token: string): WalletPass[] | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", secret()).update(`pass-wallet:${body}`).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      email?: string;
      orders?: WalletPass[];
    };
    if (!Array.isArray(parsed.orders)) return [];
    return parsed.orders;
  } catch {
    return null;
  }
}

export async function readPassWallet(email: string): Promise<WalletPass[]> {
  const store = await cookies();
  const raw = store.get(PASS_WALLET_COOKIE)?.value;
  if (!raw) return [];
  const orders = readSigned(raw);
  if (!orders) return [];
  const needle = email.trim().toLowerCase();
  return orders.filter((order) => order.email.trim().toLowerCase() === needle);
}

export async function writePassWallet(email: string, orders: WalletPass[]): Promise<void> {
  const needle = email.trim().toLowerCase();
  const unique = new Map<string, WalletPass>();
  for (const order of orders) {
    if (order.email.trim().toLowerCase() !== needle) continue;
    const current = unique.get(order.reference);
    if (!current || (order.status === "paid" && current.status !== "paid")) {
      unique.set(order.reference, order);
    }
  }

  // Newest first, so trimming to fit the cookie drops the oldest passes.
  const kept = [...unique.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);

  let token = "";
  while (kept.length > 0) {
    const body = Buffer.from(JSON.stringify({ email: needle, orders: kept })).toString("base64url");
    token = sign(body);
    if (token.length <= COOKIE_BUDGET) break;
    kept.pop();
  }

  const store = await cookies();
  if (kept.length === 0) {
    // Nothing left that fits. Better to have no fallback than a cookie the
    // browser silently refuses, which looks identical to being signed out.
    store.delete(PASS_WALLET_COOKIE);
    return;
  }

  store.set(PASS_WALLET_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: WALLET_MAX_AGE,
  });
}

export async function upsertPassWallet(email: string, order: Order): Promise<WalletPass[]> {
  const existing = await readPassWallet(email);
  const next = [...existing.filter((item) => item.reference !== order.reference), toWalletPass(order)];
  await writePassWallet(email, next);
  return next;
}
