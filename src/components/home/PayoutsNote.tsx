import type { CSSProperties } from "react";
import styles from "./home.module.css";
import { payoutsLine, TOUR } from "./tour-copy";

/**
 * Step 02's foot of the evidence: what a person does with a held claim, and where the money goes when they approve,
 * drawn as the path it takes (Approve, then PayPal Payouts, then the amount, with the claim id as the payout's
 * reference) rather than told in a grey sentence. A picture of the flow, not a control: nothing in it can be pressed
 * (the tour's frame is inert; the phone story reads the sentence). In the tour its parts appear in order once the held
 * claim is open (home.module.css, .flow), each line drawn like ink; at rest, and under reduced motion, it is whole.
 */
export function PayoutsNote({ amount, id }: { amount: string; id: string }) {
  const at = (n: number) => ({ "--at": n }) as CSSProperties;
  return (
    <div className={styles.flow}>
      <p className="sr-only">{payoutsLine(amount, id)}</p>
      <div aria-hidden="true" className="flex flex-wrap items-center gap-x-2 gap-y-2 text-ui whitespace-nowrap">
        <span data-flow style={at(0)} className="inline-flex h-7 items-center rounded-control bg-surface-2 px-2.5 font-medium shadow-[inset_0_0_0_1px_var(--line-2)]">
          {TOUR.payouts.approve}
        </span>
        <span data-flow="line" style={at(1)} className={styles.flowLine} />
        <span data-flow style={at(2)} className="font-medium">
          {TOUR.payouts.via}
        </span>
        {/* The last leg and the amount wrap together, so a narrow phone's second line still reads "→ $29.99". */}
        <span className="flex min-w-20 flex-1 items-center gap-2">
          <span data-flow="line" style={at(3)} className={styles.flowLine} />
          <span data-flow style={at(4)} className="font-mono">
            {amount}
          </span>
        </span>
      </div>
      <p aria-hidden="true" data-flow style={at(5)} className="mt-1.5 font-mono text-micro whitespace-nowrap text-faint">
        {TOUR.payouts.reference} {id}
      </p>
    </div>
  );
}
