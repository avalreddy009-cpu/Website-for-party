/**
 * Everything the door might be handed: a QR payload, a URL from an old email,
 * a reservation reference, or six digits typed by staff.
 */

const DOOR_CODE = /^\d{6}$/;
const ORDER_REF = /^UTP-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
/** `orderId.passCode.signature` — see compactPassToken on the server. */
const PASS_TOKEN = /^[A-Za-z0-9_-]+\.\d{6}\.[A-Za-z0-9_-]{16,64}$/;

export type ScanPayload = { token?: string; code?: string; reference?: string };

export function parseScanPayload(raw: string): ScanPayload {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  if (DOOR_CODE.test(trimmed)) return { code: trimmed };
  if (ORDER_REF.test(trimmed)) return { reference: trimmed.toUpperCase() };

  try {
    const fromUrl = new URL(trimmed).searchParams.get("p");
    if (fromUrl) return { token: fromUrl };
  } catch {
    // Not a URL. Keep going.
  }

  const parts = trimmed.split("|");
  if (parts[0] === "UTP") {
    // Current shape is UTP|code|token. Passes emailed before the payload was
    // shortened carry the buyer's name in between, so both still parse.
    if (parts.length >= 4 && DOOR_CODE.test(parts[2] ?? "")) {
      return { code: parts[2], token: parts.slice(3).join("|") };
    }
    if (DOOR_CODE.test(parts[1] ?? "")) {
      return { code: parts[1], token: parts.slice(2).join("|") };
    }
    return { token: parts.slice(1).join("|") };
  }

  return { token: trimmed };
}

/**
 * What the camera is allowed to submit on its own. Deliberately stricter than
 * the manual box: a stray barcode on someone's jacket should not fire a scan,
 * and six digits picked up off a poster are not a pass.
 */
export function looksLikePassQr(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("UTP|") && trimmed.split("|").length >= 3) return true;
  if (ORDER_REF.test(trimmed)) return true;
  if (PASS_TOKEN.test(trimmed)) return true;
  try {
    return Boolean(new URL(trimmed).searchParams.get("p"));
  } catch {
    return false;
  }
}

/** Staff typing: a 6-digit door code, a reference, or a pasted QR payload. */
export function looksLikeManualPass(raw: string): boolean {
  const trimmed = raw.trim();
  if (looksLikePassQr(trimmed)) return true;
  return trimmed.replace(/\D/g, "").length === 6;
}
