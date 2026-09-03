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
    if (order.status === "paid") {
      stats.paid += 1;
      stats.revenue += order.total;
      const lines = orderLines(order);
      const lineTotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
      for (const line of lines) {
        const slice = line.unitPrice * line.quantity;
        byPass[line.passId].sold += line.quantity;
        byPass[line.passId].revenue += lineTotal > 0 ? slice : 0;
      }
    }
    if (order.status === "rejected") stats.rejected += 1;
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
