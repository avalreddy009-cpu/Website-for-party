import type { ReactNode } from "react";
import { ScanLine, ShieldCheck, Ticket } from "lucide-react";

import { BackgroundFX } from "@/components/BackgroundFX";
import { EVENT } from "@/lib/event";
import { LogoutButton } from "./LogoutButton";

type AdminShellProps = {
  username: string;
  children: ReactNode;
};

export function AdminShell({ username, children }: AdminShellProps) {
  return (
    <>
      <BackgroundFX />

      <div className="relative flex min-h-[100svh] flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#030307]/85 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <a href="/admin" className="flex items-baseline gap-2.5 leading-none">
              <span className="font-display text-lg font-light tracking-[0.05em] text-bone uppercase">
                {EVENT.name}
              </span>
              <span className="font-mono text-[9px] tracking-[0.3em] text-electric-200/70 uppercase">
                CMS
              </span>
            </a>

            <nav className="hidden items-center gap-5 sm:flex">
              <a
                href="/admin"
                className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.22em] text-bone/55 uppercase transition-colors hover:text-bone"
              >
                <Ticket className="size-3.5" />
                PASSES
              </a>
              <a
                href="/admin/scans"
                className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.22em] text-bone/55 uppercase transition-colors hover:text-bone"
              >
                <ScanLine className="size-3.5" />
                SCAN LOGS
              </a>
              <a
                href="/door"
                className="font-mono text-[9px] tracking-[0.22em] text-bone/35 uppercase transition-colors hover:text-bone/70"
              >
                DOOR PANEL
              </a>
            </nav>

            <div className="flex items-center gap-4">
              <span className="hidden items-center gap-2 font-mono text-[9px] tracking-[0.2em] text-bone/40 uppercase md:flex">
                <ShieldCheck className="size-3.5 text-electric-300" />
                {username}
              </span>
              <LogoutButton />
            </div>
          </div>
        </header>

        <main className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 py-10 sm:px-8">
          {children}
        </main>
      </div>
    </>
  );
}
