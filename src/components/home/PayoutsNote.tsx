import type { CSSProperties } from "react";
import { CheckIcon } from "@/components/ui";
import styles from "./home.module.css";
import { payoutsLine, TOUR } from "./tour-copy";

/**
 * Step 02's foot of the evidence: what a person does with a held claim, and where the money goes when they approve,
 * drawn as the path it takes (approved, then PayPal Payouts, then the amount, with the claim id as the payout's
 * reference) rather than told in a grey sentence. A diagram, not a control: plain words joined by lines, nothing shaped
 * like a button: the words in the text colour, the check mark muted. One line at every width. In the tour its parts
 * appear in order once the held claim is open (home.module.css, .flow); at rest, and under reduced motion, it is whole.
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
      <p aria-hidden="true" data-flow style={at(5)} className="mt-2 text-micro text-muted">
        {TOUR.payouts.reference} <span className="font-mono text-text-2">{id}</span>
      </p>
    </div>
  );
}
