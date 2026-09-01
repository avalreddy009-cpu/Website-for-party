"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Loader2,
  Mail,
  MapPin,
  Minus,
  Phone,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Upload,
  User,
  X,
} from "lucide-react";

import { EVENT, formatPrice } from "@/lib/event";
import {
  compressPaymentScreenshot,
  isCompleteUtr,
  normalizeUtr,
  type PaymentScreenshot,
} from "@/lib/payment-proof";
import { UPI_APPS, upiAppHref } from "@/lib/upi-apps";
import {
  MAX_QUANTITY,
  type PassId,
  type PassTier,
} from "@/lib/passes";
import { priceOrder } from "@/lib/pricing";
import { usePassCatalog } from "@/lib/usePassCatalog";
import { useNow } from "@/lib/useNow";

const EASE = [0.16, 1, 0.3, 1] as const;
const STEPS = ["PASS", "DETAILS", "VERIFY", "CONFIRM", "PAY", "DONE"] as const;

type FormState = { name: string; email: string; phone: string };
type Errors = Partial<
  Record<"name" | "email" | "phone" | "code" | "terms" | "utr" | "proof" | "form", string>
>;

const EMPTY_FORM: FormState = { name: "", email: "", phone: "" };

type ApiError = { error?: string; fields?: Record<string, string> };

async function postJson<T>(url: string, body: unknown): Promise<
  { ok: true; data: T } | { ok: false; status: number; error: string; fields?: Record<string, string> }
> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as T & ApiError;
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: payload.error ?? "Something broke on our end. Try again.",
        fields: payload.fields,
      };
    }
    return { ok: true, data: payload as T };
  } catch {
    return {
      ok: false,
      status: 0,
      error: "No connection. Check your internet and try again.",
    };
  }
}

type CheckoutModalProps = {
  open: boolean;
  pass: PassTier | null;
  /** Bumped on every "Buy pass" click so the flow remounts with fresh state. */
  sessionId: number;
  onClose: () => void;
};

export function CheckoutModal({ open, pass, sessionId, onClose }: CheckoutModalProps) {
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const [locked, setLocked] = useState(false);

  const requestClose = useCallback(() => {
    if (!locked) onClose();
  }, [locked, onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, requestClose]);

  return (
    <AnimatePresence>
      {open && pass && (
        <motion.div
          className="fixed inset-0 z-90 flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.button
            type="button"
            aria-label="Close checkout"
            onClick={requestClose}
            className="absolute inset-0 cursor-default bg-[#01010a]/85 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            ref={panelRef}
            initial={{ y: reduced ? 0 : 60, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: reduced ? 0 : 40, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.55, ease: EASE }}
            className="glass-strong relative flex max-h-[94svh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl shadow-[0_40px_120px_-40px_rgba(96,105,240,0.7)] sm:max-w-2xl sm:rounded-3xl"
          >
            <CheckoutFlow
              key={sessionId}
              initialPass={pass}
              onClose={onClose}
              onLockChange={setLocked}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* The stateful flow. Remounted per checkout session, so every open    */
/* starts from a clean slate without syncing props into state.         */
/* ------------------------------------------------------------------ */

type Reservation = {
  reference: string;
  total: number;
  holdExpiresAt: number;
  orderId?: string;
  vpa?: string;
  payeeName?: string;
  upiUri?: string | null;
  upiQr?: string;
};

function CheckoutFlow({
  initialPass,
  onClose,
  onLockChange,
}: {
  initialPass: PassTier;
  onClose: () => void;
  onLockChange: (locked: boolean) => void;
}) {
  const reduced = useReducedMotion();
  const headingId = useId();
  const now = useNow();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [tierId, setTierId] = useState<PassId>(initialPass.id);
  const [quantity, setQuantity] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [copied, setCopied] = useState(false);
  const [utr, setUtr] = useState("");
  const [proof, setProof] = useState<PaymentScreenshot | null>(null);
  const { catalog, byId } = usePassCatalog();

  const tier = byId(tierId);
  const totals = useMemo(
    () => priceOrder(tierId, quantity, tier.price),
    [tierId, quantity, tier.price],
  );

  const resendIn =
    resendAt && now ? Math.max(0, Math.ceil((resendAt - now) / 1000)) : 0;

  const setBusyState = useCallback(
    (value: boolean) => {
      setBusy(value);
      onLockChange(value);
    },
    [onLockChange],
  );

  const goTo = useCallback(
    (next: number) => {
      setDirection(next > step ? 1 : -1);
      setStep(next);
    },
    [step],
  );

  /** Details → send the code. */
  const requestCode = useCallback(
    async (isResend: boolean) => {
      setBusyState(true);
      setErrors({});
      const result = await postJson<{
        resendAfterSeconds: number;
        devCode?: string;
      }>("/api/passes/verify", { ...form, passId: tierId, quantity });
      setBusyState(false);

      if (!result.ok) {
        setErrors({ ...(result.fields as Errors), form: result.fields ? undefined : result.error });
        return;
      }

      setDevCode(result.data.devCode ?? null);
      setResendAt(Date.now() + (result.data.resendAfterSeconds ?? 45) * 1000);
      setCode("");
      if (!isResend) goTo(2);
    },
    [form, goTo, quantity, setBusyState, tierId],
  );

  /**
   * Verify → exchange the code for a signed token. The last digit typed is
   * passed in directly: the auto-submit fires from the same tick as the state
   * update, so reading `code` here would see five digits, not six.
   */
  const confirmCode = useCallback(async (override?: string) => {
    const value = (override ?? code).replace(/\D/g, "");
    if (value.length !== 6) {
      setErrors({ code: "All six digits, please." });
      return;
    }

    setBusyState(true);
    setErrors({});
    const result = await postJson<{ verificationToken: string }>(
      "/api/passes/verify/confirm",
      { email: form.email, code: value },
    );
    setBusyState(false);

    if (!result.ok) {
      // Wipe the boxes so a retry is just "type it again", not "clear it first".
      setCode("");
      setErrors({ code: result.fields?.code ?? result.error });
      return;
    }
    setToken(result.data.verificationToken);
    goTo(3);
  }, [code, form.email, goTo, setBusyState]);

  /** Confirm → create the reservation. */
  const reserve = useCallback(async () => {
    if (!agreed) {
      setErrors({ terms: "Tick the box — it's the boring but important one." });
      return;
    }
    if (!token) {
      setErrors({ form: "Your verification expired. Go back and resend the code." });
      return;
    }
    if (reservation) {
      goTo(4);
      return;
    }

    setBusyState(true);
    setErrors({});
    const result = await postJson<Reservation>("/api/passes/reserve", {
      ...form,
      passId: tierId,
      quantity,
      verificationToken: token,
    });
    setBusyState(false);

    if (!result.ok) {
      setErrors({ form: result.error });
      return;
    }
    setReservation(result.data);
    setDirection(1);
    setStep(4);
  }, [agreed, form, goTo, quantity, reservation, setBusyState, tierId, token]);

  const submitPay = useCallback(async () => {
    if (!token || !reservation) {
      setErrors({ form: "Your verification expired. Go back and resend the code." });
      return;
    }
    if (!isCompleteUtr(utr)) {
      setErrors({ utr: "Enter the 12-digit UTR from the UPI app before submitting." });
      return;
    }
    if (!proof) {
      setErrors({ proof: "Upload the payment screenshot. UTR alone isn't enough." });
      return;
    }

    setBusyState(true);
    setErrors({});
    const result = await postJson<{ reference: string; status: string }>("/api/passes/pay", {
      email: form.email,
      reference: reservation.reference,
      verificationToken: token,
      utr: normalizeUtr(utr),
      proofName: proof.name,
      proofMime: proof.mime,
      proofData: proof.dataUrl,
    });
    setBusyState(false);

    if (!result.ok) {
      setErrors({
        utr: result.fields?.utr,
        proof: result.fields?.proofData ?? result.fields?.proofName,
        form: result.fields ? undefined : result.error,
      });
      return;
    }
    setDirection(1);
    setStep(5);
  }, [form.email, proof, reservation, setBusyState, token, utr]);

  const handleNext = useCallback(() => {
    if (busy) return;
    if (step === 0) return goTo(1);
    if (step === 1) return void requestCode(false);
    if (step === 2) return void confirmCode();
    if (step === 3) return void reserve();
    if (step === 4) return void submitPay();
  }, [busy, confirmCode, goTo, requestCode, reserve, step, submitPay]);

  const copyReference = async () => {
    if (!reservation) return;
    try {
      await navigator.clipboard.writeText(reservation.reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const nextLabel = [
    "CONTINUE",
    "EMAIL ME A CODE",
    "VERIFY",
    "PAY WITH UPI",
    "SUBMIT RESERVATION",
  ][step];
  const busyLabel = ["", "SENDING CODE", "CHECKING", "RESERVING", "SUBMITTING"][step];
  const payReady = isCompleteUtr(utr) && Boolean(proof);
  const canAdvance =
    (step !== 2 || code.replace(/\D/g, "").length === 6) && (step !== 4 || payReady);

  const slide = {
    enter: (dir: number) => ({
      x: reduced ? 0 : dir * 64,
      opacity: 0,
      filter: "blur(8px)",
    }),
    center: { x: 0, opacity: 1, filter: "blur(0px)" },
    exit: (dir: number) => ({
      x: reduced ? 0 : dir * -64,
      opacity: 0,
      filter: "blur(8px)",
    }),
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(to right, transparent, ${tier.accent}, transparent)`,
        }}
      />
      <div
        aria-hidden
        className="animate-glow-pulse pointer-events-none absolute -top-32 left-1/2 size-72 -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${tier.accentSoft}, transparent 68%)`,
        }}
      />
      <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.09] mix-blend-soft-light" />

      {/* ------------------------------ header ----------------------------- */}
      <div className="relative flex items-start justify-between gap-4 border-b border-white/8 px-6 pt-6 pb-5 sm:px-8">
        <div>
          <p className="font-mono text-[9px] tracking-[0.3em] text-electric-200/70 uppercase">
            {EVENT.name} · {EVENT.shortDateLabel} · {EVENT.venueName}
          </p>
          <h2
            id={headingId}
            className="font-display mt-2 text-2xl leading-none font-light text-bone sm:text-3xl"
          >
            {step === 5 ? "You're on the list" : tier.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => !busy && onClose()}
          aria-label="Close checkout"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/12 text-bone/55 transition-all duration-300 hover:rotate-90 hover:border-bone/40 hover:text-bone"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* ----------------------------- progress ---------------------------- */}
      <div className="relative flex gap-1.5 px-6 pt-5 sm:gap-2 sm:px-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/8">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(to right, ${tier.accent}, #ffffff)`,
                }}
                initial={false}
                animate={{ width: i <= step ? "100%" : "0%" }}
                transition={{ duration: 0.6, ease: EASE }}
              />
            </div>
            <p
              className={`mt-2 font-mono text-[7px] tracking-[0.18em] uppercase transition-colors duration-500 sm:text-[9px] ${
                i <= step ? "text-bone/70" : "text-bone/25"
              }`}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* ------------------------------- body ------------------------------ */}
      <div className="relative min-h-0 flex-1 overflow-y-auto px-6 py-7 sm:px-8">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.42, ease: EASE }}
          >
            {step === 0 && (
              <StepPass
                catalog={catalog}
                tierId={tierId}
                onTierChange={setTierId}
                quantity={quantity}
                onQuantityChange={setQuantity}
                subtotal={totals.subtotal}
              />
            )}

            {step === 1 && (
              <StepDetails
                form={form}
                errors={errors}
                onChange={(key, value) => {
                  setForm((prev) => ({ ...prev, [key]: value }));
                  setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }));
                }}
                onSubmit={handleNext}
              />
            )}

            {step === 2 && (
              <StepVerify
                email={form.email}
                code={code}
                error={errors.code}
                devCode={devCode}
                resendIn={resendIn}
                busy={busy}
                onCodeChange={(value) => {
                  setCode(value);
                  setErrors((prev) => ({ ...prev, code: undefined }));
                }}
                onComplete={(value) => void confirmCode(value)}
                onResend={() => void requestCode(true)}
              />
            )}

            {step === 3 && (
              <StepConfirm
                tier={tier}
                quantity={quantity}
                form={form}
                totals={totals}
                agreed={agreed}
                error={errors.terms}
                onAgreedChange={(value) => {
                  setAgreed(value);
                  setErrors((prev) => ({ ...prev, terms: undefined }));
                }}
              />
            )}

            {step === 4 && reservation && (
              <StepPay
                tier={tier}
                reservation={reservation}
                utr={utr}
                proof={proof}
                errors={errors}
                busy={busy}
                onUtrChange={(value) => {
                  setUtr(normalizeUtr(value));
                  setErrors((prev) => ({ ...prev, utr: undefined, form: undefined }));
                }}
                onProofChange={(next) => {
                  setProof(next);
                  setErrors((prev) => ({ ...prev, proof: undefined, form: undefined }));
                }}
                onProofError={(message) => setErrors((prev) => ({ ...prev, proof: message }))}
              />
            )}

            {step === 5 && reservation && (
              <StepDone
                tier={tier}
                quantity={quantity}
                form={form}
                reservation={reservation}
                copied={copied}
                onCopy={copyReference}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {errors.form && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-5 flex items-start gap-2.5 rounded-xl border border-signal/35 bg-signal/8 px-4 py-3 text-[12px] leading-relaxed text-signal-soft"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {errors.form}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* ------------------------------ footer ----------------------------- */}
      <div className="relative border-t border-white/8 bg-black/25 px-6 py-5 sm:px-8">
        {step < 5 ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[8px] tracking-[0.24em] text-bone/35 uppercase">
                {quantity} × {tier.name}
              </p>
              <motion.p
                key={totals.total}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-display text-2xl leading-none font-light text-bone tabular-nums sm:text-3xl"
              >
                {formatPrice(totals.total)}
              </motion.p>
            </div>

            <div className="flex items-center gap-2.5">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => goTo(step - 1)}
                  disabled={busy}
                  className="flex size-11 items-center justify-center rounded-full border border-white/12 text-bone/60 transition-all duration-300 hover:border-bone/40 hover:text-bone disabled:opacity-40"
                  aria-label="Previous step"
                >
                  <ArrowLeft className="size-4" />
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                disabled={busy || !canAdvance}
                title={
                  step === 4 && !payReady
                    ? "Enter the 12-digit UTR and attach a screenshot first"
                    : undefined
                }
                className="group relative flex items-center gap-2.5 overflow-hidden rounded-full bg-bone px-6 py-3.5 font-mono text-[10px] font-bold tracking-[0.2em] text-void uppercase transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98] disabled:scale-100 disabled:opacity-50 sm:px-7"
              >
                <span
                  className="absolute inset-0 translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 group-disabled:translate-y-full"
                  style={{
                    background: `linear-gradient(135deg, ${tier.accent}, #5b4bff)`,
                  }}
                />
                <span className="relative flex items-center gap-2.5 transition-colors duration-300 group-hover:text-bone group-disabled:text-void">
                  {busy ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      {busyLabel}
                    </>
                  ) : (
                    <>
                      {nextLabel}
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <a
              href={EVENT.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 font-mono text-[9px] tracking-[0.2em] text-bone/50 uppercase transition-colors hover:text-electric-200"
            >
              <MapPin className="size-3.5" />
              {EVENT.venueName}
            </a>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full border border-white/15 px-7 py-3.5 font-mono text-[10px] font-bold tracking-[0.2em] text-bone/80 uppercase transition-all duration-300 hover:border-electric-300/60 hover:text-electric-200 sm:w-auto"
            >
              DONE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — pass + quantity                                            */
/* ------------------------------------------------------------------ */

function StepPass({
  catalog,
  tierId,
  onTierChange,
  quantity,
  onQuantityChange,
  subtotal,
}: {
  catalog: PassTier[];
  tierId: PassId;
  onTierChange: (id: PassId) => void;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  subtotal: number;
}) {
  return (
    <div className="space-y-8">
      <div>
        <StepTitle
          eyebrow="STEP 01"
          title="Which one?"
          hint="Change your mind here, it's free."
        />
        <div className="mt-5 grid gap-2.5">
          {catalog.map((option) => {
            const active = option.id === tierId;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onTierChange(option.id)}
                aria-pressed={active}
                className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border px-4 py-4 text-left transition-all duration-300"
                style={{
                  borderColor: active ? option.accentSoft : "rgba(255,255,255,0.09)",
                  background: active
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(255,255,255,0.015)",
                }}
              >
                {active && (
                  <motion.span
                    layoutId="tier-highlight"
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(110deg, ${option.accentSoft}, transparent 62%)`,
                      opacity: 0.3,
                    }}
                    transition={{ duration: 0.5, ease: EASE }}
                  />
                )}
                <span className="relative flex items-center gap-3.5">
                  <span
                    className="flex size-5 items-center justify-center rounded-full border transition-colors duration-300"
                    style={{
                      borderColor: active ? option.accent : "rgba(255,255,255,0.25)",
                      background: active ? option.accent : "transparent",
                    }}
                  >
                    {active && <Check className="size-3 text-void" strokeWidth={3.5} />}
                  </span>
                  <span>
                    <span className="font-display block text-lg leading-tight text-bone">
                      {option.name}
                    </span>
                    <span className="font-mono text-[8px] tracking-[0.22em] text-bone/40 uppercase">
                      {option.subtitle}
                    </span>
                  </span>
                </span>
                <span className="font-display relative text-xl font-light text-bone tabular-nums">
                  {formatPrice(option.price)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <StepTitle
          eyebrow="STEP 01B"
          title="How many of you?"
          hint={`Up to ${MAX_QUANTITY} per order. Bigger group? Email us.`}
        />

        <div className="mt-5 flex items-center justify-between gap-5 rounded-2xl border border-white/9 bg-white/2 px-5 py-4">
          <div className="flex items-center gap-4">
            <QtyButton
              label="Decrease quantity"
              disabled={quantity <= 1}
              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            >
              <Minus className="size-4" />
            </QtyButton>

            <div className="flex h-10 w-14 items-center justify-center overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={quantity}
                  initial={{ y: 22, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -22, opacity: 0 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  className="font-display text-4xl leading-none font-light text-bone tabular-nums"
                >
                  {String(quantity).padStart(2, "0")}
                </motion.span>
              </AnimatePresence>
            </div>

            <QtyButton
              label="Increase quantity"
              disabled={quantity >= MAX_QUANTITY}
              onClick={() => onQuantityChange(Math.min(MAX_QUANTITY, quantity + 1))}
            >
              <Plus className="size-4" />
            </QtyButton>
          </div>

          <div className="text-right">
            <p className="font-mono text-[8px] tracking-[0.22em] text-bone/35 uppercase">
              SUBTOTAL
            </p>
            <p className="font-display text-xl font-light text-bone tabular-nums sm:text-2xl">
              {formatPrice(subtotal)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function QtyButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      whileTap={disabled ? undefined : { scale: 0.88 }}
      className="flex size-10 items-center justify-center rounded-full border border-white/14 text-bone/75 transition-all duration-300 hover:border-electric-300/60 hover:text-electric-200 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/14 disabled:hover:text-bone/75"
    >
      {children}
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — details                                                    */
/* ------------------------------------------------------------------ */

function StepDetails({
  form,
  errors,
  onChange,
  onSubmit,
}: {
  form: FormState;
  errors: Errors;
  onChange: (key: keyof FormState, value: string) => void;
  onSubmit: () => void;
}) {
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => firstRef.current?.focus(), 320);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSubmit();
        }
      }}
    >
      <StepTitle
        eyebrow="STEP 02"
        title="Who's coming in?"
        hint="Name has to match whatever ID you bring."
      />

      <div className="mt-6 space-y-5">
        <Field
          ref={firstRef}
          icon={User}
          label="FULL NAME"
          placeholder="The name on your ID"
          value={form.name}
          error={errors.name}
          autoComplete="name"
          onChange={(value) => onChange("name", value)}
        />
        <Field
          icon={Mail}
          label="EMAIL"
          type="email"
          placeholder="you@somewhere.com"
          value={form.email}
          error={errors.email}
          autoComplete="email"
          onChange={(value) => onChange("email", value)}
        />
        <Field
          icon={Phone}
          label="PHONE"
          type="tel"
          placeholder="98765 43210"
          value={form.phone}
          error={errors.phone}
          autoComplete="tel"
          onChange={(value) => onChange("phone", value)}
        />
      </div>

      <div className="mt-7 flex items-start gap-3 rounded-2xl border border-electric-300/15 bg-electric-500/6 px-4 py-3.5">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-electric-300" />
        <p className="text-[11px] leading-relaxed text-bone/55">
          We email you a 6-digit code next — that&apos;s how we know the address
          is real and your pass actually reaches you. No newsletters, no resale,
          no forwarding your number to anyone.
        </p>
      </div>
    </div>
  );
}

type FieldProps = {
  icon: React.ElementType;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  autoComplete?: string;
};

function Field({
  ref,
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  error,
  autoComplete,
}: FieldProps & { ref?: React.Ref<HTMLInputElement> }) {
  const [focused, setFocused] = useState(false);

  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-3 font-mono text-[9px] tracking-[0.28em] text-bone/40 uppercase">
        {label}
        <AnimatePresence>
          {error && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-right text-[9px] tracking-normal text-signal-soft normal-case"
            >
              {error}
            </motion.span>
          )}
        </AnimatePresence>
      </span>

      <motion.div
        animate={error ? { x: [0, -7, 6, -3, 0] } : { x: 0 }}
        transition={{ duration: 0.42 }}
        className="relative flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-colors duration-300"
        style={{
          borderColor: error
            ? "rgba(255,59,59,0.6)"
            : focused
              ? "rgba(154,164,255,0.65)"
              : "rgba(255,255,255,0.1)",
          background: focused ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
          boxShadow: focused ? "0 0 32px -12px rgba(154,164,255,0.75)" : "none",
        }}
      >
        <Icon
          className={`size-4 shrink-0 transition-colors duration-300 ${
            focused ? "text-electric-200" : "text-bone/35"
          }`}
        />
        <input
          ref={ref}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent text-sm text-bone placeholder:text-bone/25 focus:outline-none"
        />
      </motion.div>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3 — email verification                                         */
/* ------------------------------------------------------------------ */

function StepVerify({
  email,
  code,
  error,
  devCode,
  resendIn,
  busy,
  onCodeChange,
  onComplete,
  onResend,
}: {
  email: string;
  code: string;
  error?: string;
  devCode: string | null;
  resendIn: number;
  busy: boolean;
  onCodeChange: (value: string) => void;
  onComplete: (value?: string) => void;
  onResend: () => void;
}) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const digits = code.padEnd(6, " ").slice(0, 6).split("");

  useEffect(() => {
    const id = window.setTimeout(() => boxes.current[0]?.focus(), 340);
    return () => window.clearTimeout(id);
  }, []);

  // A rejected code clears itself, so send the caret back to the first box.
  useEffect(() => {
    if (error) boxes.current[0]?.focus();
  }, [error]);

  const write = (next: string, focusAt?: number) => {
    const clean = next.replace(/\D/g, "").slice(0, 6);
    onCodeChange(clean);
    boxes.current[focusAt ?? Math.min(clean.length, 5)]?.focus();
    if (clean.length === 6) window.setTimeout(() => onComplete(clean), 120);
  };

  return (
    <div>
      <StepTitle
        eyebrow="STEP 03"
        title="Check your inbox"
        hint="Six digits, ten minutes, then it's dead."
      />

      <p className="mt-5 text-[13px] leading-relaxed text-bone/60">
        Sent to <span className="text-bone/90">{email}</span>. If it&apos;s not
        there in a minute, look in spam — that&apos;s where the good things go.
      </p>

      <motion.div
        animate={error ? { x: [0, -8, 7, -4, 0] } : { x: 0 }}
        transition={{ duration: 0.42 }}
        className="mt-7 flex items-center justify-between gap-2 sm:gap-3"
      >
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(element) => {
              boxes.current[i] = element;
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label={`Digit ${i + 1} of 6`}
            maxLength={6}
            value={digit.trim()}
            onChange={(event) => {
              const raw = event.target.value.replace(/\D/g, "");
              if (raw.length > 1) {
                write(raw);
                return;
              }
              const chars = code.padEnd(6, " ").split("");
              chars[i] = raw || " ";
              write(chars.join("").replace(/ /g, ""));
            }}
            onKeyDown={(event) => {
              // Backspace in an empty box eats the previous digit, the way
              // every other one-time-code field behaves.
              if (event.key === "Backspace" && !digit.trim() && i > 0) {
                event.preventDefault();
                write(code.slice(0, Math.max(0, i - 1)), i - 1);
                return;
              }
              if (event.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
              if (event.key === "ArrowRight" && i < 5) boxes.current[i + 1]?.focus();
              if (event.key === "Enter" && code.length === 6) onComplete();
            }}
            onPaste={(event) => {
              event.preventDefault();
              write(event.clipboardData.getData("text"));
            }}
            className="font-display h-16 w-full rounded-2xl border text-center text-3xl font-light text-bone tabular-nums transition-all duration-300 focus:outline-none sm:h-20 sm:text-4xl"
            style={{
              borderColor: error
                ? "rgba(255,59,59,0.6)"
                : digit.trim()
                  ? "rgba(154,164,255,0.55)"
                  : "rgba(255,255,255,0.12)",
              background: digit.trim()
                ? "rgba(154,164,255,0.07)"
                : "rgba(255,255,255,0.02)",
            }}
          />
        ))}
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-center text-[12px] text-signal-soft"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={onResend}
          disabled={resendIn > 0 || busy}
          className="flex items-center gap-2 font-mono text-[9px] tracking-[0.22em] text-bone/45 uppercase transition-colors duration-300 hover:text-electric-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-bone/45"
        >
          <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
          {resendIn > 0 ? `RESEND IN ${resendIn}S` : "SEND IT AGAIN"}
        </button>

        {devCode && (
          <p className="rounded-xl border border-electric-300/25 bg-electric-500/8 px-4 py-2.5 text-center text-[11px] leading-relaxed text-electric-100">
            <span className="font-mono tracking-[0.2em] uppercase">
              Dev mode
            </span>{" "}
            — no mail credentials configured, so here&apos;s the code:{" "}
            <span className="font-mono text-base tracking-[0.28em] text-bone">
              {devCode}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 — confirm                                                    */
/* ------------------------------------------------------------------ */

function StepConfirm({
  tier,
  quantity,
  form,
  totals,
  agreed,
  error,
  onAgreedChange,
}: {
  tier: PassTier;
  quantity: number;
  form: FormState;
  totals: { subtotal: number; fee: number; total: number };
  agreed: boolean;
  error?: string;
  onAgreedChange: (value: boolean) => void;
}) {
  const rows = [
    { label: "PASS", value: `${tier.name} — ${tier.subtitle}` },
    { label: "QUANTITY", value: `${quantity} ${quantity > 1 ? "passes" : "pass"}` },
    { label: "NAME", value: form.name },
    { label: "EMAIL", value: form.email },
    { label: "PHONE", value: form.phone },
    { label: "WHEN", value: `${EVENT.dateLabel} · ${EVENT.timeLabel}` },
    { label: "WHERE", value: `${EVENT.venueName}, ${EVENT.venueCity}` },
  ];

  return (
    <div>
      <StepTitle
        eyebrow="STEP 04"
        title="Last look"
        hint="Next screen is UPI. We don't charge a card here — you pay in your own app, we confirm it."
      />

      <div className="mt-6 divide-y divide-white/7 overflow-hidden rounded-2xl border border-white/9 bg-white/2">
        {rows.map((row, i) => (
          <motion.div
            key={row.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: i * 0.05, ease: EASE }}
            className="flex items-baseline justify-between gap-4 px-4 py-3"
          >
            <span className="font-mono text-[8px] tracking-[0.24em] text-bone/35 uppercase">
              {row.label}
            </span>
            <span className="truncate text-right text-[13px] text-bone/85">
              {row.value}
            </span>
          </motion.div>
        ))}
      </div>

      <div className="mt-5 space-y-2.5 rounded-2xl border border-white/9 bg-white/2 px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] tracking-[0.28em] text-bone/60 uppercase">
            TOTAL
          </span>
          <span
            className="font-display text-2xl font-light tabular-nums"
            style={{ color: tier.accent }}
          >
            {formatPrice(totals.total)}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onAgreedChange(!agreed)}
        aria-pressed={agreed}
        className="mt-5 flex w-full items-start gap-3 text-left"
      >
        <motion.span
          animate={error ? { x: [0, -6, 5, -2, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-300"
          style={{
            borderColor: error
              ? "rgba(255,59,59,0.7)"
              : agreed
                ? tier.accent
                : "rgba(255,255,255,0.22)",
            background: agreed ? tier.accent : "transparent",
          }}
        >
          <AnimatePresence>
            {agreed && (
              <motion.span
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
              >
                <Check className="size-3 text-void" strokeWidth={3.5} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.span>
        <span className="text-[11px] leading-relaxed text-bone/55">
          I&apos;m bringing an ID, I know passes aren&apos;t refundable, and I
          understand this is a completely dry event — no alcohol in, none served,
          bags get checked.{" "}
          {error && <span className="text-signal-soft">{error}</span>}
        </span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 5 — UPI                                                        */
/* ------------------------------------------------------------------ */

function StepPay({
  tier,
  reservation,
  utr,
  proof,
  errors,
  busy,
  onUtrChange,
  onProofChange,
  onProofError,
}: {
  tier: PassTier;
  reservation: Reservation;
  utr: string;
  proof: PaymentScreenshot | null;
  errors: Errors;
  busy: boolean;
  onUtrChange: (value: string) => void;
  onProofChange: (proof: PaymentScreenshot | null) => void;
  onProofError: (message: string) => void;
}) {
  const [copiedVpa, setCopiedVpa] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const vpa = reservation.vpa ?? "";
  const payeeName = reservation.payeeName ?? "AVION Productions";
  const note = `UTOPIA ${reservation.reference}`;
  const genericPayHref = reservation.upiUri ?? null;

  const copyVpa = async () => {
    if (!vpa) return;
    try {
      await navigator.clipboard.writeText(vpa);
      setCopiedVpa(true);
      window.setTimeout(() => setCopiedVpa(false), 2000);
    } catch {
      setCopiedVpa(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) {
      onProofChange(null);
      return;
    }
    try {
      onProofChange(await compressPaymentScreenshot(file));
    } catch (error) {
      onProofChange(null);
      onProofError(error instanceof Error ? error.message : "Couldn't read that screenshot.");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <StepTitle
        eyebrow="STEP 05"
        title="Pay on UPI"
        hint="Pay first. Then come back with the 12-digit UTR and a screenshot. Typing the UTR does not submit the reservation."
      />

      <div
        className="mt-6 overflow-hidden rounded-3xl border border-white/10"
        style={{ background: "rgba(255,255,255,0.03)" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div>
            <p className="font-mono text-[8px] tracking-[0.22em] text-bone/35 uppercase">PAY TO</p>
            <p className="mt-1 text-sm text-bone">{payeeName}</p>
          </div>
          <p className="font-display text-xl font-light text-bone tabular-nums" style={{ color: tier.accent }}>
            {formatPrice(reservation.total)}
          </p>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5">
            <p className="min-w-0 flex-1 truncate font-mono text-[13px] text-electric-100">{vpa || "UPI ID pending"}</p>
            <button
              type="button"
              onClick={() => void copyVpa()}
              disabled={!vpa}
              className="shrink-0 rounded-full border border-white/12 px-3 py-1.5 font-mono text-[8px] tracking-[0.18em] text-bone/70 uppercase hover:border-electric-300/50 hover:text-electric-100 disabled:opacity-40"
            >
              {copiedVpa ? "COPIED" : "COPY VPA"}
            </button>
          </div>

          <div
            className="mx-auto flex size-52 items-center justify-center overflow-hidden rounded-2xl bg-white p-3"
            style={{ boxShadow: `0 0 40px -14px ${tier.accent}` }}
          >
            {reservation.upiQr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={reservation.upiQr} alt="UPI payment QR" className="size-full object-contain" />
            ) : (
              <QrCode className="size-10 text-void/40" />
            )}
          </div>

          {genericPayHref && (
            <a
              href={genericPayHref}
              className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 font-mono text-[10px] font-bold tracking-[0.16em] text-void uppercase"
              style={{ background: `linear-gradient(135deg, ${tier.accent}, #f4e7c5)` }}
            >
              PAY {formatPrice(reservation.total)} VIA UPI APP
              <ArrowRight className="size-3.5" />
            </a>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {UPI_APPS.map((app) =>
              vpa ? (
                <a
                  key={app.id}
                  href={upiAppHref(app, vpa, payeeName, reservation.total, note)}
                  className="rounded-xl px-2 py-2.5 text-center font-mono text-[9px] font-bold tracking-[0.16em] text-white uppercase"
                  style={{ background: app.color }}
                >
                  {app.label}
                </a>
              ) : (
                <span
                  key={app.id}
                  className="rounded-xl px-2 py-2.5 text-center font-mono text-[9px] font-bold tracking-[0.16em] text-white uppercase opacity-40"
                  style={{ background: app.color }}
                >
                  {app.label}
                </span>
              ),
            )}
          </div>

          <p className="text-center text-[11px] leading-relaxed text-bone/45">
            Finish the payment in your UPI app. Then return here. App buttons only open payment —
            they do not send the reservation.
          </p>
          <p className="text-center font-mono text-[8px] tracking-[0.18em] text-bone/35 uppercase">
            NOTE · {reservation.reference}
          </p>
        </div>
      </div>

      <label className="mt-6 block">
        <span className="mb-2 flex items-center justify-between font-mono text-[9px] tracking-[0.28em] text-bone/40 uppercase">
          UPI TRANSACTION / UTR (12 DIGITS)
          {errors.utr && <span className="text-signal-soft normal-case">{errors.utr}</span>}
        </span>
        <input
          value={utr}
          onChange={(event) => onUtrChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
          inputMode="numeric"
          autoComplete="off"
          maxLength={12}
          placeholder="e.g. 419283749102"
          className="w-full rounded-2xl border border-white/10 bg-white/2 px-4 py-3.5 font-mono text-sm tracking-[0.18em] text-bone placeholder:text-bone/25 focus:border-electric-300/60 focus:outline-none"
          style={{ borderColor: errors.utr ? "rgba(255,59,59,0.6)" : undefined }}
        />
      </label>

      <div className="mt-4">
        <span className="mb-2 flex items-center justify-between font-mono text-[9px] tracking-[0.28em] text-bone/40 uppercase">
          PAYMENT SCREENSHOT
          {errors.proof && <span className="text-signal-soft normal-case">{errors.proof}</span>}
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={busy}
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/2 px-4 py-3.5 text-left transition-colors hover:border-electric-300/40 disabled:opacity-50"
          style={{ borderColor: errors.proof ? "rgba(255,59,59,0.6)" : undefined }}
        >
          {proof ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={proof.dataUrl} alt="" className="size-12 rounded-lg object-cover" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-lg border border-white/10 text-bone/40">
              <Upload className="size-4" />
            </span>
          )}
          <span className="min-w-0">
            <span className="block text-[13px] text-bone">
              {proof ? proof.name : "Choose screenshot"}
            </span>
            <span className="block text-[11px] text-bone/40">
              {proof ? "Tap to replace" : "JPG, PNG, or WebP of the paid screen"}
            </span>
          </span>
        </button>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-bone/45">
        Submit stays locked until the UTR is 12 digits and a screenshot is attached.
        An admin still has to confirm the credit before a pass is emailed.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 6 — reserved                                                   */
/* ------------------------------------------------------------------ */

function StepDone({
  tier,
  quantity,
  form,
  reservation,
  copied,
  onCopy,
}: {
  tier: PassTier;
  quantity: number;
  form: FormState;
  reservation: Reservation;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="relative flex size-20 items-center justify-center rounded-full"
        style={{
          background: `radial-gradient(circle, ${tier.accentSoft}, transparent 70%)`,
        }}
      >
        <motion.span
          className="absolute inset-0 rounded-full border"
          style={{ borderColor: tier.accent }}
          animate={{ scale: [1, 1.5, 1.9], opacity: [0.8, 0.2, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
        />
        <span
          className="flex size-12 items-center justify-center rounded-full"
          style={{ background: tier.accent }}
        >
          <Check className="size-6 text-void" strokeWidth={3} />
        </span>
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
        className="font-display mt-6 text-3xl leading-tight font-light text-bone sm:text-4xl"
      >
        See you Sunday
      </motion.h3>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="mt-3 max-w-sm text-sm leading-relaxed text-bone/55"
      >
        {quantity} × {tier.name} is with us for{" "}
        {form.name.split(" ")[0] || "you"}. We&apos;re checking the UPI
        screenshot. When it clears, the pass QR lands in{" "}
        <span className="text-bone/85">{form.email}</span>.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
        className="relative mt-8 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#04050e]/80 text-left"
      >
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background: `linear-gradient(to right, transparent, ${tier.accent}, transparent)`,
          }}
        />
        <div className="flex items-stretch">
          <div className="flex-1 p-5">
            <p className="font-mono text-[8px] tracking-[0.28em] text-bone/35 uppercase">
              YOUR REFERENCE
            </p>
            <p className="font-display mt-2 text-2xl tracking-[0.08em] text-bone sm:text-3xl">
              {reservation.reference}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <StubCell label="DATE" value="SUN 27 SEP" />
              <StubCell label="DOORS" value="12:00 PM" />
              <StubCell label="PASS" value={tier.name} />
              <StubCell label="TOTAL" value={formatPrice(reservation.total)} />
            </div>
          </div>

          <div
            className="relative w-px"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, rgba(255,255,255,0.26) 0 6px, transparent 6px 12px)",
            }}
          />

          <div className="flex w-24 flex-col items-center justify-center gap-2 p-4 text-center sm:w-28">
            <p className="font-mono text-[8px] tracking-[0.2em] text-bone/40 uppercase">
              STATUS
            </p>
            <p
              className="font-display text-xl leading-none font-light"
              style={{ color: tier.accent }}
            >
              IN
            </p>
            <p className="font-mono text-[8px] tracking-[0.2em] text-bone/40 uppercase">
              REVIEW
            </p>
          </div>
        </div>
      </motion.div>

      <motion.button
        type="button"
        onClick={onCopy}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-5 flex items-center gap-2 font-mono text-[9px] tracking-[0.24em] text-bone/45 uppercase transition-colors duration-300 hover:text-electric-200"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "COPIED" : "COPY REFERENCE"}
      </motion.button>
    </div>
  );
}

function StubCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[8px] tracking-[0.22em] text-bone/30 uppercase">
        {label}
      </p>
      <p className="mt-1 text-[12px] text-bone/80 uppercase">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StepTitle({
  eyebrow,
  title,
  hint,
}: {
  eyebrow: string;
  title: string;
  hint: string;
}) {
  return (
    <div>
      <p className="font-mono text-[9px] tracking-[0.3em] text-electric-200/70 uppercase">
        {eyebrow}
      </p>
      <h3 className="font-display mt-2 text-2xl leading-tight font-light text-bone">
        {title}
      </h3>
      <p className="mt-2 text-xs text-bone/45">{hint}</p>
    </div>
  );
}
