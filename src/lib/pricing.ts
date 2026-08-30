import { BOOKING_FEE_RATE, getPassById, type PassId } from "./passes";

export type Totals = {
  unitPrice: number;
  subtotal: number;
  fee: number;
  total: number;
};

/** Single source of truth for money, used by both the UI and the API. */
export function priceOrder(passId: PassId, quantity: number): Totals {
  const unitPrice = getPassById(passId).price;
  const subtotal = unitPrice * quantity;
  const fee = Math.round(subtotal * BOOKING_FEE_RATE);
  return { unitPrice, subtotal, fee, total: subtotal + fee };
}
