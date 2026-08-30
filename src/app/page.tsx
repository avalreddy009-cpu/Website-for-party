"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";

import { BackgroundFX } from "@/components/BackgroundFX";
import { CheckoutModal } from "@/components/CheckoutModal";
import { EventInfo } from "@/components/EventInfo";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Marquee } from "@/components/Marquee";
import { Navbar } from "@/components/Navbar";
import { PassTiers } from "@/components/PassTiers";
import { Preloader } from "@/components/Preloader";
import type { PassTier } from "@/lib/passes";

const TICKER = [
  "UTOPIA",
  "SEP 27",
  "12:00 — 17:00",
  "AVION PRODUCTIONS",
  "NO SPECTATORS",
  "THE STATE OF ESCAPE",
];

const TICKER_LOWER = [
  "THE PARTY FOR THE RIGHT PEOPLE",
  "LOCATION CLASSIFIED",
  "21+ ONLY",
  "PASSES LIMITED",
];

export default function Home() {
  const [ready, setReady] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPass, setSelectedPass] = useState<PassTier | null>(null);
  const [checkoutSession, setCheckoutSession] = useState(0);

  // Hold the page still behind the loading sequence.
  useEffect(() => {
    if (ready) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [ready]);

  const handleLoaderComplete = useCallback(() => setReady(true), []);

  const handleBuy = useCallback((pass: PassTier) => {
    setSelectedPass(pass);
    setCheckoutSession((session) => session + 1);
    setCheckoutOpen(true);
  }, []);

  return (
    <>
      <AnimatePresence>
        {!ready && <Preloader onComplete={handleLoaderComplete} />}
      </AnimatePresence>

      <BackgroundFX />
      <Navbar />

      <main className="relative flex-1">
        <Hero ready={ready} />

        <Marquee items={TICKER} />

        <EventInfo />

        <PassTiers onBuy={handleBuy} />

        <Marquee items={TICKER_LOWER} reverse />
      </main>

      <Footer />

      <CheckoutModal
        open={checkoutOpen}
        pass={selectedPass}
        sessionId={checkoutSession}
        onClose={() => setCheckoutOpen(false)}
      />
    </>
  );
}
