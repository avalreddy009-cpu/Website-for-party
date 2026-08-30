"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Loader2,
  Mail,
  Minus,
  Phone,
  Plus,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from "lucide-react";

import { EVENT, formatPrice } from "@/lib/event";
import {
  BOOKING_FEE_RATE,
  PASSES,
  getPassById,
  type PassId,
  type PassTier,
} from "@/lib/passes";

const EASE = [0.16, 1, 0.3, 1] as const;
const MAX_QTY = 10;

const STEPS = ["PASS", "DETAILS", "CONFIRM", "DONE"] as const;

type FormState = { name: string; email: string; phone: string };
type FormErrors = Partial<Record<keyof FormState | "terms", string>>;

const EMPTY_FORM: FormState = { name: "", email: "", phone: "" };

function generateOrderCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = (length: number) =>
    Array.from(
      { length },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join("");
  return `UTP-${block(4)}-${block(4)}`;
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (form.name.trim().length < 2) {
    errors.name = "Enter the name on your ID";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
    errors.email = "We send the e-pass here — check the address";
  }
  const digits = form.phone.replace(/\D/g, "");
  if (digits.length < 10) {
    errors.phone = "Enter a valid 10-digit number";
  }
  return errors;
}

type CheckoutModalProps = {
  open: boolean;
  pass: PassTier | null;
  /** Bumped on every "Buy pass" click so the flow remounts with fresh state. */
  sessionId: number;
  onClose: () => void;
};

export function CheckoutModal({
  open,
  pass,
  sessionId,
  onClose,
}: CheckoutModalProps) {
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
            className="absolute inset-0 cursor-default bg-[#01010a]/80 backdrop-blur-xl"
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
            className="glass-strong relative flex max-h-[92svh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl shadow-[0_40px_120px_-40px_rgba(31,91,255,0.85)] sm:max-w-2xl sm:rounded-3xl"
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
  const payTimeout = useRef<number | null>(null);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [tierId, setTierId] = useState<PassId>(initialPass.id);
  const [quantity, setQuantity] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [agreed, setAgreed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [orderCode, setOrderCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const tier = getPassById(tierId);

  const totals = useMemo(() => {
    const subtotal = tier.price * quantity;
    const fee = Math.round(subtotal * BOOKING_FEE_RATE);
    return { subtotal, fee, total: subtotal + fee };
  }, [tier.price, quantity]);

  useEffect(
    () => () => {
      if (payTimeout.current !== null) {
        window.clearTimeout(payTimeout.current);
      }
    },
    [],
  );

  const goTo = useCallback(
    (next: number) => {
      setDirection(next > step ? 1 : -1);
      setStep(next);
    },
    [step],
  );

  const handleNext = useCallback(() => {
    if (step === 0) {
      goTo(1);
      return;
    }

    if (step === 1) {
      const found = validate(form);
      setErrors(found);
      if (Object.keys(found).length > 0) return;
      goTo(2);
      return;
    }

    if (step === 2) {
      if (!agreed) {
        setErrors({ terms: "Tick the box so we can let you in" });
        return;
      }
      setErrors({});
      setProcessing(true);
      onLockChange(true);
      // Stand-in for the payment round-trip; swap for your PSP call.
      payTimeout.current = window.setTimeout(() => {
        setOrderCode(generateOrderCode());
        setProcessing(false);
        onLockChange(false);
        setDirection(1);
        setStep(3);
      }, 1800);
    }
  }, [agreed, form, goTo, onLockChange, step]);

  const copyCode = async () => {
    if (!orderCode) return;
    try {
      await navigator.clipboard.writeText(orderCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const slide = {
    enter: (dir: number) => ({
      x: reduced ? 0 : dir * 70,
      opacity: 0,
      filter: "blur(8px)",
    }),
    center: { x: 0, opacity: 1, filter: "blur(0px)" },
    exit: (dir: number) => ({
      x: reduced ? 0 : dir * -70,
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
        className="pointer-events-none absolute -top-32 left-1/2 size-72 -translate-x-1/2 rounded-full blur-3xl animate-glow-pulse"
        style={{
          background: `radial-gradient(circle, ${tier.accentSoft}, transparent 68%)`,
        }}
      />
      <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.1] mix-blend-soft-light" />

      {/* ------------ header ------------ */}
      <div className="relative flex items-start justify-between gap-4 border-b border-white/8 px-6 pt-6 pb-5 sm:px-8">
        <div>
          <p className="font-mono text-[9px] tracking-[0.34em] text-electric-200/70 uppercase">
            {EVENT.name} · {EVENT.shortDateLabel} · CHECKOUT
          </p>
          <h2
            id={headingId}
            className="font-display mt-2 text-2xl leading-none tracking-[0.02em] text-bone uppercase sm:text-3xl"
          >
            {step === 3 ? "YOU'RE IN" : tier.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => !processing && onClose()}
          aria-label="Close checkout"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/12 text-bone/55 transition-all duration-300 hover:rotate-90 hover:border-bone/40 hover:text-bone"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* ------------ progress ------------ */}
      <div className="relative flex gap-2 px-6 pt-5 sm:px-8">
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
              className={`mt-2 font-mono text-[8px] tracking-[0.22em] uppercase transition-colors duration-500 sm:text-[9px] ${
                i <= step ? "text-bone/75" : "text-bone/25"
              }`}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* ------------ body ------------ */}
      <div className="relative min-h-0 flex-1 overflow-y-auto px-6 py-7 sm:px-8">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: EASE }}
          >
            {step === 0 && (
              <StepPass
                tierId={tierId}
                onTierChange={setTierId}
                quantity={quantity}
                onQuantityChange={setQuantity}
                tier={tier}
              />
            )}

            {step === 1 && (
              <StepDetails
                form={form}
                errors={errors}
                onChange={(key, value) => {
                  setForm((prev) => ({ ...prev, [key]: value }));
                  setErrors((prev) => ({ ...prev, [key]: undefined }));
                }}
              />
            )}

            {step === 2 && (
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

            {step === 3 && orderCode && (
              <StepDone
                tier={tier}
                quantity={quantity}
                form={form}
                total={totals.total}
                orderCode={orderCode}
                copied={copied}
                onCopy={copyCode}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ------------ footer ------------ */}
      <div className="relative border-t border-white/8 bg-black/25 px-6 py-5 sm:px-8">
        {step < 3 ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[8px] tracking-[0.26em] text-bone/35 uppercase">
                {quantity} × {tier.name}
              </p>
              <motion.p
                key={totals.total}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-display text-2xl leading-none text-bone tabular-nums sm:text-3xl"
              >
                {formatPrice(totals.total)}
              </motion.p>
            </div>

            <div className="flex items-center gap-2.5">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => goTo(step - 1)}
                  disabled={processing}
                  className="flex size-11 items-center justify-center rounded-full border border-white/12 text-bone/60 transition-all duration-300 hover:border-bone/40 hover:text-bone disabled:opacity-40"
                  aria-label="Previous step"
                >
                  <ArrowLeft className="size-4" />
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                disabled={processing}
                className="group relative flex items-center gap-2.5 overflow-hidden rounded-full bg-bone px-6 py-3.5 font-mono text-[10px] font-bold tracking-[0.22em] text-void uppercase transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98] disabled:scale-100 disabled:opacity-70 sm:px-8"
              >
                <span
                  className="absolute inset-0 translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0"
                  style={{
                    background: `linear-gradient(135deg, ${tier.accent}, #6b3bff)`,
                  }}
                />
                <span className="relative flex items-center gap-2.5 transition-colors duration-300 group-hover:text-bone">
                  {processing ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      LOCKING PASSES
                    </>
                  ) : (
                    <>
                      {step === 2 ? "CONFIRM & PAY" : "CONTINUE"}
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <p className="font-mono text-[8px] tracking-[0.24em] text-bone/40 uppercase">
              E-PASS SENT TO {form.email || "YOUR INBOX"}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full border border-white/15 px-7 py-3.5 font-mono text-[10px] font-bold tracking-[0.22em] text-bone/80 uppercase transition-all duration-300 hover:border-cyan-glow/60 hover:text-cyan-glow sm:w-auto"
            >
              BACK TO UTOPIA
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
  tierId,
  onTierChange,
  quantity,
  onQuantityChange,
  tier,
}: {
  tierId: PassId;
  onTierChange: (id: PassId) => void;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  tier: PassTier;
}) {
  return (
    <div className="space-y-8">
      <div>
        <StepTitle
          eyebrow="STEP 01"
          title="LOCK YOUR TIER"
          hint="Switch tiers here if you changed your mind."
        />
        <div className="mt-5 grid gap-2.5">
          {PASSES.map((option) => {
            const active = option.id === tierId;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onTierChange(option.id)}
                className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition-all duration-300"
                style={{
                  borderColor: active ? option.accentSoft : "rgba(255,255,255,0.09)",
                  background: active
                    ? "rgba(255,255,255,0.055)"
                    : "rgba(255,255,255,0.015)",
                }}
                aria-pressed={active}
              >
                {active && (
                  <motion.span
                    layoutId="tier-highlight"
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(110deg, ${option.accentSoft}, transparent 62%)`,
                      opacity: 0.34,
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
                    {active && (
                      <Check className="size-3 text-void" strokeWidth={3.5} />
                    )}
                  </span>
                  <span>
                    <span className="font-display block text-base tracking-[0.03em] text-bone uppercase sm:text-lg">
                      {option.name}
                    </span>
                    <span className="font-mono text-[8px] tracking-[0.24em] text-bone/40 uppercase">
                      {option.subtitle}
                    </span>
                  </span>
                </span>
                <span className="relative font-display text-lg text-bone tabular-nums sm:text-xl">
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
          title="HOW MANY?"
          hint={`Max ${MAX_QTY} passes per order.`}
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
                  className="font-display text-4xl leading-none text-bone tabular-nums"
                >
                  {String(quantity).padStart(2, "0")}
                </motion.span>
              </AnimatePresence>
            </div>

            <QtyButton
              label="Increase quantity"
              disabled={quantity >= MAX_QTY}
              onClick={() => onQuantityChange(Math.min(MAX_QTY, quantity + 1))}
            >
              <Plus className="size-4" />
            </QtyButton>
          </div>

          <div className="text-right">
            <p className="font-mono text-[8px] tracking-[0.24em] text-bone/35 uppercase">
              SUBTOTAL
            </p>
            <p className="font-display text-xl text-bone tabular-nums sm:text-2xl">
              {formatPrice(tier.price * quantity)}
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
      className="flex size-10 items-center justify-center rounded-full border border-white/14 text-bone/75 transition-all duration-300 hover:border-cyan-glow/60 hover:text-cyan-glow disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/14 disabled:hover:text-bone/75"
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
}: {
  form: FormState;
  errors: FormErrors;
  onChange: (key: keyof FormState, value: string) => void;
}) {
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => firstRef.current?.focus(), 320);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div>
      <StepTitle
        eyebrow="STEP 02"
        title="WHO'S COMING IN?"
        hint="This has to match the ID you bring to the gate."
      />

      <div className="mt-6 space-y-5">
        <Field
          ref={firstRef}
          icon={User}
          label="FULL NAME"
          placeholder="As printed on your ID"
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
          placeholder="+91 00000 00000"
          value={form.phone}
          error={errors.phone}
          autoComplete="tel"
          onChange={(value) => onChange("phone", value)}
        />
      </div>

      <div className="mt-7 flex items-start gap-3 rounded-2xl border border-electric-300/15 bg-electric-500/6 px-4 py-3.5">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-glow" />
        <p className="text-[11px] leading-relaxed text-bone/55">
          Your details are used only to issue the e-pass and to send the venue
          drop 24 hours before doors. No lists, no resale.
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
      <span className="mb-2 flex items-center justify-between font-mono text-[9px] tracking-[0.3em] text-bone/40 uppercase">
        {label}
        <AnimatePresence>
          {error && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-[8px] tracking-[0.14em] text-rose-300/90 normal-case"
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
            ? "rgba(255,113,145,0.55)"
            : focused
              ? "rgba(85,230,255,0.6)"
              : "rgba(255,255,255,0.1)",
          background: focused ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
          boxShadow: focused ? "0 0 32px -12px rgba(85,230,255,0.7)" : "none",
        }}
      >
        <Icon
          className={`size-4 shrink-0 transition-colors duration-300 ${
            focused ? "text-cyan-glow" : "text-bone/35"
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
/* Step 3 — confirm                                                    */
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
    { label: "PASS", value: `${tier.name} · ${tier.subtitle}` },
    { label: "QUANTITY", value: `${quantity} PASS${quantity > 1 ? "ES" : ""}` },
    { label: "NAME", value: form.name },
    { label: "EMAIL", value: form.email },
    { label: "PHONE", value: form.phone },
    { label: "WHEN", value: `${EVENT.dateLabel} · ${EVENT.timeLabel}` },
  ];

  return (
    <div>
      <StepTitle
        eyebrow="STEP 03"
        title="ONE LAST LOOK"
        hint="Nothing is charged until you hit confirm."
      />

      <div className="mt-6 divide-y divide-white/7 overflow-hidden rounded-2xl border border-white/9 bg-white/2">
        {rows.map((row, i) => (
          <motion.div
            key={row.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: i * 0.055, ease: EASE }}
            className="flex items-baseline justify-between gap-4 px-4 py-3"
          >
            <span className="font-mono text-[8px] tracking-[0.26em] text-bone/35 uppercase">
              {row.label}
            </span>
            <span className="truncate text-right text-[13px] text-bone/85">
              {row.value}
            </span>
          </motion.div>
        ))}
      </div>

      <div className="mt-5 space-y-2.5 rounded-2xl border border-white/9 bg-white/2 px-4 py-4">
        <SummaryRow label="SUBTOTAL" value={formatPrice(totals.subtotal)} />
        <SummaryRow
          label={`BOOKING FEE (${Math.round(BOOKING_FEE_RATE * 100)}%)`}
          value={formatPrice(totals.fee)}
        />
        <div className="my-1 h-px bg-white/8" />
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] tracking-[0.3em] text-bone/60 uppercase">
            TOTAL
          </span>
          <span
            className="font-display text-2xl tabular-nums"
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
              ? "rgba(255,113,145,0.7)"
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
          I&apos;m 21+, I&apos;ll bring a valid ID, and I accept that passes are
          non-refundable.{" "}
          {error && <span className="text-rose-300/90">{error}</span>}
        </span>
      </button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-[8px] tracking-[0.26em] text-bone/35 uppercase">
        {label}
      </span>
      <span className="text-[13px] text-bone/70 tabular-nums">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 — success                                                    */
/* ------------------------------------------------------------------ */

function StepDone({
  tier,
  quantity,
  form,
  total,
  orderCode,
  copied,
  onCopy,
}: {
  tier: PassTier;
  quantity: number;
  form: FormState;
  total: number;
  orderCode: string;
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
        style={{ background: `radial-gradient(circle, ${tier.accentSoft}, transparent 70%)` }}
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
          <Check className="size-6 text-void" strokeWidth={3.5} />
        </span>
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
        className="font-display mt-6 text-3xl leading-none tracking-[0.02em] text-bone uppercase sm:text-4xl"
      >
        SEE YOU IN UTOPIA
      </motion.h3>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="mt-3 max-w-sm text-sm leading-relaxed text-bone/55"
      >
        {quantity} × {tier.name} secured for {form.name.split(" ")[0] || "you"}.
        The e-pass is on its way to{" "}
        <span className="text-bone/85">{form.email}</span>.
      </motion.p>

      {/* Ticket stub */}
      <motion.div
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
        className="relative mt-8 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#04060f]/80 text-left"
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
            <p className="font-mono text-[8px] tracking-[0.3em] text-bone/35 uppercase">
              ORDER REFERENCE
            </p>
            <p className="font-display mt-2 text-2xl tracking-[0.1em] text-bone sm:text-3xl">
              {orderCode}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <StubCell label="DATE" value={EVENT.shortDateLabel} />
              <StubCell label="TIME" value="12:00 PM" />
              <StubCell label="TIER" value={tier.subtitle} />
              <StubCell label="PAID" value={formatPrice(total)} />
            </div>
          </div>

          <div
            className="relative w-px"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, rgba(255,255,255,0.28) 0 6px, transparent 6px 12px)",
            }}
          />

          <div className="flex w-24 flex-col items-center justify-center gap-2 p-4 sm:w-28">
            <Sparkles className="size-4" style={{ color: tier.accent }} />
            <p className="font-mono text-[8px] tracking-[0.22em] text-bone/40 uppercase">
              VALID
            </p>
            <div className="flex h-10 items-end gap-[3px]">
              {[6, 10, 4, 9, 7, 3, 10, 5].map((h, i) => (
                <motion.span
                  key={i}
                  className="w-[3px] rounded-full"
                  style={{ background: tier.accent, opacity: 0.75 }}
                  initial={{ height: 4 }}
                  animate={{ height: [4, h * 3.6, 4] }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    delay: i * 0.09,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.button
        type="button"
        onClick={onCopy}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-5 flex items-center gap-2 font-mono text-[9px] tracking-[0.26em] text-bone/45 uppercase transition-colors duration-300 hover:text-cyan-glow"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "REFERENCE COPIED" : "COPY REFERENCE"}
      </motion.button>
    </div>
  );
}

function StubCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[8px] tracking-[0.24em] text-bone/30 uppercase">
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
      <p className="font-mono text-[9px] tracking-[0.34em] text-electric-200/70 uppercase">
        {eyebrow}
      </p>
      <h3 className="font-display mt-2 text-xl leading-none tracking-[0.02em] text-bone uppercase sm:text-2xl">
        {title}
      </h3>
      <p className="mt-2 text-xs text-bone/45">{hint}</p>
    </div>
  );
}
