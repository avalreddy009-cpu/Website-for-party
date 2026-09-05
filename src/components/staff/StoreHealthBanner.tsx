import { AlertTriangle } from "lucide-react";

import type { StoreHealth } from "@/server/store";

export function StoreHealthBanner({
  store,
  boxed = false,
}: {
  store: StoreHealth | null | undefined;
  boxed?: boolean;
}) {
  if (!store) return null;
  if (store.durable && store.hydrateOk && store.writeOk) return null;

  if (boxed) {
    return (
      <p className="flex items-start gap-2.5 rounded-xl border border-signal/35 bg-signal/8 px-4 py-3 text-[12px] leading-relaxed text-signal-soft">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <span>{store.detail}</span>
      </p>
    );
  }

  return (
    <div className="border-b border-signal/40 bg-signal/12 px-5 py-3 sm:px-8">
      <p className="mx-auto flex max-w-7xl items-start gap-2.5 text-[12px] leading-relaxed text-signal-soft">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <span>{store.detail}</span>
      </p>
    </div>
  );
}

