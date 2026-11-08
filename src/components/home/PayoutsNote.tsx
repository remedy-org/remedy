import type { CSSProperties } from "react";
import { CheckIcon } from "@/components/ui";
import styles from "./tour.module.css";
import { payoutsLine, TOUR } from "./tour-copy";

/**
 * Step 02's foot of the evidence: where the money goes when a person approves the held claim, drawn as the path it
 * takes (Approve, then PayPal Payouts, then the amount) rather than told in a grey sentence. A picture, not a control:
 * plain words joined by lines, nothing shaped like a button, one line at every width. The sentence for screen readers
 * says it in full, with the claim id as the payout's reference. In the tour its parts draw in order once the held claim
 * is open (tour.module.css, .flow); at rest, and under reduced motion, it is whole.
 */
export function PayoutsNote({ amount, id }: { amount: string; id: string }) {
  const at = (n: number) => ({ "--at": n }) as CSSProperties;
  return (
    <div className={styles.flow}>
      <p className="sr-only">{payoutsLine(amount, id)}</p>
      <div aria-hidden="true" className={styles.flowPath}>
        <span data-flow style={at(0)} className="inline-flex items-center gap-1.5">
          <CheckIcon data-check size={14} className="text-muted" />
          {TOUR.payouts.approve}
        </span>
        <span data-flow="line" style={at(1)} className={styles.flowLine} />
        <span data-flow style={at(2)}>{TOUR.payouts.via}</span>
        <span data-flow="line" style={at(3)} className={styles.flowLine} />
        <span data-flow style={at(4)} className="font-medium">
          {amount}
        </span>
      </div>
    </div>
  );
}
