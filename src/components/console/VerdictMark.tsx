import clsx from "clsx";
import type { ReactNode } from "react";
import type { Decision } from "@/lib/types";

/** A verdict as the console says it: Paid only once PayPal has settled the payout. */
export type Verdict = Decision | "approved";

const WORD: Record<Verdict, string> = {
  paid: "Paid",
  approved: "Approved",
  held: "Held",
  rejected: "Rejected",
  blocked: "Blocked",
  pending: "In progress",
};

const TONE: Record<Verdict, string> = {
  paid: "text-pay",
  approved: "text-pay",
  held: "text-hold",
  rejected: "text-stop",
  blocked: "text-stop",
  pending: "text-faint",
};

/** The verdict's word, as the grid, the panel and the CSV say it. */
export const verdictWord = (v: Verdict) => WORD[v];

/** A claim's verdict in the console: the rule passed it (Approved) until PayPal settles the payout (Paid). */
export const verdictOf = (r: { decision: Decision; payoutStatus: string | null }): Verdict =>
  r.decision === "paid" ? (r.payoutStatus === "SUCCESS" ? "paid" : "approved") : r.decision;

// Each glyph's marks on a 14px grid, in 1.5px strokes: a ring and a check (approved), a solid disc and a knocked-out
// check (paid: the money landed), a ring and a pause (held for a person), a ring and a cross (rejected), a ring struck
// through (blocked before the photo check), a dashed ring (in progress). Shape carries the state, so it reads in
// grayscale; colour is only on the glyph.
const RING = `<circle cx="7" cy="7" r="5.75" fill="none" stroke="currentColor" stroke-width="1.5"/>`;
const stroke = (d: string, color = "currentColor", width = 1.5) =>
  `<path d="${d}" fill="none" style="stroke:${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const MARKS: Record<Verdict, string> = {
  paid: `<circle cx="7" cy="7" r="6.5" fill="currentColor"/>${stroke("M4.4 7.2l1.8 1.8 3.4-3.6", "var(--bg)", 1.6)}`,
  approved: RING + stroke("M4.7 7.2l1.6 1.6 3-3.2"),
  held: RING + stroke("M5.75 5v4M8.25 5v4"),
  rejected: RING + stroke("M5.25 5.25l3.5 3.5M8.75 5.25l-3.5 3.5"),
  blocked: RING + stroke("M3 11L11 3"),
  pending: `<circle cx="7" cy="7" r="5.75" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2.26 2.26"/>`,
};

/** The glyph as markup, for cells drawn outside React (AG Studio's grid). */
export const glyphMarkup = (v: Verdict, className = "") =>
  `<svg viewBox="0 0 14 14" aria-hidden="true" class="size-3.5 shrink-0 ${TONE[v]} ${className}">${MARKS[v]}</svg>`;

/** The verdict's glyph (MARKS). */
export function VerdictGlyph({ verdict, className }: { verdict: Verdict; className?: string }) {
  return <svg viewBox="0 0 14 14" aria-hidden="true" className={clsx("size-3.5 shrink-0", TONE[verdict], className)} dangerouslySetInnerHTML={{ __html: MARKS[verdict] }} />;
}

/** The glyph, then the word in the second ink. No chip: the word is the label, the glyph its state. `children` replaces
 * the word (the report's own label for a decision). */
export function VerdictMark({ verdict, className, children }: { verdict: Verdict; className?: string; children?: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center gap-2 text-ui whitespace-nowrap text-text-2", className)}>
      <VerdictGlyph verdict={verdict} />
      {children ?? WORD[verdict]}
    </span>
  );
}
