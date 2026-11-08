"use client";

import clsx from "clsx";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Stamp } from "@/components/ui";
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
 * by the headline, the receipt's status row and its stamp so they never disagree. It polls the claim's status route:
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
        if (w.label !== "Processing at PayPal" && w.label !== "Unknown") return;
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
        {changed ? (received(status) ? `Received. ${amount} is in your PayPal.` : `Payout status: ${payoutWords(status).label}.`) : ""}
      </p>
    </PayoutContext.Provider>
  );
}

/** The headline: on its way while PayPal is finishing, in your PayPal once it has. The one change crossfades. */
export function PaidTitle({ amount }: { amount: string }) {
  const { status, changed } = useContext(PayoutContext);
  const text = received(status) ? `${amount} is in your PayPal` : `${amount} is on its way to your PayPal`;
  return (
    <span key={text} className={clsx("block", changed && styles.swap)}>
      {text}
    </span>
  );
}

/** PAID, stamped only once PayPal says the money arrived: before that the receipt says it's processing, never both. */
export function PaidStamp({ arrive }: { arrive: boolean }) {
  const { status, changed } = useContext(PayoutContext);
  if (!received(status)) return null;
  return (
    <Stamp tone="pay" land={changed ? 0 : arrive ? 1060 : undefined}>
      Paid
    </Stamp>
  );
}

/** The receipt's payout status row: a word, and while it's processing, one line of why. */
export function PayoutRow() {
  const { status, changed } = useContext(PayoutContext);
  const words = payoutWords(status);
  return (
    <div className="flex flex-col gap-1 border-b border-dashed border-paper-line py-3">
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
