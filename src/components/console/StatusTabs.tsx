"use client";

import clsx from "clsx";
import type { KeyboardEvent } from "react";

export type Tab = "all" | "paid" | "held" | "rejected" | "blocked" | "pending";
export const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "paid", label: "Approved" },
  { id: "held", label: "Held" },
  { id: "rejected", label: "Rejected" },
  { id: "blocked", label: "Blocked" },
  // A code issued and no photos yet, or the photos with the model: the same word as the pill and the report.
  { id: "pending", label: "In progress" },
];

/** Status tabs: a word and its count, the current one underlined. Arrow keys, Home and End move between them. */
export function StatusTabs({ value, counts, onChange, controls }: { value: Tab; counts: Record<Tab, number>; onChange: (t: Tab) => void; controls: string }) {
  // ← and → move between the tabs, Home and End to the first and last (the ARIA tabs pattern).
  const move = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const next = TABS[(to + TABS.length) % TABS.length];
    onChange(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };
  return (
    // On a phone the strip scrolls: an end spacer (a flex scroller drops its end padding) lets the last tab clear the
    // faded right edge, and the fade shows there is more to scroll. A scroller clips what overflows it, so it carries 4px
    // of padding (taken back by margins) for each tab's focus ring: 2px offset, 2px wide.
    <div
      role="tablist"
      aria-label="Filter claims by decision"
      className="-mx-4 -my-1 flex overflow-x-auto px-4 py-1 [scrollbar-width:none] after:w-8 after:shrink-0 after:content-[''] max-sm:[mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)] sm:-mx-1 sm:px-1 sm:after:hidden"
    >
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
              "relative inline-flex min-h-11 shrink-0 items-center gap-1.5 px-2 text-ui font-medium whitespace-nowrap transition-colors first:pl-0 sm:gap-2 sm:px-3",
              active ? "text-text after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-text first:after:left-0 sm:after:inset-x-3" : "text-muted hover:text-text",
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
