"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import styles from "./flow.module.css";
import { payoutWords, receiptPollDelay, type ClaimStatus, type Tone } from "./model";

const DOT: Record<Tone, string> = { pay: "bg-pay-ink", hold: "bg-hold-ink", stop: "bg-stop-ink", muted: "bg-ink-muted" };

export interface ReceiptLiveProps {
  claimId: string;
  /** PayPal's status when the page rendered. */
  status: string | null;
  /** Ask again: a payout sent in the last 10 minutes that hasn't settled. */
  live: boolean;
  /** "$29.99", for the sentence read out when it lands. */
  amount: string;
  /** A sandbox build or a demo claim: the note points to the PayPal activity page instead of an email. */
  sandbox?: boolean;
  /** PayPal's activity page, linked from the note (a quiet ink link: the receipt has no amber). */
  activityUrl?: string;
}

/**
 * The receipt's payout status, live (Revolut's Pending to Completed on the same screen). It polls the claim's status
 * route: every 5 s for 30 s, then every 15 s, for 2 minutes at most, never while the tab is hidden, and stops on a
 * settled status. Each poll is one Blob read; the route asks PayPal at most once a minute.
 */
export function ReceiptLive({ claimId, status: initial, live, amount, sandbox, activityUrl }: ReceiptLiveProps) {
  const [status, setStatus] = useState(initial);
  const [changed, setChanged] = useState(false);
  const words = payoutWords(status);
  const settled = words.label !== "Processing at PayPal" && words.label !== "Unknown";
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
    <div className="flex flex-col gap-1 border-b border-dashed border-paper-line py-3">
      <div className="flex items-baseline justify-between gap-4 text-ui">
        <dt className="shrink-0 text-ink-muted">Payout status</dt>
        <dd key={words.label} className={clsx("inline-flex items-center gap-2 font-medium text-ink", changed && styles.swap)}>
          <span className={clsx("relative size-2 shrink-0 rounded-full", DOT[words.tone], !settled && live && clsx("text-ink-muted", styles.pulse))} aria-hidden="true" />
          {words.label}
        </dd>
      </div>
      {/* A full-width line of its own, left-aligned under the status, so it reads as a sentence and never wraps ragged. */}
      <p className="mt-1 text-pretty text-ui text-ink-muted">
        {/* While it's processing, the note says why the PAID stamp sits above it: Remedy sent it, PayPal is finishing. */}
        {sandbox ? (
          <>
            {settled ? "" : `${words.note} `}See it in your{" "}
            {activityUrl ? (
              <a href={activityUrl} target="_blank" rel="noreferrer" className="rounded-control text-ink underline decoration-paper-line underline-offset-4 hover:decoration-ink">
                PayPal activity<span className="sr-only"> (opens PayPal in a new tab)</span>
              </a>
            ) : (
              "PayPal activity"
            )}
            .
          </>
        ) : (
          words.note
        )}
      </p>
      <p className="sr-only" aria-live="polite">
        {changed && words.tone === "pay" ? `Received. ${amount} is in your PayPal account.` : changed ? `Payout status: ${words.label}.` : ""}
      </p>
    </div>
  );
}
