import { NextResponse } from "next/server";

import { formatCartLabel, orderLines } from "@/lib/cart";
import { passQrPayload, qrDataUrl } from "@/server/pass-code";
import { getBuyerSession } from "@/server/admin-session";
import { readPassWallet } from "@/server/pass-wallet";
import { hydrateStore, importWalletPass, listOrdersByEmail, ticketsForOrder, type Order } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mergeOrders(storeOrders: Order[], wallet: Order[]): Order[] {
  const byRef = new Map<string, Order>();
  for (const order of [...wallet, ...storeOrders]) {
    const current = byRef.get(order.reference);
    if (!current || (order.status === "paid" && current.status !== "paid")) {
      byRef.set(order.reference, order);
    }
  }
  return [...byRef.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export async function GET() {
  await hydrateStore();
  const session = await getBuyerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const wallet = await readPassWallet(session.email);
  const fromWallet = wallet
    .map((pass) => importWalletPass(pass))
    .filter((order): order is Order => Boolean(order));
  const owned = (order: Order) => order.buyer.email === session.email;
  const orders = mergeOrders(
    listOrdersByEmail(session.email),
    fromWallet.filter(owned),
  ).filter(owned);

  const payload = await Promise.all(
    orders.map(async (order) => {
      const tickets =
        order.status === "paid"
          ? await Promise.all(
              ticketsForOrder(order).map(async (ticket) => {
                let passQr: string | undefined;
                try {
                  passQr = await qrDataUrl(passQrPayload(order, ticket));
                } catch {
                  passQr = undefined;
                }
                return {
                  id: ticket.id,
                  passId: ticket.passId,
                  passCode: ticket.passCode,
                  enteredAt: ticket.enteredAt,
                  passQr,
                };
              }),
            )
          : [];
      const first = tickets[0];
      return {
        reference: order.reference,
        passId: order.passId,
        quantity: order.quantity,
        total: order.total,
        status: order.status,
        createdAt: order.createdAt,
        label: formatCartLabel(orderLines(order)),
        passCode: first?.passCode,
        enteredAt: order.enteredAt,
        utr: order.utr,
        passQr: first?.passQr,
        tickets,
      };
    }),
  );

  return NextResponse.json({ email: session.email, orders: payload });
}
