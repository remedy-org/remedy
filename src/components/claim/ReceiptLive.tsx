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
        if (w.label !== "Sent" && w.label !== "Unknown") return;
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

/** The refund row's word on the result: Sent, then Received in the paid colour. */
export function PayoutWord() {
  const { status, changed } = useContext(PayoutContext);
  const got = received(status);
  return (
    <span key={String(got)} className={clsx(got && "text-pay", changed && styles.swap)}>
      {got ? "Received" : "Sent"}
    </span>
  );
}

/** The receipt as it prints: brought into view once, so the money arriving is on screen, not under the fold. */
export function BringIntoView({ id }: { id: string }) {
  useEffect(() => {
    const t = setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      const { bottom } = el.getBoundingClientRect();
      if (bottom <= window.innerHeight) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "end", behavior: reduced ? "auto" : "smooth" });
    }, 360);
    return () => clearTimeout(t);
  }, [id]);
  return null;
}

/** The receipt's payout status row: a word, and while it's processing, one line of why. */
export function PayoutRow() {
  const { status, changed } = useContext(PayoutContext);
  const words = payoutWords(status);
  return (
    <div className="flex flex-col gap-1 border-b border-paper-line py-3">
      <div className="flex items-baseline justify-between gap-4 text-ui">
        <dt className="shrink-0 text-ink-muted">Payout status</dt>
        <dd key={words.label} className={clsx("font-medium text-ink", changed && styles.swap)}>
          {words.label}
        </dd>
      </div>
      {words.tone !== "pay" && words.note && <p className="mt-1 text-pretty text-ui text-ink-muted">{words.note}</p>}
    </div>
  );
}
