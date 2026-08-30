"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Clock3,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Ticket,
  User,
  X,
} from "lucide-react";

import { formatPrice } from "@/lib/event";
import { STATUS_LABEL, type OrderStats } from "@/lib/order-stats";
import { getPassById } from "@/lib/passes";
import { useNow } from "@/lib/useNow";
import type { Order, OrderStatus } from "@/server/store";

const EASE = [0.16, 1, 0.3, 1] as const;

const TABS: { id: "all" | OrderStatus; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "reserved", label: "PENDING" },
  { id: "paid", label: "APPROVED" },
  { id: "rejected", label: "REJECTED" },
];

const STATUS_TONE: Record<OrderStatus, string> = {
  reserved: "#7d8bff",
  paid: "#4ade80",
  rejected: "#ff3b3b",
  cancelled: "#8c8fa8",
  expired: "#8c8fa8",
};

export default function AdminDashboard() {
  const now = useNow();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("reserved");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/orders");
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Couldn't load orders.");
        return;
      }
      setOrders(data.orders);
      setStats(data.stats);
    } catch {
      setError("No connection. Try refreshing.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const filtered = useMemo(() => {
    if (!orders) return [];
    if (tab === "all") return orders;
    return orders.filter((order) => order.status === tab);
  }, [orders, tab]);

  const decide = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/orders/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "reject" ? JSON.stringify({ reason: reason.trim() || undefined }) : undefined,
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "That didn't go through.");
        return;
      }
      setOrders((prev) =>
        prev ? prev.map((order) => (order.id === id ? data.order : order)) : prev,
      );
      setRejectingId(null);
      setReason("");
      // Stats aggregate across the whole list, so pull a fresh copy.
      void load();
    } catch {
      setError("No connection. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex-1">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[9px] tracking-[0.32em] text-electric-200/70 uppercase">
            PASS VERIFICATION
          </p>
          <h1 className="font-display mt-2 text-3xl font-light text-bone sm:text-4xl">
            Reservations
          </h1>
          <p className="mt-2 max-w-lg text-xs leading-relaxed text-bone/45">
            Match a UPI credit against a reservation, then approve. Approving
            emails the pass QR. The door panel at /door is a separate 12-word
            phrase so scanner staff can&apos;t clear payments.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-full border border-white/12 px-4 py-2.5 font-mono text-[9px] tracking-[0.22em] text-bone/60 uppercase transition-all duration-300 hover:border-electric-300/50 hover:text-electric-200 disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
          REFRESH
        </button>
      </div>

      {stats && (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="TOTAL ORDERS" value={String(stats.total)} />
          <StatCard label="PENDING" value={String(stats.pending)} accent="#7d8bff" />
          <StatCard label="APPROVED" value={String(stats.paid)} accent="#4ade80" />
          <StatCard label="REVENUE (APPROVED)" value={formatPrice(stats.revenue)} accent="#9aa4ff" />
        </div>
      )}

      <div className="mt-8 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`shrink-0 rounded-full border px-4 py-2 font-mono text-[9px] tracking-[0.22em] uppercase transition-all duration-300 ${
              tab === item.id
                ? "border-electric-300/60 bg-electric-500/12 text-bone"
                : "border-white/10 text-bone/45 hover:border-white/25 hover:text-bone/80"
            }`}
          >
            {item.label}
            {orders && (
              <span className="ml-1.5 text-bone/30">
                {item.id === "all"
                  ? orders.length
                  : orders.filter((o) => o.status === item.id).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5 flex items-start gap-2.5 rounded-xl border border-signal/35 bg-signal/8 px-4 py-3 text-[12px] leading-relaxed text-signal-soft"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="mt-6 space-y-3">
        {!orders && !error && (
          <div className="flex items-center justify-center gap-2.5 py-16 font-mono text-[10px] tracking-[0.2em] text-bone/35 uppercase">
            <Loader2 className="size-4 animate-spin" />
            LOADING RESERVATIONS
          </div>
        )}

        {orders && filtered.length === 0 && (
          <div className="glass rounded-2xl px-6 py-14 text-center font-mono text-[10px] tracking-[0.2em] text-bone/35 uppercase">
            NOTHING HERE
          </div>
        )}

        {filtered.map((order, i) => (
          <OrderRow
            key={order.id}
            order={order}
            index={i}
            now={now}
            busy={busyId === order.id}
            rejecting={rejectingId === order.id}
            reason={reason}
            onReasonChange={setReason}
            onApprove={() => void decide(order.id, "approve")}
            onStartReject={() => {
              setRejectingId(order.id);
              setReason("");
            }}
            onCancelReject={() => {
              setRejectingId(null);
              setReason("");
            }}
            onConfirmReject={() => void decide(order.id, "reject")}
          />
        ))}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="glass rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
      <p className="font-mono text-[8px] tracking-[0.22em] text-bone/35 uppercase">
        {label}
      </p>
      <p
        className="font-display mt-1.5 text-2xl font-light tabular-nums sm:text-3xl"
        style={{ color: accent ?? "#f4f4f8" }}
      >
        {value}
      </p>
    </div>
  );
}

function formatRelative(ms: number, now: number): string {
  if (!now) return "";
  const diff = Math.round((ms - now) / 1000);
  const abs = Math.abs(diff);
  const unit =
    abs < 60
      ? [abs, "s"]
      : abs < 3600
        ? [Math.round(abs / 60), "m"]
        : abs < 86400
          ? [Math.round(abs / 3600), "h"]
          : [Math.round(abs / 86400), "d"];
  return diff >= 0 ? `in ${unit[0]}${unit[1]}` : `${unit[0]}${unit[1]} ago`;
}

type OrderRowProps = {
  order: Order;
  index: number;
  now: number;
  busy: boolean;
  rejecting: boolean;
  reason: string;
  onReasonChange: (value: string) => void;
  onApprove: () => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onConfirmReject: () => void;
};

function OrderRow({
  order,
  index,
  now,
  busy,
  rejecting,
  reason,
  onReasonChange,
  onApprove,
  onStartReject,
  onCancelReject,
  onConfirmReject,
}: OrderRowProps) {
  const pass = getPassById(order.passId);
  const tone = STATUS_TONE[order.status];
  const isPending = order.status === "reserved";
  const holdExpired = isPending && now > 0 && now > order.holdExpiresAt;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index, 8) * 0.03, ease: EASE }}
      className="glass relative overflow-hidden rounded-2xl p-5 sm:p-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(to right, transparent, ${tone}, transparent)` }}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-sm tracking-[0.08em] text-bone">
              {order.reference}
            </span>
            <span
              className="rounded-full px-2.5 py-1 font-mono text-[8px] font-bold tracking-[0.18em] uppercase"
              style={{ color: tone, border: `1px solid ${tone}55`, background: `${tone}14` }}
            >
              {STATUS_LABEL[order.status]}
            </span>
            {holdExpired && (
              <span className="rounded-full border border-signal/40 bg-signal/10 px-2.5 py-1 font-mono text-[8px] font-bold tracking-[0.18em] text-signal-soft uppercase">
                HOLD EXPIRED
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-bone/70">
            <span className="flex items-center gap-1.5">
              <Ticket className="size-3.5 text-bone/35" />
              {order.quantity} × {pass.name}
            </span>
            <span className="flex items-center gap-1.5">
              <User className="size-3.5 text-bone/35" />
              {order.buyer.name}
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="size-3.5 text-bone/35" />
              {order.buyer.email}
            </span>
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5 text-bone/35" />
              {order.buyer.phone}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[9px] tracking-[0.16em] text-bone/35 uppercase">
            <span className="flex items-center gap-1.5">
              <Clock3 className="size-3 text-bone/25" />
              CREATED {formatRelative(order.createdAt, now)}
            </span>
            {isPending && (
              <span>HOLD {formatRelative(order.holdExpiresAt, now)}</span>
            )}
            {order.status === "paid" && order.decidedBy && (
              <span>APPROVED BY {order.decidedBy}</span>
            )}
            {order.status === "paid" && order.passCode && (
              <span>PASS {order.passCode}</span>
            )}
            {order.utr && <span>UTR {order.utr}</span>}
            {order.status === "rejected" && (
              <span>
                REJECTED{order.decidedBy ? ` BY ${order.decidedBy}` : ""}
                {order.rejectionReason ? ` · ${order.rejectionReason}` : ""}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <p className="font-display text-2xl font-light text-bone tabular-nums">
            {formatPrice(order.total)}
          </p>

          {isPending && !rejecting && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onStartReject}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-full border border-white/12 px-3.5 py-2 font-mono text-[9px] tracking-[0.18em] text-bone/55 uppercase transition-all duration-300 hover:border-signal/50 hover:text-signal-soft disabled:opacity-40"
              >
                <X className="size-3" />
                REJECT
              </button>
              <button
                type="button"
                onClick={onApprove}
                disabled={busy}
                className="group relative flex items-center gap-1.5 overflow-hidden rounded-full bg-bone px-4 py-2 font-mono text-[9px] font-bold tracking-[0.18em] text-void uppercase transition-transform duration-300 hover:scale-[1.03] disabled:scale-100 disabled:opacity-60"
              >
                <span className="absolute inset-0 translate-y-full bg-gradient-to-br from-electric-500 to-emerald-400 transition-transform duration-400 group-hover:translate-y-0" />
                <span className="relative flex items-center gap-1.5 transition-colors duration-300 group-hover:text-void">
                  {busy ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Check className="size-3" />
                  )}
                  APPROVE
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {rejecting && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-4 flex flex-col gap-3 border-t border-white/8 pt-4 sm:flex-row sm:items-center">
              <input
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                placeholder="Reason (optional) — shown to the buyer"
                autoFocus
                className="flex-1 rounded-xl border border-white/10 bg-white/2 px-3.5 py-2.5 text-sm text-bone placeholder:text-bone/30 focus:border-signal/50 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onCancelReject}
                  disabled={busy}
                  className="rounded-full border border-white/12 px-3.5 py-2 font-mono text-[9px] tracking-[0.18em] text-bone/55 uppercase transition-colors hover:text-bone disabled:opacity-40"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={onConfirmReject}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-full bg-signal px-4 py-2 font-mono text-[9px] font-bold tracking-[0.18em] text-void uppercase transition-transform duration-300 hover:scale-[1.03] disabled:scale-100 disabled:opacity-60"
                >
                  {busy && <Loader2 className="size-3 animate-spin" />}
                  CONFIRM REJECT
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
