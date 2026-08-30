/** Deep links into popular UPI apps. Amount and VPA always come from the reservation. */

export type UpiApp = {
  id: "fampay" | "phonepe" | "gpay" | "paytm";
  label: string;
  color: string;
  scheme: string;
};

export const UPI_APPS: UpiApp[] = [
  { id: "fampay", label: "FAMPAY", color: "#ff7a3c", scheme: "upi://pay" },
  { id: "phonepe", label: "PHONEPE", color: "#5f259f", scheme: "phonepe://pay" },
  { id: "gpay", label: "GPAY", color: "#1a73e8", scheme: "tez://upi/pay" },
  { id: "paytm", label: "PAYTM", color: "#00b9f5", scheme: "paytmmp://pay" },
];

export function upiPayQuery(
  vpa: string,
  payeeName: string,
  amount: number,
  note: string,
): string {
  const params = new URLSearchParams({
    pa: vpa,
    pn: payeeName,
    am: amount.toFixed(2),
    cu: "INR",
    tn: note.slice(0, 50),
  });
  return params.toString();
}

export function upiAppHref(
  app: UpiApp,
  vpa: string,
  payeeName: string,
  amount: number,
  note: string,
): string {
  return `${app.scheme}?${upiPayQuery(vpa, payeeName, amount, note)}`;
}
