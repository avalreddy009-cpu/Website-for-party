import { getPassById, type PassId } from "./passes";

export type Totals = {
  unitPrice: number;
  subtotal: number;
  fee: number;
  total: number;
};

/** Single source of truth for money, used by both the UI and the API. */
export function priceOrder(
  passId: PassId,
  quantity: number,
  unitPrice = getPassById(passId).price,
): Totals {
  const subtotal = unitPrice * quantity;
  return { unitPrice, subtotal, fee: 0, total: subtotal };
}
