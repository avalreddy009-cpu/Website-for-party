/** What the door camera is allowed to auto-submit. Random 6-digit noise is not a pass QR. */

const DOOR_CODE = /^\d{6}$/;
const ORDER_REF = /^UTP-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
const COMPACT_TOKEN = /^[A-Za-z0-9_-]+\.\d{6}\.[A-Za-z0-9_-]{16,64}$/;

export function parseScanPayload(raw: string): {
  token?: string;
  code?: string;
  reference?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  const digits = trimmed.replace(/\D/g, "");
  if (DOOR_CODE.test(trimmed) || (digits.length === 6 && trimmed.replace(/\s/g, "") === digits)) {
    return { code: digits };
  }

  if (ORDER_REF.test(trimmed)) {
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
  if (parts[0] === "UTP" && parts.length >= 3) {
    // Legacy: UTP|{name}|{code}|{token}
    if (parts.length >= 4 && DOOR_CODE.test(parts[2] ?? "")) {
      return { code: parts[2], token: parts.slice(3).join("|") };
    }
    // Compact: UTP|{code}|{token}
    if (DOOR_CODE.test(parts[1] ?? "")) {
      return { code: parts[1], token: parts.slice(2).join("|") };
    }
    return { token: parts.slice(1).join("|") };
  }

  if (COMPACT_TOKEN.test(trimmed)) return { token: trimmed };

  return { token: trimmed };
}

export function looksLikePassQr(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("UTP|") && trimmed.split("|").length >= 3) return true;
  if (ORDER_REF.test(trimmed)) return true;
  if (COMPACT_TOKEN.test(trimmed)) return true;
  try {
    const url = new URL(trimmed);
    return Boolean(url.searchParams.get("p"));
  } catch {
    return false;
  }
}

/** Staff typing: 6-digit door code, reservation ref, or a full QR payload. */
export function looksLikeManualPass(raw: string): boolean {
  const trimmed = raw.trim();
  if (looksLikePassQr(trimmed)) return true;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length === 6;
}
