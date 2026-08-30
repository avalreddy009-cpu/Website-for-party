"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutDashboard, LogIn, Menu, Star, X } from "lucide-react";

import { EVENT } from "@/lib/event";
import { toRoman } from "@/lib/roman";

const LINKS = [
  { label: "ABOUT", href: "#story" },
  { label: "PASSES", href: "#passes" },
  { label: "VENUE", href: "#venue" },
  { label: "RULES", href: "#rules" },
];

export function Navbar() {
  const [authed, setAuthed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/session")
      .then((response) => response.json())
      .then((data: { authenticated: boolean }) => {
        if (active) setAuthed(Boolean(data.authenticated));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[#030307]/70 backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href="#top" className="group flex items-baseline gap-2 leading-none">
          <Star
            className="size-3 text-electric-300 transition-colors group-hover:text-bone"
            strokeWidth={1.6}
          />
          <span className="font-mono text-[11px] tracking-[0.24em] text-bone uppercase transition-colors group-hover:text-electric-200">
            {EVENT.name} · {toRoman(new Date().getFullYear() + (new Date().getMonth() >= 8 ? 0 : 1))}
          </span>
          <span className="hidden font-mono text-[9px] tracking-[0.24em] text-bone/35 uppercase sm:inline">
            / {EVENT.host}
          </span>
        </a>

        <ul className="hidden items-center gap-7 lg:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="relative font-mono text-[10px] tracking-[0.28em] text-bone/60 uppercase transition-colors hover:text-bone"
              >
                {link.label}
                <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-electric-300 transition-all duration-300 hover:w-full" />
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <a
            href={authed ? "/admin" : "/login"}
            className="group flex items-center gap-2 border border-white/18 px-3.5 py-1.5 font-mono text-[9px] tracking-[0.22em] text-bone/75 uppercase transition-all duration-300 hover:border-electric-300/60 hover:text-bone sm:px-4 sm:py-2"
          >
            {authed ? (
              <LayoutDashboard className="size-3.5" strokeWidth={2} />
            ) : (
              <LogIn className="size-3.5" strokeWidth={2} />
            )}
            {authed ? "DASHBOARD" : "LOGIN"}
          </a>

          <span className="hidden font-mono text-[9px] tracking-[0.24em] text-bone/35 uppercase md:inline">
            {EVENT.venueCode} · {EVENT.timezoneCode}
          </span>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="flex size-8 items-center justify-center text-bone/70 transition-colors hover:text-bone lg:hidden"
          >
            {menuOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-white/8 bg-[#030307]/95 backdrop-blur-xl lg:hidden"
          >
            <ul className="flex flex-col px-5 py-3">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block py-3 font-mono text-xs tracking-[0.24em] text-bone/70 uppercase transition-colors hover:text-bone"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
