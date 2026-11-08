"use client";

import clsx from "clsx";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./flow.module.css";
import { payoutWords, receiptPollDelay, type ClaimStatus } from "./model";

interface Live {
  status: string | null;
  /** The status changed while this page was open: its change animates, once. */
  changed: boolean;
}

const PayoutContext = createContext<Live>({ status: null, changed: false });

const received = (status: string | null) => payoutWords(status).tone === "pay";

export interface PayoutLiveProps {
  claimId: string;
  /** PayPal's status when the page rendered. */
  status: string | null;
  /** Ask again: a payout sent in the last 10 minutes that hasn't settled. */
  live: boolean;
  /** "$29.99", for the sentence read out when it lands. */
  amount: string;
  children: ReactNode;
}

/**
 * The paid result's one live fact, PayPal's payout status (Revolut's Pending to Completed on the same screen), shared
 * by the headline and the receipt's status row so they never disagree. It polls the claim's status route:
 * every 5 s for 30 s, then every 15 s, for 2 minutes at most, never while the tab is hidden, and stops on a settled
 * status. Each poll is one Blob read; the route asks PayPal at most once a minute.
 */
export function PayoutLive({ claimId, status: initial, live, amount, children }: PayoutLiveProps) {
  const [status, setStatus] = useState(initial);
  const [changed, setChanged] = useState(false);
  const statusRef = useRef(status);

  useEffect(() => {
    if (!live) return;
    const start = Date.now();
    let t: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const schedule = () => {
      const delay = receiptPollDelay(Date.now() - start);
      if (delay !== null && !stopped) t = setTimeout(tick, delay);
    };
    const tick = async () => {
      if (document.hidden) return schedule();
      try {
        const res = await fetch(`/api/claims/${claimId}/status`, { cache: "no-store" });
        if (!res.ok || stopped) return schedule();
        const next = ((await res.json()) as ClaimStatus).payout ?? null;
        if (next && next !== statusRef.current) {
          statusRef.current = next;
          setStatus(next);
          setChanged(true);
          if (next.toUpperCase() === "SUCCESS") navigator.vibrate?.([12, 40, 12]);
        }
        const w = payoutWords(next);
        if (w.label !== "Processing" && w.label !== "Unknown") return;
      } catch {
        // Offline for a moment: the next tick tries again.
      }
      schedule();
    };
    schedule();
    return () => {
      stopped = true;
      clearTimeout(t);
    };
  }, [claimId, live]);

  return (
    <PayoutContext.Provider value={{ status, changed }}>
      {children}
      <p className="sr-only" aria-live="polite">
        {changed ? (received(status) ? `Received. Your ${amount} refund is in your PayPal.` : `Payout status: ${payoutWords(status).label}.`) : ""}
      </p>
    </PayoutContext.Provider>
  );
}

/** Words the headline, the refund row and the receipt share, so the three never disagree: Sent, then Received. */
export const PAID_TITLE = { sent: "Refund sent to your PayPal", received: "Your refund is in your PayPal" };

/** The headline: sent while PayPal is finishing, in your PayPal once it has. The amount is the receipt's. */
export function PaidTitle() {
  const { status, changed } = useContext(PayoutContext);
  const text = received(status) ? PAID_TITLE.received : PAID_TITLE.sent;
  return (
    <span key={text} className={clsx("block", changed && styles.swap)}>
      {text}
    </span>
  );
}

/**
 * The receipt as it starts to print: when its paper would end under the fold (a phone, where it prints under the
 * checks), the slot is brought up near the top first, so the whole receipt comes out on screen. Once.
 */
export function BringIntoView({ id }: { id: string }) {
  useEffect(() => {
    const t = setTimeout(() => {
      const el = document.getElementById(id);
      const paper = el?.querySelector<HTMLElement>("[data-paper]");
      if (!el || !paper) return;
      if (el.getBoundingClientRect().top + paper.offsetHeight <= window.innerHeight) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    }, 80);
    return () => clearTimeout(t);
  }, [id]);
  return null;
}

/** The receipt's PayPal row: PayPal's own word for the payout, and while it's processing, one line of why. */
export function PayoutRow() {
  const { status, changed } = useContext(PayoutContext);
  const words = payoutWords(status);
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 border-b border-dashed border-paper-line py-2.5">
      <dt className="text-ink-muted">PayPal</dt>
      <dd key={words.label} className={clsx("text-right font-medium", words.tone === "pay" ? "text-pay-ink" : "text-ink", changed && styles.swap)}>
        {words.label}
      </dd>
      {words.tone !== "pay" && words.note && <dd className="col-span-2 mt-0.5 text-pretty text-ink-muted">{words.note}</dd>}
    </div>
  );
}
