"use client";

import clsx from "clsx";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { MONEY_WORD } from "@/lib/payoutWords";
import type { Verdict } from "./VerdictMark";

// A tab per verdict, in the one payout vocabulary (lib/payoutWords.ts): Paid, Sent, settling and Approved are three
// tabs, so each tab's count is the count every other surface gives.
export type Tab = "all" | Verdict;
export const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "paid", label: MONEY_WORD.paid },
  { id: "settling", label: MONEY_WORD.settling },
  { id: "approved", label: MONEY_WORD.approved },
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
  // Whenever the eight tabs don't fit their box (a phone, a narrow window, beside the open claim) the strip scrolls in
  // its own box, never the page: data-over adds an end spacer (a flex scroller drops its end padding) so the last tab
  // clears the faded edge, and data-more fades the right edge while there is more to scroll to.
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const measure = () => {
      const tabs = el.querySelectorAll<HTMLElement>("[role=tab]");
      const last = tabs[tabs.length - 1];
      if (!last) return;
      const end = last.getBoundingClientRect().right - el.getBoundingClientRect().left + el.scrollLeft + parseFloat(getComputedStyle(el).paddingRight);
      const over = end > el.clientWidth + 0.5;
      el.toggleAttribute("data-over", over);
      el.toggleAttribute("data-more", over && el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.querySelectorAll("[role=tab]").forEach((t) => ro.observe(t));
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, []);
  // A tab chosen by its number key, out of the strip's view, scrolls into it (clear of the faded edge).
  useEffect(() => {
    const el = strip.current;
    const t = el?.querySelector<HTMLElement>(`#tab-${value}`);
    if (!el || !t || !el.hasAttribute("data-over")) return;
    const r = t.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    if (r.right > box.right - 32) el.scrollLeft += r.right - box.right + 32;
    else if (r.left < box.left + 4) el.scrollLeft -= box.left + 4 - r.left;
  }, [value]);
  return (
    // A scroller clips what overflows it, so it carries 4px of padding (taken back by margins) for each tab's focus ring:
    // 2px offset, 2px wide. From 640px it takes the toolbar's room left over (basis 0), so it never wraps the controls.
    <div
      ref={strip}
      role="tablist"
      aria-label="Filter claims by decision"
      className="-mx-4 -my-1 flex min-w-0 overflow-x-auto px-4 py-1 [scrollbar-width:none] after:hidden after:w-8 after:shrink-0 after:content-[''] data-more:[mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)] data-over:after:block sm:-mx-1 sm:grow sm:basis-0 sm:px-1"
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
            // The key that opens it, said to assistive tech and on hover; the ? sheet lists them all.
            aria-keyshortcuts={String(i + 1)}
            title={`${t.label} (${i + 1})`}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => move(e, i)}
            className={clsx(
              "relative inline-flex min-h-11 shrink-0 items-center gap-1.5 px-2 text-ui font-medium whitespace-nowrap transition-colors first:pl-0 sm:gap-2 sm:px-3",
              active ? "text-accent-text after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent first:after:left-0 sm:after:inset-x-3" : "text-muted hover:text-text",
            )}
          >
            {t.label}
            {/* Two figures wide at least, so a search that takes a count from 49 to 0 never moves the tabs. */}
            <span className={clsx("inline-flex min-w-[2ch] justify-center rounded-[4px] px-1 font-mono text-micro tabular-nums", active ? "bg-accent-soft text-accent-text" : "text-faint")}>{counts[t.id]}</span>
          </button>
        );
      })}
    </div>
  );
}
