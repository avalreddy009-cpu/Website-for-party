import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { cartCount, cartFromOrder, orderLines, type OrderLine } from "@/lib/cart";
import { parseScanPayload } from "@/lib/pass-scan";
import type { PassId } from "@/lib/passes";
import { DEFAULT_PASS_PRICES } from "@/lib/passes";
import { priceCart } from "@/lib/pricing";
import { isJpegDataUrl } from "./jpeg";
import { compactPassToken, derivePassDigits, verifyCompactPassToken } from "./pass-code";
import { getPhraseHashes } from "./phrase";
import { getAuthSecret } from "./secret";

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
  hasPaymentProof?: boolean;
  lines?: OrderLine[];
  tickets?: PassTicket[];
};

export type PassTicket = {
  id: string;
  passId: PassId;
  passCode: string;
  qrToken: string;
  enteredAt?: number;
};

export type ScanResult = "admitted" | "already-in" | "invalid" | "unpaid" | "rejected";

export type ScanLog = {
  id: string;
  orderId?: string;
  reference?: string;
  passCode?: string;
  ticketId?: string;
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
  reserveUsedAt?: number;
};

type PassPriceState = {
  early: number;
  vip: number;
  updatedAt: number;
};

type Db = {
  orders: Record<string, Order>;
  verifications: Record<string, Verification>;
  scans: ScanLog[];
  passPrices: PassPriceState;
};

const DATA_FILE = join(process.cwd(), ".data", "utopia.json");
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const SEND_WINDOW_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_WINDOW = 5;

function defaultPassPrices(): PassPriceState {
  return { ...DEFAULT_PASS_PRICES, updatedAt: 0 };
}

function normalizePassPrices(value: unknown): PassPriceState {
  const incoming = value as Partial<PassPriceState> | undefined;
  const early = Number(incoming?.early);
  const vip = Number(incoming?.vip);
  return {
    early: Number.isInteger(early) && early >= 1 ? early : DEFAULT_PASS_PRICES.early,
    vip: Number.isInteger(vip) && vip >= 1 ? vip : DEFAULT_PASS_PRICES.vip,
    updatedAt: typeof incoming?.updatedAt === "number" ? incoming.updatedAt : 0,
  };
}

function emptyDb(): Db {
  return { orders: {}, verifications: {}, scans: [], passPrices: defaultPassPrices() };
}

function load(): Db {
  try {
    if (existsSync(DATA_FILE)) {
      const parsed = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Partial<Db>;
      return {
        orders: parsed.orders ?? {},
        verifications: parsed.verifications ?? {},
        scans: Array.isArray(parsed.scans) ? parsed.scans : [],
        passPrices: normalizePassPrices(parsed.passPrices),
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
if (!db.passPrices) db.passPrices = defaultPassPrices();

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
  return {
    orders: db.orders,
    verifications: db.verifications,
    scans: db.scans,
    passPrices: db.passPrices,
  };
}

const STATUS_RANK: Record<OrderStatus, number> = {
  paid: 4,
  reserved: 3,
  rejected: 2,
  cancelled: 1,
  expired: 1,
};

function earliest(a?: number, b?: number): number | undefined {
  if (typeof a !== "number") return b;
  if (typeof b !== "number") return a;
  return Math.min(a, b);
}

/** Of two copies of the same order, the one that has travelled further. */
function fresher(local: Order, remote: Order): Order {
  const byStatus = STATUS_RANK[remote.status] - STATUS_RANK[local.status];
  if (byStatus !== 0) return byStatus > 0 ? remote : local;

  const transfers = (order: Order) => order.transferHistory?.length ?? 0;
  if (transfers(remote) !== transfers(local)) {
    return transfers(remote) > transfers(local) ? remote : local;
  }
  return remote;
}

/**
 * Entries, revoked codes and payment proof are one-way latches: once a ticket
 * has been scanned in, nothing is allowed to un-scan it.
 *
 * `persistRemote` writes the whole database as one blob, so two instances that
 * hydrate at the same time and then both write will clobber each other. Taking
 * the union of the facts that matter means the worst case is a stale price or
 * name, not a guest who gets admitted twice on the same QR.
 */
function latchOrder(base: Order, other: Order): Order {
  const merged: Order = { ...base };

  merged.enteredAt = earliest(base.enteredAt, other.enteredAt);
  merged.entryCount = Math.max(base.entryCount ?? 0, other.entryCount ?? 0) || undefined;

  if (base.tickets) {
    const twins = other.tickets ?? [];
    merged.tickets = base.tickets.map((ticket) => {
      const twin = twins.find(
        (item) => item.id === ticket.id || item.passCode === ticket.passCode,
      );
      const enteredAt = earliest(ticket.enteredAt, twin?.enteredAt);
      return enteredAt === ticket.enteredAt ? ticket : { ...ticket, enteredAt };
    });
  }

  const revoked = new Set([
    ...(base.revokedPassCodes ?? []),
    ...(other.revokedPassCodes ?? []),
  ]);
  if (revoked.size > 0) merged.revokedPassCodes = [...revoked].slice(-80);

  // A buyer uploading proof and staff deciding on it can land on different
  // instances. Losing the screenshot means asking them to upload it again.
  if (!merged.paymentProofData && other.paymentProofData) {
    merged.paymentProofData = other.paymentProofData;
    merged.paymentProofName = other.paymentProofName;
    merged.paymentProofMime = other.paymentProofMime;
  }
  merged.paidSubmittedAt = earliest(base.paidSubmittedAt, other.paidSubmittedAt);
  merged.utr ??= other.utr;
  merged.paymentRef ??= other.paymentRef;

  return merged;
}

/**
 * `obj["__proto__"] = value` reparents the object instead of adding a key, so a
 * blob with that in it would poison every object in the process. JSON.parse
 * happily produces such a key.
 */
const UNSAFE_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

function mergeRemote(remote: Partial<Db>): void {
  for (const [id, incoming] of Object.entries(remote.orders ?? {})) {
    if (UNSAFE_KEYS.has(id)) continue;
    const current = getOrderById(id);
    if (!current) {
      db.orders[id] = incoming;
      continue;
    }
    const base = fresher(current, incoming);
    db.orders[id] = latchOrder(base, base === incoming ? current : incoming);
  }
  for (const [email, incoming] of Object.entries(remote.verifications ?? {})) {
    if (UNSAFE_KEYS.has(email)) continue;
    const current = Object.hasOwn(db.verifications, email)
      ? db.verifications[email]
      : undefined;
    if (!current) {
      db.verifications[email] = incoming;
      continue;
    }
    // Newest send wins the code itself, but failed attempts and "this
    // verification already booked" only ever ratchet up. Taking the remote
    // record wholesale would hand out a fresh set of OTP guesses, or a second
    // reservation, every time the two instances disagreed.
    const base = incoming.lastSentAt >= current.lastSentAt ? incoming : current;
    const other = base === incoming ? current : incoming;
    const sameCode = base.codeHash === other.codeHash;
    db.verifications[email] = {
      ...base,
      attempts: sameCode ? Math.max(base.attempts, other.attempts) : base.attempts,
      sendCount: Math.max(base.sendCount, other.sendCount),
      verifiedAt: sameCode ? (base.verifiedAt ?? other.verifiedAt) : base.verifiedAt,
      reserveUsedAt: sameCode
        ? earliest(base.reserveUsedAt, other.reserveUsedAt)
        : base.reserveUsedAt,
    };
  }
  if (Array.isArray(remote.scans) && remote.scans.length > 0) {
    const seen = new Set(db.scans.map((scan) => scan.id));
    const extra = remote.scans.filter((scan) => !seen.has(scan.id));
    if (extra.length > 0) {
      db.scans = [...extra, ...db.scans].sort((a, b) => b.at - a.at).slice(0, 400);
    }
  }
  if (remote.passPrices) {
    const incoming = normalizePassPrices(remote.passPrices);
    if (incoming.updatedAt >= (db.passPrices?.updatedAt ?? 0)) {
      db.passPrices = incoming;
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

async function pullRemote(): Promise<void> {
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

export async function hydrateStore(): Promise<void> {
  await pullRemote();
  if (expireStaleHolds() > 0) persist();
}

export function getPassPrices(): { early: number; vip: number } {
  return {
    early: db.passPrices?.early ?? DEFAULT_PASS_PRICES.early,
    vip: db.passPrices?.vip ?? DEFAULT_PASS_PRICES.vip,
  };
}

export function getPassPrice(id: PassId): number {
  return getPassPrices()[id];
}

export function setPassPrices(input: { early: number; vip: number }): {
  early: number;
  vip: number;
} {
  db.passPrices = {
    early: input.early,
    vip: input.vip,
    updatedAt: Date.now(),
  };
  persist();
  return getPassPrices();
}

/** Has the buyer already sent us money for this hold? */
function awaitingDecision(order: Order): boolean {
  return Boolean(order.utr || order.paidSubmittedAt || order.paymentProofData);
}

/**
 * Close out holds nobody paid for. `OrderStatus` has carried "expired" from the
 * start and the CMS draws the badge off `holdExpiresAt`, but nothing ever set
 * the status — so the backend went on counting a month-old abandoned hold as
 * pending, and repricing it on every price change.
 *
 * Proof arriving un-expires it; see `attachPaymentProof`. Someone actually
 * sending money outranks a thirty-minute timer.
 */
function expireStaleHolds(now = Date.now()): number {
  let expired = 0;
  for (const order of Object.values(db.orders)) {
    if (order.status !== "reserved" || awaitingDecision(order)) continue;
    if (now <= order.holdExpiresAt) continue;
    order.status = "expired";
    expired += 1;
  }
  return expired;
}

/**
 * A hold nobody has paid yet follows the live CMS price, so the amount baked
 * into its UPI QR is the amount on the site. Once a UTR is in, or staff have
 * decided, the price is whatever they actually transferred.
 */
function repriceHold(order: Order): boolean {
  if (order.status !== "reserved" || awaitingDecision(order)) return false;

  const cart = cartFromOrder(order);
  if (cartCount(cart) < 1) return false;

  const totals = priceCart(cart, getPassPrices());
  if (totals.total === order.total && totals.unitPrice === order.unitPrice) return false;

  order.unitPrice = totals.unitPrice;
  order.subtotal = totals.subtotal;
  order.fee = totals.fee;
  order.total = totals.total;
  order.lines = totals.lines;
  return true;
}

export function repriceReservation(order: Order): boolean {
  const changed = repriceHold(order);
  if (changed) persist();
  return changed;
}

export function repriceOpenReservations(): number {
  let updated = 0;
  for (const order of Object.values(db.orders)) {
    if (repriceHold(order)) updated += 1;
  }
  if (updated > 0) persist();
  return updated;
}

function secret(): string {
  return getAuthSecret();
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
  // Sends decay with the code window, so an abandoned attempt doesn't lock the
  // address out forever. The counter has to reset with it — otherwise it only
  // ever climbs and the fifth code someone asks for is their last one, ever.
  const withinWindow = existing ? now - existing.lastSentAt < SEND_WINDOW_MS : false;

  if (existing) {
    const sinceLastSend = now - existing.lastSentAt;
    if (sinceLastSend < RESEND_COOLDOWN_MS) {
      return {
        ok: false,
        reason: "cooldown",
        retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - sinceLastSend) / 1000),
      };
    }
    if (withinWindow && existing.sendCount >= MAX_SENDS_PER_WINDOW) {
      return {
        ok: false,
        reason: "too-many",
        retryAfterSeconds: Math.ceil((existing.lastSentAt + SEND_WINDOW_MS - now) / 1000),
      };
    }
  }

  const code = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0");
  db.verifications[email] = {
    email,
    codeHash: hashCode(email, code),
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
    lastSentAt: now,
    sendCount: withinWindow ? (existing?.sendCount ?? 0) + 1 : 1,
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

export function signToken(email: string): string {
  return signPurposeToken("verify-email", email, TOKEN_TTL_MS);
}

export function verifyToken(token: string, email: string): boolean {
  return decodePurposeToken("verify-email", token)?.subject === email;
}

/** A verify-email token can open one reservation, then pay for it — not a second booking. */
export function canReserveWithToken(token: string, email: string): boolean {
  if (!verifyToken(token, email)) return false;
  const record = db.verifications[email.trim().toLowerCase()];
  return !record?.reserveUsedAt;
}

export function markEmailReserved(email: string): void {
  const record = db.verifications[email.trim().toLowerCase()];
  if (!record) return;
  record.reserveUsedAt = Date.now();
  persist();
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
  const compact = verifyCompactPassToken(token);
  if (compact) return compact;
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

/**
 * Ids reach us straight from a URL, and `db.orders` is a plain object, so
 * `db.orders["__proto__"]` hands back Object.prototype — truthy, mutable, and
 * shared by everything in the process. Every lookup goes through here.
 */
export function getOrderById(id: string): Order | undefined {
  return Object.hasOwn(db.orders, id) ? db.orders[id] : undefined;
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
    .filter((order) => order.status === "paid")
    .reduce((sum, order) => {
      return (
        sum +
        orderLines(order)
          .filter((line) => line.passId === passId)
          .reduce((lineSum, line) => lineSum + line.quantity, 0)
      );
    }, 0);
}

export function ticketsForOrder(order: Order): PassTicket[] {
  if (order.tickets && order.tickets.length > 0) return order.tickets;
  if (order.passCode) {
    return [
      {
        id: "legacy",
        passId: order.passId,
        passCode: order.passCode,
        qrToken: order.qrToken ?? "",
        enteredAt: order.enteredAt,
      },
    ];
  }
  return [];
}

export function orderHasEntry(order: Order): boolean {
  if (order.tickets?.some((ticket) => ticket.enteredAt)) return true;
  return Boolean(order.enteredAt);
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
  if (!isJpegDataUrl(proof.proofData)) {
    return { ok: false, reason: "not-found" };
  }
  // They paid late. Put the hold back in front of staff rather than telling
  // someone who has already transferred money that they are too late.
  if (order.status === "expired") order.status = "reserved";
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

function usedPassCodes(): Set<string> {
  const used = new Set<string>();
  for (const order of Object.values(db.orders)) {
    if (order.passCode) used.add(order.passCode);
    for (const ticket of order.tickets ?? []) used.add(ticket.passCode);
    for (const code of order.revokedPassCodes ?? []) used.add(code);
  }
  return used;
}

function mintUniqueCode(email: string, phone: string, salt: string, used: Set<string>): string {
  for (let i = 0; i < 48; i++) {
    const code = derivePassDigits(email, phone, `${salt}:${i}`);
    if (!used.has(code)) {
      used.add(code);
      return code;
    }
  }
  const fallback = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0");
  used.add(fallback);
  return fallback;
}

function mintPass(order: Order): void {
  const lines = orderLines(order);
  const used = usedPassCodes();
  const tickets: PassTicket[] = [];
  for (const line of lines) {
    for (let i = 0; i < line.quantity; i++) {
      const id = randomBytes(6).toString("base64url");
      const passCode = mintUniqueCode(
        order.buyer.email,
        order.buyer.phone,
        `${order.id}:${id}`,
        used,
      );
      tickets.push({
        id,
        passId: line.passId,
        passCode,
        qrToken: compactPassToken(order.id, passCode),
      });
    }
  }
  order.tickets = tickets;
  order.passCode = tickets[0]?.passCode;
  order.qrToken = tickets[0]?.qrToken;
}

/**
 * The manual analog of a payment-gateway webhook: an admin looked at proof of
 * payment outside the site and is vouching for it. When a real PG lands, its
 * webhook handler should call this exact function on success instead of
 * requiring a human to click a button — the CMS button and the webhook are
 * meant to converge on one code path, not two.
 */
export function approveOrder(id: string, decidedBy?: string): DecisionResult {
  const order = getOrderById(id);
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
  const order = getOrderById(id);
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
  const order = getOrderById(id);
  if (!order) return { ok: false, reason: "not-found" };
  if (order.status !== "paid") return { ok: false, reason: "not-paid" };
  if (orderHasEntry(order)) return { ok: false, reason: "already-entered" };

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
  const previousCodes = [
    order.passCode,
    ...(order.tickets ?? []).map((item) => item.passCode),
  ].filter((code): code is string => Boolean(code));
  const record: TransferRecord = {
    at: Date.now(),
    by: transferredBy ?? "cms",
    from: previousBuyer,
    previousPassCode: previousCodes[0],
  };

  order.buyer = next;
  order.transferredAt = record.at;
  order.transferredBy = record.by;
  order.transferHistory = [...(order.transferHistory ?? []), record].slice(-20);
  if (previousCodes.length > 0) {
    const revoked = new Set(order.revokedPassCodes ?? []);
    for (const code of previousCodes) revoked.add(code);
    order.revokedPassCodes = [...revoked].slice(-80);
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

export type ScanPassResult = {
  result: ScanResult;
  order?: Order;
  ticket?: PassTicket;
  scan: ScanLog;
};

function orderMatchesCode(order: Order, code: string): boolean {
  if (order.passCode === code) return true;
  return Boolean(order.tickets?.some((ticket) => ticket.passCode === code));
}

export function scanPass(raw: string, scannedBy: string): ScanPassResult {
  const parsed = parseScanPayload(raw);
  let order: Order | undefined;
  let ticket: PassTicket | undefined;

  if (parsed.token) {
    const decoded = verifyPassToken(parsed.token);
    if (decoded) {
      const candidate = getOrderById(decoded.orderId);
      if (candidate) {
        const match = ticketsForOrder(candidate).find(
          (item) => item.passCode === decoded.passCode,
        );
        if (match) {
          order = candidate;
          ticket = match;
        }
      }
    }
  }

  if (!order && parsed.reference) {
    const candidate = getOrderByReference(parsed.reference);
    if (candidate) {
      const tickets = ticketsForOrder(candidate);
      // Staff typing a reference means "let the next one of this group in", so
      // hand back the first unused ticket. Falling through on a group booking
      // used to report NOT A PASS, which reads like a forgery at the door.
      order = candidate;
      ticket = tickets.find((item) => !item.enteredAt) ?? tickets[0];
    }
  }

  if (!order && parsed.code) {
    const matches = Object.values(db.orders).filter((item) =>
      orderMatchesCode(item, parsed.code!),
    );
    const paid = matches.filter((item) => item.status === "paid");
    const chosen = paid.length === 1 ? paid[0] : matches.length === 1 ? matches[0] : undefined;
    if (chosen) {
      order = chosen;
      ticket = ticketsForOrder(chosen).find((item) => item.passCode === parsed.code);
    }
  }

  // A transferred or recovered pass revokes the codes it was sold under.
  // Nothing above should resolve one, but the door is the wrong place to find
  // out we were wrong about that.
  if (order && parsed.code && (order.revokedPassCodes ?? []).includes(parsed.code)) {
    order = undefined;
    ticket = undefined;
  }

  let result: ScanResult = "invalid";
  if (!order) {
    result = "invalid";
  } else if (order.status === "rejected") {
    result = "rejected";
  } else if (order.status !== "paid") {
    result = "unpaid";
  } else if (order.tickets && order.tickets.length > 0) {
    const matched = ticket;
    const live = matched
      ? order.tickets.find(
          (item) => item.id === matched.id || item.passCode === matched.passCode,
        )
      : undefined;
    if (!live) {
      result = "invalid";
    } else if (live.enteredAt) {
      result = "already-in";
      order.entryCount = (order.entryCount ?? 1) + 1;
    } else {
      result = "admitted";
      live.enteredAt = Date.now();
      order.entryCount = (order.entryCount ?? 0) + 1;
      if (order.tickets.every((item) => item.enteredAt)) {
        order.enteredAt = live.enteredAt;
      }
      ticket = live;
    }
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
    passCode: ticket?.passCode ?? order?.passCode ?? parsed.code,
    ticketId: ticket?.id,
    name: order?.buyer.name,
    email: order?.buyer.email,
    result,
    payload: raw.slice(0, 48).replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]"),
    at: Date.now(),
    by: scannedBy,
    firstEntry: result === "admitted",
  };
  if (!Array.isArray(db.scans)) db.scans = [];
  db.scans.unshift(scan);
  persist();
  return { result, order, ticket, scan };
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
  exp?: number;
  lines?: OrderLine[];
  tickets?: Array<{
    id: string;
    passId: PassId;
    passCode: string;
    enteredAt?: number;
  }>;
};

function restoreTickets(
  orderId: string,
  tickets?: WalletPass["tickets"],
): PassTicket[] | undefined {
  if (!tickets || tickets.length === 0) return undefined;
  return tickets.map((ticket) => ({
    ...ticket,
    qrToken: compactPassToken(orderId, ticket.passCode),
  }));
}

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
    lines: order.lines,
    tickets: order.tickets?.map(({ id, passId, passCode, enteredAt }) => ({
      id,
      passId,
      passCode,
      enteredAt,
    })),
  };
}

const CLAIM_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function signPassClaim(order: Order): string {
  const payload = { ...toWalletPass(order), exp: Date.now() + CLAIM_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
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
    if (typeof parsed.exp !== "number" || Date.now() >= parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function importWalletPass(pass: WalletPass): Order | null {
  const email = pass.email.trim().toLowerCase();
  const existing =
    getOrderById(pass.id) ??
    getOrderByReference(pass.reference) ??
    Object.values(db.orders).find(
      (order) =>
        order.buyer.email === email &&
        Boolean(pass.passCode) &&
        orderMatchesCode(order, pass.passCode!),
    );

  if (existing) {
    if (existing.status === "paid" && existing.buyer.email !== email) {
      return null;
    }
    return existing;
  }

  if (pass.status !== "paid") return null;

  // `unitPrice` is per pass, not per order. Storing the total here made the CMS
  // report a group booking's revenue as total × quantity.
  const quantity = Math.max(1, pass.quantity);
  const order: Order = {
    id: pass.id || randomBytes(12).toString("base64url"),
    reference: pass.reference,
    passId: pass.passId,
    quantity,
    unitPrice: Math.round(pass.total / quantity),
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
    lines: pass.lines,
    tickets: restoreTickets(pass.id, pass.tickets),
  };
  if (order.status === "paid" && !order.passCode) mintPass(order);
  db.orders[order.id] = order;
  persist();
  return order;
}

export function recoverPaidPass(input: {
  email: string;
  phone: string;
  passCode: string;
  reference?: string;
}): { ok: true; order: Order } | { ok: false; reason: "code-mismatch" } {
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.replace(/\D/g, "");
  const passCode = input.passCode.replace(/\D/g, "");
  const ref = input.reference?.trim().toUpperCase();

  const revoked = Object.values(db.orders).some((order) =>
    (order.revokedPassCodes ?? []).includes(passCode),
  );
  if (revoked) return { ok: false, reason: "code-mismatch" };

  const matches = Object.values(db.orders).filter((order) => {
    if (order.status !== "paid") return false;
    if (order.buyer.email !== email) return false;
    if (!orderMatchesCode(order, passCode)) return false;
    if (order.buyer.phone.replace(/\D/g, "") !== phone) return false;
    if (ref && order.reference !== ref) return false;
    return true;
  });

  if (matches.length !== 1) return { ok: false, reason: "code-mismatch" };
  return { ok: true, order: matches[0] };
}

/** CMS list/detail JSON — never ship the screenshot blob or live QR HMAC. */
export function toStaffOrder(order: Order) {
  const rest = { ...order };
  delete rest.paymentProofData;
  delete rest.qrToken;
  return {
    ...rest,
    tickets: order.tickets?.map(({ id, passId, passCode, enteredAt }) => ({
      id,
      passId,
      passCode,
      enteredAt,
    })),
    hasPaymentProof: Boolean(order.paymentProofData),
  };
}
