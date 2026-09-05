/**
 * UPI collect-request builder. We never take a card on this site: the buyer
 * pays in their own UPI app, then an admin confirms the credit. Amounts are
 * always the server-priced total, never a number the browser invented.
 */

export type UpiConfig = {
  vpa: string;
  payeeName: string;
  configured: boolean;
};

export function getUpiConfig(): UpiConfig {
  const vpa = (process.env.UPI_VPA ?? "").trim();
  const payeeName = (process.env.UPI_PAYEE_NAME ?? "AVION Productions").trim();
  const configured = Boolean(vpa);

  if (!configured && process.env.NODE_ENV !== "production") {
    return {
      vpa: "utopia@upi",
      payeeName,
      configured: true,
    };
  }

  return { vpa, payeeName, configured };
}

export function buildUpiUri(amount: number, note: string): string | null {
  const { vpa, payeeName, configured } = getUpiConfig();
  if (!configured || !vpa) return null;

  const params = new URLSearchParams({
    pa: vpa,
    pn: payeeName,
    am: amount.toFixed(2),
    cu: "INR",
  });
  const payNote = note.trim().slice(0, 50);
  if (payNote) params.set("tn", payNote);
  return `upi://pay?${params.toString()}`;
}
