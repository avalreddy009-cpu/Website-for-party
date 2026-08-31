import { createHmac } from "node:crypto";
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

/** What the QR actually encodes: a signed token the door panel can verify. */
export function passQrPayload(order: Order): string {
  const token = order.qrToken ?? "";
  const name = order.buyer.name.replace(/\|/g, " ").slice(0, 60);
  const code = order.passCode ?? "";
  return `UTP|${name}|${code}|${token}`;
}

export function passQrPageUrl(order: Order): string {
  return `${siteUrl()}/door?p=${encodeURIComponent(order.qrToken ?? "")}`;
}

export async function qrPngBuffer(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    type: "png",
    width: 480,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#030307", light: "#ffffff" },
  });
}

export async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 480,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#030307", light: "#ffffff" },
  });
}
