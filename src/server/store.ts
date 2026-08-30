import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { PassId } from "@/lib/passes";
import { derivePassDigits } from "./pass-code";
import { getPhraseHashes } from "./phrase";

// Resolve CMS/door phrase hashes on boot (env override or first-deploy fallback).
getPhraseHashes();

/**
 * Deliberately small persistence layer. Everything the app needs goes through
 * this module, so swapping the JSON file for Postgres/Redis later means
 * rewriting one file and nothing else.
 *
 * Writes are best-effort: on a read-only filesystem (most serverless hosts)
 * this degrades to in-process memory, which is fine for a single node but is
 * the first thing to replace before real traffic.
 */

export type OrderStatus = "reserved" | "paid" | "rejected" | "cancelled" | "expired";

export type TransferRecord = {
  at: number;
  by: string;
  from: { name: string; email: string; phone: string };
  previousPassCode?: string;
};

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
  utr?: string;
  paymentProofName?: string;
  paymentProofMime?: string;
  paymentProofData?: string;
  paidSubmittedAt?: number;
  rejectedAt?: number;
  rejectionReason?: string;
  decidedBy?: string;
  passCode?: string;
  qrToken?: string;
  enteredAt?: number;
  entryCount?: number;
  transferredAt?: number;
  transferredBy?: string;
  transferHistory?: TransferRecord[];
  revokedPassCodes?: string[];
};

export type ScanResult = "admitted" | "already-in" | "invalid" | "unpaid" | "rejected";

export type ScanLog = {
  id: string;
  orderId?: string;
  reference?: string;
  passCode?: string;
  name?: string;
  email?: string;
  result: ScanResult;
  payload: string;
  at: number;
  by: string;
  firstEntry: boolean;
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
  scans: ScanLog[];
};

const DATA_FILE = join(process.cwd(), ".data", "utopia.json");
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_WINDOW = 5;

function emptyDb(): Db {
  return { orders: {}, verifications: {}, scans: [] };
}

function load(): Db {
  try {
    if (existsSync(DATA_FILE)) {
      const parsed = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Partial<Db>;
      return {
        orders: parsed.orders ?? {},
        verifications: parsed.verifications ?? {},
        scans: Array.isArray(parsed.scans) ? parsed.scans : [],
      };
    }
  } catch {
    // Corrupt or unreadable file: start clean rather than crashing the route.
  }
  return emptyDb();
}

// Survive dev-server hot reloads.
const globalRef = globalThis as typeof globalThis & { __utopiaDb?: Db };
const db: Db = (globalRef.__utopiaDb ??= load());
if (!db.orders) db.orders = {};
if (!db.verifications) db.verifications = {};
if (!Array.isArray(db.scans)) db.scans = [];

let persistWarned = false;

let flushPromise: Promise<void> = Promise.resolve();

function persist(): void {
  try {
    mkdirSync(dirname(DATA_FILE), { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
  } catch {
    if (!persistWarned) {
      persistWarned = true;
      console.warn(
        "[utopia] Filesystem is read-only — orders live in memory on this instance. Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN so MY PASSES and the door see CMS approvals.",
      );
    }
  }
  flushPromise = persistRemote();
}

export async function flushStore(): Promise<void> {
  await flushPromise;
}

const UPSTASH_KEY = "utopia:db:v1";
const globalHydrate = globalThis as typeof globalThis & {
  __utopiaHydrate?: Promise<void>;
};

function upstashAuth(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

function snapshotDb(): Db {
  return { orders: db.orders, verifications: db.verifications, scans: db.scans };
}

function mergeRemote(remote: Partial<Db>): void {
  const rank = (status: OrderStatus) =>
    status === "paid" ? 4 : status === "reserved" ? 3 : status === "rejected" ? 2 : 1;

  for (const [id, incoming] of Object.entries(remote.orders ?? {})) {
    const current = db.orders[id];
    if (!current || rank(incoming.status) >= rank(current.status)) {
      db.orders[id] = incoming;
    }
  }
  for (const [email, incoming] of Object.entries(remote.verifications ?? {})) {
    const current = db.verifications[email];
    if (!current || incoming.lastSentAt >= current.lastSentAt) {
      db.verifications[email] = incoming;
    }
  }
  if (Array.isArray(remote.scans) && remote.scans.length > 0) {
    const seen = new Set(db.scans.map((scan) => scan.id));
    const extra = remote.scans.filter((scan) => !seen.has(scan.id));
    if (extra.length > 0) {
      db.scans = [...extra, ...db.scans].sort((a, b) => b.at - a.at).slice(0, 400);
    }
  }
}

async function persistRemote(): Promise<void> {
  const auth = upstashAuth();
  if (!auth) return;
  try {
    await fetch(auth.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["SET", UPSTASH_KEY, JSON.stringify(snapshotDb())]),
    });
  } catch (error) {
    console.error("[utopia] remote store write failed", error);
  }
}

export async function hydrateStore(): Promise<void> {
  const auth = upstashAuth();
  if (!auth) return;
  if (globalHydrate.__utopiaHydrate) {
    await globalHydrate.__utopiaHydrate;
    return;
  }
  globalHydrate.__utopiaHydrate = (async () => {
    try {
      const response = await fetch(`${auth.url}/get/${encodeURIComponent(UPSTASH_KEY)}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
        cache: "no-store",
      });
      const payload = (await response.json()) as { result?: string | null };
      if (payload.result) {
        mergeRemote(JSON.parse(payload.result) as Partial<Db>);
      }
    } catch (error) {
      console.error("[utopia] remote store read failed", error);
    } finally {
      globalHydrate.__utopiaHydrate = undefined;
    }
  })();
  await globalHydrate.__utopiaHydrate;
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

/**
 * One signing primitive shared by every token this app issues. Each token is
 * tagged with a `purpose` so a checkout email-verification token can never be
 * replayed as an admin session (or vice versa), even though both are just
 * HMAC-signed strings from the same secret.
 */
type TokenPurpose = "verify-email" | "buyer-session" | "admin-session" | "door-session" | "pass-qr";

function signPurposeToken(purpose: TokenPurpose, subject: string, ttlMs: number): string {
  const expires = Date.now() + ttlMs;
  const payload = `${purpose}:${subject}:${expires}`;
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

function decodePurposeToken(purpose: TokenPurpose, token: string): { subject: string } | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (!safeEqual(signature, expected)) return null;

  // Subject can contain almost anything except our own separator, so split
  // on the first and last colon rather than assume a fixed shape.
  const firstColon = payload.indexOf(":");
  const lastColon = payload.lastIndexOf(":");
  if (firstColon === -1 || lastColon === firstColon) return null;

  const tokenPurpose = payload.slice(0, firstColon);
  const subject = payload.slice(firstColon + 1, lastColon);
  const expires = Number(payload.slice(lastColon + 1));

  if (tokenPurpose !== purpose) return null;
  if (!Number.isFinite(expires) || Date.now() >= expires) return null;
  return { subject };
}

const TOKEN_TTL_MS = 30 * 60 * 1000;
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const PASS_QR_TTL_MS = 180 * 24 * 60 * 60 * 1000;

export function signToken(email: string): string {
  return signPurposeToken("verify-email", email, TOKEN_TTL_MS);
}

export function verifyToken(token: string, email: string): boolean {
  return decodePurposeToken("verify-email", token)?.subject === email;
}

const BUYER_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Cookie for a guest looking up their own passes — not staff, not door. */
export function signBuyerSession(email: string): string {
  return signPurposeToken("buyer-session", email, BUYER_SESSION_TTL_MS);
}

export function verifyBuyerSession(token: string): { email: string } | null {
  const decoded = decodePurposeToken("buyer-session", token);
  return decoded ? { email: decoded.subject } : null;
}

/** Signed cookie payload for the admin CMS — same primitive, its own purpose tag. */
export function signAdminSession(username: string): string {
  return signPurposeToken("admin-session", username, ADMIN_SESSION_TTL_MS);
}

export function verifyAdminSession(token: string): { username: string } | null {
  const decoded = decodePurposeToken("admin-session", token);
  return decoded ? { username: decoded.subject } : null;
}

export function signDoorSession(username: string): string {
  return signPurposeToken("door-session", username, ADMIN_SESSION_TTL_MS);
}

export function verifyDoorSession(token: string): { username: string } | null {
  const decoded = decodePurposeToken("door-session", token);
  return decoded ? { username: decoded.subject } : null;
}

export function verifyPassToken(token: string): { orderId: string; passCode: string } | null {
  const decoded = decodePurposeToken("pass-qr", token);
  if (!decoded) return null;
  const lastColon = decoded.subject.lastIndexOf(":");
  if (lastColon === -1) return null;
  const orderId = decoded.subject.slice(0, lastColon);
  const passCode = decoded.subject.slice(lastColon + 1);
  if (!orderId || !/^\d{6}$/.test(passCode)) return null;
  return { orderId, passCode };
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

export function getOrderById(id: string): Order | undefined {
  return db.orders[id];
}

export function listOrders(): Order[] {
  return Object.values(db.orders).sort((a, b) => b.createdAt - a.createdAt);
}

export function listOrdersByEmail(email: string): Order[] {
  const needle = email.trim().toLowerCase();
  return listOrders().filter((order) => order.buyer.email === needle);
}

export function countPassesSold(passId: PassId): number {
  return listOrders()
    .filter((order) => order.passId === passId && order.status === "paid")
    .reduce((sum, order) => sum + order.quantity, 0);
}

export type PaymentProofResult =
  | { ok: true; order: Order }
  | { ok: false; reason: "not-found" | "already-decided" };

export function attachPaymentProof(
  referenceCode: string,
  email: string,
  proof: { utr: string; proofName: string; proofMime: string; proofData: string },
): PaymentProofResult {
  const order = getOrderByReference(referenceCode);
  if (!order) return { ok: false, reason: "not-found" };
  if (order.buyer.email !== email) return { ok: false, reason: "not-found" };
  if (DECIDED_STATUSES.includes(order.status)) {
    return { ok: false, reason: "already-decided" };
  }
  order.paidSubmittedAt = Date.now();
  order.utr = proof.utr;
  order.paymentRef = proof.utr;
  order.paymentProofName = proof.proofName;
  order.paymentProofMime = proof.proofMime;
  order.paymentProofData = proof.proofData;
  // Proof is in — don't expire the reservation after the old 30-minute hold.
  order.holdExpiresAt = Date.now() + 180 * 24 * 60 * 60 * 1000;
  persist();
  return { ok: true, order };
}

export type DecisionResult =
  | { ok: true; order: Order }
  | { ok: false; reason: "not-found" | "already-decided" };

const DECIDED_STATUSES: OrderStatus[] = ["paid", "rejected", "cancelled"];

function mintPass(order: Order): void {
  const passCode = derivePassDigits(order.buyer.email, order.buyer.phone);
  order.passCode = passCode;
  order.qrToken = signPurposeToken("pass-qr", `${order.id}:${passCode}`, PASS_QR_TTL_MS);
}

/**
 * The manual analog of a payment-gateway webhook: an admin looked at proof of
 * payment outside the site and is vouching for it. When a real PG lands, its
 * webhook handler should call this exact function on success instead of
 * requiring a human to click a button — the CMS button and the webhook are
 * meant to converge on one code path, not two.
 */
export function approveOrder(id: string, decidedBy?: string): DecisionResult {
  const order = db.orders[id];
  if (!order) return { ok: false, reason: "not-found" };
  if (DECIDED_STATUSES.includes(order.status)) {
    return { ok: false, reason: "already-decided" };
  }

  order.status = "paid";
  order.paidAt = Date.now();
  order.decidedBy = decidedBy;
  mintPass(order);
  persist();
  return { ok: true, order };
}

/** The manual analog of a payment-gateway webhook reporting failure. */
export function rejectOrder(id: string, reason?: string, decidedBy?: string): DecisionResult {
  const order = db.orders[id];
  if (!order) return { ok: false, reason: "not-found" };
  if (DECIDED_STATUSES.includes(order.status)) {
    return { ok: false, reason: "already-decided" };
  }

  order.status = "rejected";
  order.rejectedAt = Date.now();
  order.rejectionReason = reason;
  order.decidedBy = decidedBy;
  persist();
  return { ok: true, order };
}

export type TransferResult =
  | { ok: true; order: Order; previousBuyer: Order["buyer"] }
  | { ok: false; reason: "not-found" | "not-paid" | "already-entered" | "unchanged" };

/**
 * Staff remint: bind a paid pass to a new name/email/phone. Old door code and
 * QR die immediately. Already-scanned passes stay locked so a used ticket
 * cannot be sold on after the door.
 */
export function transferOrder(
  id: string,
  buyer: { name: string; email: string; phone: string },
  transferredBy?: string,
): TransferResult {
  const order = db.orders[id];
  if (!order) return { ok: false, reason: "not-found" };
  if (order.status !== "paid") return { ok: false, reason: "not-paid" };
  if (order.enteredAt) return { ok: false, reason: "already-entered" };

  const next = {
    name: buyer.name.trim(),
    email: buyer.email.trim().toLowerCase(),
    phone: buyer.phone.trim(),
  };
  const samePerson =
    order.buyer.email === next.email &&
    order.buyer.phone.replace(/\D/g, "") === next.phone.replace(/\D/g, "") &&
    order.buyer.name.trim().toLowerCase() === next.name.toLowerCase();
  if (samePerson) return { ok: false, reason: "unchanged" };

  const previousBuyer = { ...order.buyer };
  const previousPassCode = order.passCode;
  const record: TransferRecord = {
    at: Date.now(),
    by: transferredBy ?? "cms",
    from: previousBuyer,
    previousPassCode,
  };

  order.buyer = next;
  order.transferredAt = record.at;
  order.transferredBy = record.by;
  order.transferHistory = [...(order.transferHistory ?? []), record].slice(-20);
  if (previousPassCode) {
    const revoked = new Set(order.revokedPassCodes ?? []);
    revoked.add(previousPassCode);
    order.revokedPassCodes = [...revoked].slice(-40);
  }
  mintPass(order);
  persist();
  return { ok: true, order, previousBuyer };
}

/* -------------------------------- scans ------------------------------- */

export function listScans(limit = 200): ScanLog[] {
  if (!Array.isArray(db.scans)) db.scans = [];
  return db.scans.slice(0, limit);
}

export function parseScanPayload(raw: string): { token?: string; code?: string; reference?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 6) return { code: digits };

  if (/^UTP-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(trimmed)) {
    return { reference: trimmed.toUpperCase() };
  }

  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get("p");
    if (fromQuery) return { token: fromQuery };
  } catch {
    // Not a URL — keep parsing.
  }

  const parts = trimmed.split("|");
  if (parts[0] === "UTP" && parts.length >= 4) {
    return { code: parts[2], token: parts.slice(3).join("|") };
  }

  return { token: trimmed };
}

export type ScanPassResult = {
  result: ScanResult;
  order?: Order;
  scan: ScanLog;
};

export function scanPass(raw: string, scannedBy: string): ScanPassResult {
  const parsed = parseScanPayload(raw);
  let order: Order | undefined;

  if (parsed.token) {
    const decoded = verifyPassToken(parsed.token);
    if (decoded) {
      const candidate = db.orders[decoded.orderId];
      if (candidate && candidate.passCode === decoded.passCode) {
        order = candidate;
      }
    }
  }

  if (!order && parsed.reference) {
    order = getOrderByReference(parsed.reference);
  }

  if (!order && parsed.code) {
    const matches = Object.values(db.orders).filter((item) => item.passCode === parsed.code);
    const paid = matches.filter((item) => item.status === "paid");
    if (paid.length === 1) order = paid[0];
    else if (matches.length === 1) order = matches[0];
  }

  let result: ScanResult = "invalid";
  if (!order) {
    result = "invalid";
  } else if (order.status === "rejected") {
    result = "rejected";
  } else if (order.status !== "paid") {
    result = "unpaid";
  } else if (order.enteredAt) {
    result = "already-in";
    order.entryCount = (order.entryCount ?? 1) + 1;
  } else {
    result = "admitted";
    order.enteredAt = Date.now();
    order.entryCount = 1;
  }

  const scan: ScanLog = {
    id: randomBytes(8).toString("base64url"),
    orderId: order?.id,
    reference: order?.reference,
    passCode: order?.passCode ?? parsed.code,
    name: order?.buyer.name,
    email: order?.buyer.email,
    result,
    payload: raw.slice(0, 240),
    at: Date.now(),
    by: scannedBy,
    firstEntry: result === "admitted",
  };
  if (!Array.isArray(db.scans)) db.scans = [];
  db.scans.unshift(scan);
  persist();
  return { result, order, scan };
}

/* -------------------- pass wallet / claim (cross-instance) -------------------- */

export type WalletPass = {
  id: string;
  reference: string;
  passId: PassId;
  quantity: number;
  total: number;
  status: OrderStatus;
  createdAt: number;
  passCode?: string;
  qrToken?: string;
  name: string;
  email: string;
  phone: string;
  enteredAt?: number;
};

export function toWalletPass(order: Order): WalletPass {
  return {
    id: order.id,
    reference: order.reference,
    passId: order.passId,
    quantity: order.quantity,
    total: order.total,
    status: order.status,
    createdAt: order.createdAt,
    passCode: order.passCode,
    qrToken: order.qrToken,
    name: order.buyer.name,
    email: order.buyer.email,
    phone: order.buyer.phone,
    enteredAt: order.enteredAt,
  };
}

export function signPassClaim(order: Order): string {
  const body = Buffer.from(JSON.stringify(toWalletPass(order))).toString("base64url");
  const signature = createHmac("sha256", secret()).update(`pass-claim:${body}`).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyPassClaim(token: string): WalletPass | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", secret()).update(`pass-claim:${body}`).digest("base64url");
  if (!safeEqual(signature, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as WalletPass;
    if (!parsed.email || !parsed.reference || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function importWalletPass(pass: WalletPass): Order | null {
  const email = pass.email.trim().toLowerCase();
  const existing =
    db.orders[pass.id] ??
    getOrderByReference(pass.reference) ??
    Object.values(db.orders).find(
      (order) => order.buyer.email === email && order.passCode && order.passCode === pass.passCode,
    );

  if (existing) {
    // Stale claim / wallet after a CMS transfer must not rewrite the live pass
    // or leak the new owner's door code to the previous inbox.
    if (existing.status === "paid" && existing.buyer.email !== email) {
      return null;
    }
    if (existing.status === "paid") {
      return existing;
    }
    if (pass.status === "paid") {
      existing.status = "paid";
      existing.paidAt = existing.paidAt ?? Date.now();
    }
    persist();
    return existing;
  }

  const order: Order = {
    id: pass.id || randomBytes(12).toString("base64url"),
    reference: pass.reference,
    passId: pass.passId,
    quantity: pass.quantity,
    unitPrice: pass.total,
    subtotal: pass.total,
    fee: 0,
    total: pass.total,
    buyer: { name: pass.name, email, phone: pass.phone },
    status: pass.status,
    createdAt: pass.createdAt,
    holdExpiresAt: pass.createdAt + 30 * 60 * 1000,
    passCode: pass.passCode,
    qrToken: pass.qrToken,
    paidAt: pass.status === "paid" ? Date.now() : undefined,
    enteredAt: pass.enteredAt,
  };
  if (order.status === "paid" && !order.passCode) mintPass(order);
  db.orders[order.id] = order;
  persist();
  return order;
}

export function recoverPaidPass(input: {
  email: string;
  phone: string;
  name?: string;
  passCode: string;
  reference?: string;
  passId?: PassId;
  quantity?: number;
}): { ok: true; order: Order } | { ok: false; reason: "code-mismatch" } {
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.replace(/\D/g, "");
  const passCode = input.passCode.replace(/\D/g, "");
  if (derivePassDigits(email, phone) !== passCode) {
    return { ok: false, reason: "code-mismatch" };
  }

  const revoked = Object.values(db.orders).some((order) =>
    (order.revokedPassCodes ?? []).includes(passCode),
  );
  if (revoked) {
    return { ok: false, reason: "code-mismatch" };
  }

  const ref = input.reference?.trim().toUpperCase();
  const existing =
    (ref ? getOrderByReference(ref) : undefined) ??
    Object.values(db.orders).find(
      (order) => order.buyer.email === email && order.passCode === passCode,
    );

  if (existing) {
    if (existing.buyer.email !== email) return { ok: false, reason: "code-mismatch" };
    existing.buyer.phone = phone;
    existing.status = "paid";
    existing.paidAt = existing.paidAt ?? Date.now();
    mintPass(existing);
    persist();
    return { ok: true, order: existing };
  }

  // Don't mint a free paid pass from an old email+phone hash. Store-wipe
  // recover still works when they bring an unused reservation reference.
  if (!ref || !/^UTP-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(ref)) {
    return { ok: false, reason: "code-mismatch" };
  }

  const now = Date.now();
  const order: Order = {
    id: randomBytes(12).toString("base64url"),
    reference: ref && /^UTP-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(ref) ? ref : reference(),
    passId: input.passId ?? "vip",
    quantity: input.quantity ?? 1,
    unitPrice: 0,
    subtotal: 0,
    fee: 0,
    total: 0,
    buyer: { name: input.name?.trim() || email.split("@")[0] || "Guest", email, phone },
    status: "paid",
    createdAt: now,
    holdExpiresAt: now,
    paidAt: now,
  };
  mintPass(order);
  db.orders[order.id] = order;
  persist();
  return { ok: true, order };
}
