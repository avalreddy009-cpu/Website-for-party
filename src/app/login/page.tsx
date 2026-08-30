"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { BackgroundFX } from "@/components/BackgroundFX";
import { PhraseUnlock } from "@/components/PhraseUnlock";
import { EVENT } from "@/lib/event";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/session")
      .then((response) => response.json())
      .then((data: { authenticated: boolean }) => {
        if (!active) return;
        if (data.authenticated) {
          router.replace("/admin");
          return;
        }
        setChecking(false);
      })
      .catch(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <>
      <BackgroundFX />
      <main className="relative flex min-h-[100svh] flex-1 items-center justify-center px-5 py-16 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="glass-strong relative w-full max-w-lg overflow-hidden rounded-3xl p-7 sm:p-9"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-electric-300 to-transparent"
          />
          <Link
            href="/"
            className="relative mb-8 flex items-center gap-2 font-mono text-[9px] tracking-[0.26em] text-bone/40 uppercase transition-colors hover:text-bone/80"
          >
            <ArrowLeft className="size-3.5" />
            BACK TO {EVENT.name}
          </Link>

          {checking ? (
            <p className="font-mono text-[10px] tracking-[0.22em] text-bone/40 uppercase">
              CHECKING SESSION…
            </p>
          ) : (
            <PhraseUnlock
              eyebrow={`${EVENT.host} · CMS`}
              title="Twelve words"
              hint="Same idea as a wallet seed. Paste the phrase or type each word. This is not a customer login — if you're chasing your own pass, check your email."
              submitLabel="UNLOCK CMS"
              endpoint="/api/admin/login"
              onUnlocked={() => router.push("/admin")}
            />
          )}

          <div className="relative mt-7 flex items-start gap-2.5 border-t border-white/8 pt-5">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-bone/30" />
            <p className="text-[11px] leading-relaxed text-bone/35">
              Sessions last 12 hours. The phrase never leaves this box as anything but a POST
              to our server — we store a hash, not the words.
            </p>
          </div>
        </motion.div>
      </main>
    </>
  );
}
