import { cartCount, linesFromCart, primaryPassId, type CartQty } from "./cart";
import { getPassById, type PassId, type PassPriceTable } from "./passes";

export type Totals = {
  unitPrice: number;
  subtotal: number;
  fee: number;
  total: number;
};

export type CartTotals = Totals & {
  quantity: number;
  passId: PassId;
  lines: ReturnType<typeof linesFromCart>;
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

/** Standard + VIP in one order. Fee stays zero. */
export function priceCart(cart: CartQty, prices: PassPriceTable): CartTotals {
  const lines = linesFromCart(cart, prices);
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const passId = primaryPassId(cart);
  const unitPrice = prices[passId] ?? getPassById(passId).price;
  return {
    unitPrice,
    subtotal,
    fee: 0,
    total: subtotal,
    quantity: cartCount(cart),
    passId,
    lines,
  };
}
