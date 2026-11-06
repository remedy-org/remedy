"use client";

import clsx from "clsx";
import type { KeyboardEvent } from "react";

export type Tab = "all" | "paid" | "held" | "rejected" | "blocked";
export const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "held", label: "Held" },
  { id: "rejected", label: "Rejected" },
  { id: "blocked", label: "Blocked" },
];

/** AG Grid demo style status tabs: a word and its count, the current one underlined. Arrow keys move between them. */
export function StatusTabs({ value, counts, onChange, controls }: { value: Tab; counts: Record<Tab, number>; onChange: (t: Tab) => void; controls: string }) {
  const move = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = TABS[(i + step + TABS.length) % TABS.length];
    onChange(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };
  return (
    <div role="tablist" aria-label="Filter claims by decision" className="-mx-4 flex overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]">
      {TABS.map((t, i) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={controls}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => move(e, i)}
            className={clsx(
              "relative inline-flex min-h-11 shrink-0 items-center gap-1.5 px-2.5 text-ui sm:gap-2 sm:px-3 font-medium transition-colors first:pl-0",
              active ? "text-text after:absolute after:inset-x-2.5 sm:after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-text first:after:left-0" : "text-muted hover:text-text",
            )}
          >
            {t.label}
            <span className={clsx("font-mono text-micro tabular-nums", active ? "text-muted" : "text-faint")}>{counts[t.id]}</span>
          </button>
        );
      })}
    </div>
  );
}
