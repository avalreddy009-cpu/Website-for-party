"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Ticket } from "lucide-react";

import { EVENT } from "@/lib/event";

const LINKS = [
  { label: "EVENT", href: "#event" },
  { label: "PASSES", href: "#passes" },
  { label: "INFO", href: "#info" },
];

export function Navbar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 220);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.header
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 sm:px-6"
        >
          <nav className="glass flex w-full max-w-5xl items-center justify-between gap-4 rounded-full px-4 py-2.5 shadow-[0_18px_60px_-30px_rgba(31,91,255,0.9)] sm:px-6">
            <a
              href="#top"
              className="group flex items-baseline gap-2 leading-none"
            >
              <span className="font-display text-lg tracking-[0.14em] text-bone uppercase transition-colors group-hover:text-cyan-glow">
                {EVENT.name}
              </span>
              <span className="hidden font-mono text-[9px] tracking-[0.3em] text-bone/40 uppercase sm:inline">
                / AVION
              </span>
            </a>

            <ul className="hidden items-center gap-7 md:flex">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="relative font-mono text-[10px] tracking-[0.3em] text-bone/60 uppercase transition-colors hover:text-bone"
                  >
                    {link.label}
                    <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-cyan-glow transition-all duration-300 hover:w-full" />
                  </a>
                </li>
              ))}
            </ul>

            <a
              href="#passes"
              className="group relative flex items-center gap-2 overflow-hidden rounded-full bg-bone px-4 py-2 font-mono text-[10px] font-bold tracking-[0.2em] text-void uppercase transition-transform duration-300 hover:scale-[1.04] sm:px-5"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-electric-400 to-cyan-glow transition-transform duration-500 group-hover:translate-x-0" />
              <Ticket className="relative size-3.5" strokeWidth={2.5} />
              <span className="relative">GET PASSES</span>
            </a>
          </nav>
        </motion.header>
      )}
    </AnimatePresence>
  );
}
