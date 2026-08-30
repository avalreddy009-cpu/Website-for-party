/** What the door camera is allowed to auto-submit. Random 6-digit noise is not a pass QR. */
export function looksLikePassQr(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("UTP|") && trimmed.split("|").length >= 4) return true;
  if (/^UTP-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(trimmed)) return true;
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
