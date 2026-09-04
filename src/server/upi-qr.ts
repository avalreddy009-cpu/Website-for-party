import { qrDataUrl } from "./pass-code";
import { buildUpiUri, getUpiConfig } from "./upi";

export type UpiPaymentVisual = {
  configured: boolean;
  vpa: string;
  payeeName: string;
  amount: number;
  upiUri: string | null;
  upiQr?: string;
};

export async function renderUpiPayment(amount: number, note: string): Promise<UpiPaymentVisual> {
  const upi = getUpiConfig();
  const upiUri = buildUpiUri(amount, note);
  let upiQr: string | undefined;
  if (upiUri) {
    try {
      upiQr = await qrDataUrl(upiUri);
    } catch (error) {
      console.error("[utopia] UPI QR render failed", error);
    }
  }
  return {
    configured: upi.configured,
    vpa: upi.vpa,
    payeeName: upi.payeeName,
    amount,
    upiUri,
    upiQr,
  };
}
