import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { PassId } from "@/lib/passes";

/**
 * Deliberately small persistence layer. Everything the app needs goes through
 * this module, so swapping the JSON file for Postgres/Redis later means
 * rewriting one file and nothing else.
 *
 * Writes are best-effort: on a read-only filesystem (most serverless hosts)
 * this degrades to in-process memory, which is fine for a single node but is
 * the first thing to replace before real traffic.
 */

export type OrderStatus = "reserved" | "paid" | "cancelled" | "expired";

export type Order = {
  id: string;
  reference: string;
  passId: PassId;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  fee: number;
  total: number;
  buyer: { name: string; email: string; phone: string };
  status: OrderStatus;
  createdAt: number;
  holdExpiresAt: number;
  paidAt?: number;
  paymentRef?: string;
};

type Verification = {
  email: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
  sendCount: number;
  verifiedAt?: number;
};

type Db = {
  orders: Record<string, Order>;
  verifications: Record<string, Verification>;
};

const DATA_FILE = join(process.cwd(), ".data", "utopia.json");
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_WINDOW = 5;

function emptyDb(): Db {
  return { orders: {}, verifications: {} };
}

function load(): Db {
  try {
    if (existsSync(DATA_FILE)) {
      const parsed = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Db;
      return { orders: parsed.orders ?? {}, verifications: parsed.verifications ?? {} };
    }
  } catch {
    // Corrupt or unreadable file: start clean rather than crashing the route.
  }
  return emptyDb();
}

// Survive dev-server hot reloads.
const globalRef = globalThis as typeof globalThis & { __utopiaDb?: Db };
const db: Db = (globalRef.__utopiaDb ??= load());

let persistWarned = false;

function persist(): void {
  try {
    mkdirSync(dirname(DATA_FILE), { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
  } catch {
    if (!persistWarned) {
      persistWarned = true;
      console.warn(
        "[utopia] Filesystem is read-only — orders are in memory only. Point store.ts at a database before going live.",
      );
    }
  }
}

function secret(): string {
  return process.env.AUTH_SECRET ?? "utopia-dev-secret-change-me";
}

function hashCode(email: string, code: string): string {
  return createHash("sha256").update(`${email}:${code}:${secret()}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/* ------------------------------- codes ------------------------------- */

export type IssueResult =
  | { ok: true; code: string; expiresAt: number; resendAfter: number }
  | { ok: false; reason: "cooldown" | "too-many"; retryAfterSeconds: number };

export function issueCode(email: string): IssueResult {
  const now = Date.now();
  const existing = db.verifications[email];

  if (existing) {
    const sinceLastSend = now - existing.lastSentAt;
    if (sinceLastSend < RESEND_COOLDOWN_MS) {
      return {
        ok: false,
        reason: "cooldown",
        retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - sinceLastSend) / 1000),
      };
    }
    // Sends decay with the code window, so an abandoned attempt doesn't lock
    // the address out forever.
    const withinWindow = now - existing.lastSentAt < CODE_TTL_MS * 3;
    if (withinWindow && existing.sendCount >= MAX_SENDS_PER_WINDOW) {
      return { ok: false, reason: "too-many", retryAfterSeconds: 15 * 60 };
    }
  }

  const code = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0");
  db.verifications[email] = {
    email,
    codeHash: hashCode(email, code),
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
    lastSentAt: now,
    sendCount: (existing?.sendCount ?? 0) + 1,
    verifiedAt: undefined,
  };
  persist();

  return {
    ok: true,
    code,
    expiresAt: now + CODE_TTL_MS,
    resendAfter: Math.ceil(RESEND_COOLDOWN_MS / 1000),
  };
}

export type CheckResult =
  | { ok: true; token: string }
  | { ok: false; reason: "unknown" | "expired" | "locked" | "mismatch"; attemptsLeft: number };

export function checkCode(email: string, code: string): CheckResult {
  const record = db.verifications[email];
  if (!record) return { ok: false, reason: "unknown", attemptsLeft: 0 };

  if (Date.now() > record.expiresAt) {
    return { ok: false, reason: "expired", attemptsLeft: 0 };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: "locked", attemptsLeft: 0 };
  }

  if (!safeEqual(record.codeHash, hashCode(email, code))) {
    record.attempts += 1;
    persist();
    return {
      ok: false,
      reason: "mismatch",
      attemptsLeft: Math.max(0, MAX_ATTEMPTS - record.attempts),
    };
  }

  record.verifiedAt = Date.now();
  persist();
  return { ok: true, token: signToken(email) };
}

/* ------------------------------- tokens ------------------------------ */

const TOKEN_TTL_MS = 30 * 60 * 1000;

export function signToken(email: string): string {
  const expires = Date.now() + TOKEN_TTL_MS;
  const payload = `${email}.${expires}`;
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

export function verifyToken(token: string, email: string): boolean {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return false;

  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return false;
  }

  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (!safeEqual(signature, expected)) return false;

  const separator = payload.lastIndexOf(".");
  const tokenEmail = payload.slice(0, separator);
  const expires = Number(payload.slice(separator + 1));
  return tokenEmail === email && Number.isFinite(expires) && Date.now() < expires;
}

/* ------------------------------- orders ------------------------------ */

const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function reference(): string {
  const block = (length: number) =>
    Array.from(randomBytes(length))
      .map((byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length])
      .join("");
  return `UTP-${block(4)}-${block(4)}`;
}

export function createOrder(
  input: Omit<Order, "id" | "reference" | "status" | "createdAt" | "holdExpiresAt">,
  holdMinutes: number,
): Order {
  const now = Date.now();
  const order: Order = {
    ...input,
    id: randomBytes(12).toString("base64url"),
    reference: reference(),
    status: "reserved",
    createdAt: now,
    holdExpiresAt: now + holdMinutes * 60 * 1000,
  };
  db.orders[order.id] = order;
  persist();
  return order;
}

export function getOrderByReference(ref: string): Order | undefined {
  return Object.values(db.orders).find((order) => order.reference === ref);
}

export function listOrders(): Order[] {
  return Object.values(db.orders).sort((a, b) => b.createdAt - a.createdAt);
}

export function countPassesSold(passId: PassId): number {
  return listOrders()
    .filter((order) => order.passId === passId && order.status !== "cancelled")
    .reduce((sum, order) => sum + order.quantity, 0);
}
