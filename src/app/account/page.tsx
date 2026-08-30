"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Ticket } from "lucide-react";

import { BackgroundFX } from "@/components/BackgroundFX";
import { Navbar } from "@/components/Navbar";
import { EVENT, formatPrice } from "@/lib/event";
import { STATUS_LABEL } from "@/lib/order-stats";
import { getPassById, type PassId } from "@/lib/passes";
import type { OrderStatus } from "@/server/store";

type AccountOrder = {
  reference: string;
  passId: PassId;
  quantity: number;
  total: number;
  status: OrderStatus;
  createdAt: number;
  passCode?: string;
  enteredAt?: number;
  utr?: string;
};

const TONE: Record<string, string> = {
  reserved: "#7d8bff",
  paid: "#4ade80",
  rejected: "#ff3b3b",
  cancelled: "#8c8fa8",
  expired: "#8c8fa8",
};

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [orders, setOrders] = useState<AccountOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/account/orders");
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Couldn't load your passes.");
        return;
      }
      setEmail(data.email);
      setOrders(data.orders);
    } catch {
      setError("No connection. Try refreshing.");
    }
  }, [router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/account/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <>
      <BackgroundFX />
      <Navbar />
      <main className="relative mx-auto w-full max-w-3xl flex-1 px-5 pt-28 pb-16 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-[9px] tracking-[0.32em] text-electric-200/70 uppercase">
              {EVENT.name} · GUEST
            </p>
            <h1 className="font-display mt-2 text-3xl font-light text-bone sm:text-4xl">
              Your passes
            </h1>
            <p className="mt-2 text-xs text-bone/45">
              {email ?? "Loading…"} — this is only what you bought. Staff CMS is a different door.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            className="flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 font-mono text-[9px] tracking-[0.22em] text-bone/60 uppercase hover:border-signal/50 hover:text-signal-soft disabled:opacity-50"
          >
            <LogOut className="size-3.5" />
            {signingOut ? "SIGNING OUT…" : "SIGN OUT"}
          </button>
        </div>

        {error && (
          <p className="mt-6 rounded-xl border border-signal/35 bg-signal/8 px-4 py-3 text-[12px] text-signal-soft">
            {error}
          </p>
        )}

        <div className="mt-8 space-y-3">
          {orders === null && !error && (
            <p className="font-mono text-[10px] tracking-[0.2em] text-bone/35 uppercase">
              LOADING…
            </p>
          )}
          {orders && orders.length === 0 && (
            <div className="glass rounded-2xl px-6 py-12 text-center">
              <p className="font-mono text-[10px] tracking-[0.2em] text-bone/35 uppercase">
                NO PASSES ON THIS EMAIL
              </p>
              <Link
                href="/#passes"
                className="mt-4 inline-block font-mono text-[10px] tracking-[0.2em] text-electric-200 uppercase"
              >
                BUY A PASS
              </Link>
            </div>
          )}
          {orders?.map((order) => {
            const pass = getPassById(order.passId);
            const tone = TONE[order.status] ?? "#8c8fa8";
            return (
              <div key={order.reference} className="glass rounded-2xl p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-mono text-sm tracking-[0.08em] text-bone">
                    {order.reference}
                  </span>
                  <span
                    className="rounded-full px-2.5 py-1 font-mono text-[8px] font-bold tracking-[0.18em] uppercase"
                    style={{ color: tone, border: `1px solid ${tone}55`, background: `${tone}14` }}
                  >
                    {STATUS_LABEL[order.status]}
                  </span>
                </div>
                <p className="mt-3 flex items-center gap-2 text-sm text-bone/70">
                  <Ticket className="size-3.5 text-bone/35" />
                  {order.quantity} × {pass.name} · {formatPrice(order.total)}
                </p>
                {order.passCode && (
                  <p className="mt-2 font-mono text-lg tracking-[0.28em] text-bone">
                    {order.passCode}
                  </p>
                )}
                {order.status === "reserved" && (
                  <p className="mt-2 text-xs text-bone/45">
                    Payment is with us. Once it&apos;s confirmed, the door code lands here and in
                    your email.
                  </p>
                )}
                {order.enteredAt && (
                  <p className="mt-2 font-mono text-[9px] tracking-[0.16em] text-bone/35 uppercase">
                    SCANNED IN
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
