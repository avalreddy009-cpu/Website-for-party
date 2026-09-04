import { MAX_QUANTITY, getPassById, type PassId, type PassPriceTable } from "./passes";

export type CartQty = { early: number; vip: number };

export type OrderLine = {
  passId: PassId;
  quantity: number;
  unitPrice: number;
};

export function cartCount(cart: CartQty): number {
  return cart.early + cart.vip;
}

export function seedCart(passId: PassId): CartQty {
  return passId === "vip" ? { early: 0, vip: 1 } : { early: 1, vip: 0 };
}

export function primaryPassId(cart: CartQty, fallback: PassId = "early"): PassId {
  if (cart.vip > 0 && cart.early === 0) return "vip";
  if (cart.early > 0 && cart.vip === 0) return "early";
  if (cart.vip > cart.early) return "vip";
  if (cart.early > cart.vip) return "early";
  return fallback;
}

export function linesFromCart(cart: CartQty, prices: PassPriceTable): OrderLine[] {
  const lines: OrderLine[] = [];
  if (cart.early > 0) {
    lines.push({ passId: "early", quantity: cart.early, unitPrice: prices.early });
  }
  if (cart.vip > 0) {
    lines.push({ passId: "vip", quantity: cart.vip, unitPrice: prices.vip });
  }
  return lines;
}

export function orderLines(order: {
  passId: PassId;
  quantity: number;
  unitPrice: number;
  lines?: OrderLine[];
}): OrderLine[] {
  if (order.lines && order.lines.length > 0) return order.lines;
  return [{ passId: order.passId, quantity: order.quantity, unitPrice: order.unitPrice }];
}

export function cartFromOrder(order: {
  passId: PassId;
  quantity: number;
  unitPrice: number;
  lines?: OrderLine[];
}): CartQty {
  const lines = orderLines(order);
  return {
    early: lines
      .filter((line) => line.passId === "early")
      .reduce((sum, line) => sum + line.quantity, 0),
    vip: lines
      .filter((line) => line.passId === "vip")
      .reduce((sum, line) => sum + line.quantity, 0),
  };
}

export function formatCartLabel(lines: OrderLine[]): string {
  if (lines.length === 0) return "No passes";
  return lines.map((line) => `${line.quantity} × ${getPassById(line.passId).name}`).join(" + ");
}

export function cartFromUnknown(input: {
  early?: number;
  vip?: number;
  passId?: PassId;
  quantity?: number;
}): CartQty {
  if (typeof input.early === "number" || typeof input.vip === "number") {
    return {
      early: Math.max(0, input.early ?? 0),
      vip: Math.max(0, input.vip ?? 0),
    };
  }
  if (input.passId && typeof input.quantity === "number") {
    return input.passId === "vip"
      ? { early: 0, vip: input.quantity }
      : { early: input.quantity, vip: 0 };
  }
  return { early: 0, vip: 0 };
}

export function setCartQty(cart: CartQty, id: PassId, quantity: number): CartQty {
  const next: CartQty = {
    early: id === "early" ? Math.max(0, quantity) : cart.early,
    vip: id === "vip" ? Math.max(0, quantity) : cart.vip,
  };
  const total = cartCount(next);
  if (total < 1 || total > MAX_QUANTITY) return cart;
  return next;
}
