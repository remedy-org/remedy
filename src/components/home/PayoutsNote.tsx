import styles from "./tour.module.css";
import { payoutsLine, TOUR } from "./tour-copy";

/**
 * Step 02's foot of the evidence: the console panel's own review buttons (ReviewActions.tsx), Pay in brass and Reject
 * as the quiet button, then one muted line on where the money goes. A picture of the console, never a control: the
 * buttons are drawn spans, hidden from screen readers, who read the line. The tour's panel is inert as a whole.
 */
export function PayoutsNote({ amount, id }: { amount: string; id: string }) {
  const button = "inline-flex h-9 items-center rounded-button px-3.5 text-ui font-medium whitespace-nowrap select-none";
  return (
    <div className={styles.review}>
      <div aria-hidden="true" className="flex gap-2">
        <span className={`btn-primary ${button}`}>{TOUR.payouts.pay(amount)}</span>
        <span className={`btn-quiet ${button}`}>{TOUR.payouts.reject}</span>
      </div>
      <p className="mt-2 text-ui text-muted">{payoutsLine(id)}</p>
    </div>
  );
}
