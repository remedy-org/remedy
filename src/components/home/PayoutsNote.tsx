import type { CSSProperties } from "react";
import { CheckIcon } from "@/components/ui";
import styles from "./home.module.css";
import { payoutsLine, TOUR } from "./tour-copy";

/**
 * Step 02's foot of the evidence: what a person does with a held claim, and where the money goes when they approve,
 * drawn as the path it takes (approved, then PayPal Payouts, then the amount, with the claim id as the payout's
 * reference) rather than told in a grey sentence. A diagram, not a control: plain words joined by lines, nothing shaped
 * like a button. On a laptop it runs in one line; on a phone it stands as a short rail, top to bottom. In the tour its
 * parts appear in order once the held claim is open (home.module.css, .flow); at rest, and under reduced motion, it is
 * whole.
 */
export function PayoutsNote({ amount, id }: { amount: string; id: string }) {
  const at = (n: number) => ({ "--at": n }) as CSSProperties;
  return (
    <div className={styles.flow}>
      <p className="sr-only">{payoutsLine(amount, id)}</p>
      <div aria-hidden="true" className={styles.flowPath}>
        <span data-flow style={at(0)} className="inline-flex items-center gap-1.5 font-medium">
          <CheckIcon size={14} className="text-pay" />
          {TOUR.payouts.approve}
        </span>
        <span data-flow="line" style={at(1)} className={styles.flowLine} />
        <span data-flow style={at(2)} className="font-medium">
          {TOUR.payouts.via}
        </span>
        <span data-flow="line" style={at(3)} className={styles.flowLine} />
        <span data-flow style={at(4)} className="font-mono">
          {amount}
        </span>
      </div>
      <p aria-hidden="true" data-flow style={at(5)} className="mt-2 text-micro text-faint">
        {TOUR.payouts.reference} <span className="font-mono">{id}</span>
      </p>
    </div>
  );
}
