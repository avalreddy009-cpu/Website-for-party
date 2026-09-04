import { createHmac, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";

import { siteUrl } from "@/lib/site";
import { getAuthSecret } from "./secret";
import type { Order } from "./store";

function secret(): string {
  return getAuthSecret();
}

/**
 * Six digits derived from email + phone via HMAC, not a substring of either.
 * Guessing someone's phone doesn't get you their pass code; you also need
 * AUTH_SECRET, which never leaves the server.
 */
export function derivePassDigits(email: string, phone: string, orderId?: string): string {
  const digest = createHmac("sha256", secret())
    .update(
      `pass-digits:${email.trim().toLowerCase()}:${phone.replace(/\D/g, "")}:${orderId ?? ""}`,
    )
    .digest();
  const n = digest.readUInt32BE(0) % 1_000_000;
  return String(n).padStart(6, "0");
}

/**
 * 22 base64url chars is ~130 bits of the HMAC, which is far more than anyone is
 * brute-forcing through a rate-limited door endpoint, and short enough that the
 * QR stays readable from a phone screen at arm's length.
 */
const SIGNATURE_CHARS = 22;

/**
 * `orderId.passCode.signature`. Deliberately not an expiring token: the door
 * only admits codes that match a paid order in the store, and a transfer
 * revokes the old code, so the signature is about forgery rather than lifetime.
 */
export function compactPassToken(orderId: string, passCode: string): string {
  const signature = createHmac("sha256", secret())
    .update(`pass-qr:${orderId}:${passCode}`)
    .digest("base64url")
    .slice(0, SIGNATURE_CHARS);
  return `${orderId}.${passCode}.${signature}`;
}

export function verifyCompactPassToken(
  token: string,
): { orderId: string; passCode: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [orderId, passCode, signature] = parts;
  if (!orderId || !/^\d{6}$/.test(passCode)) return null;

  const expected = Buffer.from(compactPassToken(orderId, passCode).split(".")[2]);
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  return { orderId, passCode };
}

/** What the QR actually encodes: a signed token the door panel can verify. */
export function passQrPayload(
  order: Order,
  ticket?: { passCode?: string; qrToken?: string },
): string {
  const code = ticket?.passCode ?? order.passCode ?? "";
  const token = code
    ? compactPassToken(order.id, code)
    : (ticket?.qrToken ?? order.qrToken ?? "");
  return `UTP|${code}|${token}`;
}

export function passQrPageUrl(order: Order): string {
  const code = order.passCode ?? "";
  const token = code ? compactPassToken(order.id, code) : (order.qrToken ?? "");
  return `${siteUrl()}/door?p=${encodeURIComponent(token)}`;
}

const QR_RENDER = {
  width: 512,
  margin: 2,
  errorCorrectionLevel: "H" as const,
  color: { dark: "#030307", light: "#ffffff" },
};

export async function qrPngBuffer(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    type: "png",
    ...QR_RENDER,
  });
}

export async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, QR_RENDER);
}
