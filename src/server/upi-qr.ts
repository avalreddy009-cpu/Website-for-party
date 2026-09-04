import { qrDataUrl } from "./pass-code";
import { buildUpiUri, getUpiConfig } from "./upi";

export type UpiPayment = {
  configured: boolean;
  vpa: string;
  payeeName: string;
  amount: number;
  upiUri: string | null;
  upiQr?: string;
};

/**
 * Everything the browser needs to show one UPI collect request. Checkout and the
 * CMS price editor both render this, and both need the QR to be built from the
 * same amount the server is charging rather than one the client passed in.
 */
export async function renderUpiPayment(amount: number, note: string): Promise<UpiPayment> {
  const { configured, vpa, payeeName } = getUpiConfig();
  const upiUri = buildUpiUri(amount, note);

  let upiQr: string | undefined;
  if (upiUri) {
    try {
      upiQr = await qrDataUrl(upiUri);
    } catch (error) {
      console.error("[utopia] UPI QR render failed", error);
    }
  }

  return { configured, vpa, payeeName, amount, upiUri, upiQr };
}
