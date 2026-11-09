"use client";

import clsx from "clsx";
import type { StillClaim } from "@/components/console/EvidenceStill";
import { quickReasons } from "@/components/console/quickReasons";
import { CheckIcon } from "@/components/ui";
import styles from "./tour.module.css";
import { payoutsLine, TOUR } from "./tour-copy";

const BUTTON = "inline-flex h-9 items-center rounded-button px-3.5 text-ui font-medium whitespace-nowrap select-none";

/**
 * The phone story's foot of the evidence: the console panel's own review buttons (ReviewActions.tsx), Approve in brass
 * and Reject as the quiet button, then one muted line on what approving does. A picture of the console, never a control:
 * the buttons are drawn spans, hidden from screen readers, who read the line.
 */
export function PayoutsNote({ amount, id }: { amount: string; id: string }) {
  return (
    <div className={styles.review}>
      <div aria-hidden="true" className="flex gap-2">
        <span className={`btn-primary ${BUTTON}`}>{TOUR.payouts.pay(amount)}</span>
        <span className={`btn-quiet ${BUTTON}`}>{TOUR.payouts.reject}</span>
      </div>
      <p className="mt-2 text-ui text-muted">{payoutsLine(id)}</p>
    </div>
  );
}

/** Where a visitor has taken a held claim's review in the tour: nothing yet, a confirm or a reason open, sending, done. */
export type ReviewPhase = "idle" | "confirm" | "paying" | "paid" | "reject" | "rejecting" | "rejected";

/**
 * The tour's foot of the evidence, as the console panel's review works (ReviewActions.tsx), played in the browser alone:
 * no request is made. A held claim: Approve $29.99… asks "Approve $29.99 for •••• DSFD?", as the console does for its
 * own claims (nothing is sent through PayPal), and reads "Approving…" for a moment before it lands; Reject… shows the reason the owner would read, and rejecting it refuses the claim.
 * A claim decided before: what happened to the money, in one line.
 */
export function ReviewFoot({ claim, phase, onPhase }: { claim: StillClaim; phase: ReviewPhase; onPhase: (p: ReviewPhase) => void }) {
  const line = (text: string, done = false) => (
    <p role="status" className={clsx("flex items-start gap-2 text-ui", done ? "text-text-2" : "text-muted")}>
      {done && <CheckIcon size={14} className="mt-[3px] shrink-0 text-pay" />}
      <span>{text}</span>
    </p>
  );
  if (!claim.review) {
    // Paid only where PayPal paid; a claim approved with nothing sent says so.
    if (claim.decision === "paid") return claim.payout?.status === "SUCCESS" ? line(TOUR.payouts.sent(claim.amount, claim.id), true) : line(TOUR.payouts.approved(claim.amount), true);
    if (claim.decision === "rejected" || claim.decision === "blocked") return line(TOUR.payouts.refused);
    return null;
  }
  if (phase === "paid") return line(TOUR.payouts.approved(claim.amount), true);
  if (phase === "rejected") return line(TOUR.payouts.rejected);
  const reason = quickReasons(claim.checks.map((c) => ({ id: c.id, state: c.outcome })))[0]?.text(claim.code) ?? null;
  return (
    <div className={styles.review}>
      {phase === "confirm" && (
        <p className="mb-2 text-ui text-text">
          Approve <span className="font-mono">{claim.amount}</span> for <span className="font-mono">{claim.payer}</span>? Nothing is sent through PayPal.
        </p>
      )}
      {phase === "reject" && reason && <p className="mb-2 text-ui text-muted">{TOUR.payouts.reason(reason)}</p>}
      <div className="flex gap-2">
        {phase === "idle" && (
          <>
            <button type="button" onClick={() => onPhase("confirm")} className={clsx("btn-primary cursor-pointer", BUTTON)}>
              {TOUR.payouts.pay(claim.amount)}
            </button>
            <button type="button" onClick={() => onPhase("reject")} className={clsx("btn-quiet cursor-pointer", BUTTON)}>
              {TOUR.payouts.reject}
            </button>
          </>
        )}
        {(phase === "confirm" || phase === "paying") && (
          <button
            type="button"
            autoFocus
            aria-busy={phase === "paying" || undefined}
            data-pending={phase === "paying" || undefined}
            onClick={() => phase === "confirm" && onPhase("paying")}
            className={clsx("btn-primary", BUTTON, phase === "paying" ? "cursor-default opacity-60" : "cursor-pointer")}
          >
            {phase === "paying" ? TOUR.payouts.paying : `${TOUR.payouts.confirm} ${claim.amount}`}
          </button>
        )}
        {(phase === "reject" || phase === "rejecting") && (
          <button
            type="button"
            autoFocus
            aria-busy={phase === "rejecting" || undefined}
            onClick={() => phase === "reject" && onPhase("rejecting")}
            className={clsx("btn-quiet", BUTTON, phase === "rejecting" ? "cursor-default opacity-60" : "cursor-pointer")}
          >
            {phase === "rejecting" ? TOUR.payouts.rejecting : TOUR.payouts.rejectClaim}
          </button>
        )}
        {(phase === "confirm" || phase === "reject") && (
          <button type="button" onClick={() => onPhase("idle")} className={clsx("btn-quiet cursor-pointer", BUTTON)}>
            Cancel
          </button>
        )}
      </div>
      {phase === "idle" && <p className="mt-2 text-ui text-muted">{payoutsLine(claim.id)}</p>}
    </div>
  );
}
