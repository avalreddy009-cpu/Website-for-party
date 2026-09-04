import { PASSES, type PassId } from "./passes";
import { orderLines } from "./cart";
import type { Order, OrderStatus } from "@/server/store";

export type OrderStats = {
  total: number;
  pending: number;
  paid: number;
  rejected: number;
  revenue: number;
  byPass: Record<PassId, { sold: number; revenue: number }>;
};

/** Pure aggregation so the admin API route and any future report can share it. */
export function summarizeOrders(orders: Order[]): OrderStats {
  const byPass = Object.fromEntries(
    PASSES.map((pass) => [pass.id, { sold: 0, revenue: 0 }]),
  ) as OrderStats["byPass"];

  const stats: OrderStats = {
    total: orders.length,
    pending: 0,
    paid: 0,
    rejected: 0,
    revenue: 0,
    byPass,
  };

  for (const order of orders) {
    if (order.status === "reserved") stats.pending += 1;
    if (order.status === "rejected") stats.rejected += 1;
    if (order.status !== "paid") continue;

    stats.paid += 1;
    stats.revenue += order.total;
    for (const line of orderLines(order)) {
      // An order imported from an old shape can carry a pass id we no longer
      // sell. Counting it into a missing bucket used to throw and take the
      // whole CMS dashboard down with it.
      const bucket = byPass[line.passId];
      if (!bucket) continue;
      bucket.sold += line.quantity;
      bucket.revenue += line.unitPrice * line.quantity;
    }
  }

  return stats;
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  reserved: "PENDING",
  paid: "APPROVED",
  rejected: "REJECTED",
  cancelled: "CANCELLED",
  expired: "EXPIRED",
};
