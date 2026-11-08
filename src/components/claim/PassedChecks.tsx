"use client";

import clsx from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import styles from "./flow.module.css";

/**
 * A paid claim's checks, folded into one line once they have all passed ("All 5 checks passed"), so the headline, the
 * receipt and the way on share one screen. A tap opens the five again. Arriving from the checking screen, it starts
 * open (the five rows just landed) and folds as the receipt is about to print; a later visit finds it folded.
 */
export function PassedChecks({ count, arrive, children }: { count: number; arrive: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(arrive);
  useEffect(() => {
    if (!arrive) return;
    const raf = requestAnimationFrame(() => setOpen(false));
    return () => cancelAnimationFrame(raf);
  }, [arrive]);
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className={clsx("group/checks", styles.fold)}>
      <summary className="grid cursor-pointer list-none grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-x-3 border-y border-line py-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
        <span className="flex size-4 items-center justify-center text-pay">
          <svg width={14} height={14} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1.75 5.25l2.25 2.25 4.25-4.75" />
          </svg>
        </span>
        <span className="text-body text-text">All {count} checks passed</span>
        <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-muted transition-transform duration-160 ease-snap group-open/checks:rotate-180">
          <path d="M4.5 6.5L8 10l3.5-3.5" />
        </svg>
      </summary>
      {children}
    </details>
  );
}
