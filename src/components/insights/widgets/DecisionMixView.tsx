import clsx from "clsx";
import type { KeyboardEvent, MouseEvent } from "react";
import { VerdictGlyph, type Verdict } from "@/components/console/VerdictMark";
import { shownAs } from "../funnel";

// What the rule decided, as plain props: one 100% bar in the charts' palette (theme.ts), Paid as an area is --pay-fill.
// A built-in donut takes its colours from palette order, so a decision's colour would depend on the data; this can't.
// The console's Studio widget (DecisionMix.tsx) makes each decision a cross-filter button; the homepage's still renders
// it from the seed with nothing to press.

// Paid, Sent, settling and Approved apart (lib/payoutWords.ts), as the queue's tabs and the CPSC report count them.
const ORDER = ["Paid", "Sent, settling", "Approved", "Held", "Rejected", "Blocked", "In progress"];
const FILL: Record<string, string> = {
  Paid: "bg-pay-fill",
  "Sent, settling": "bg-[color-mix(in_oklch,var(--pay-fill)_65%,var(--surface))]",
  Approved: "bg-[color-mix(in_oklch,var(--pay-fill)_35%,var(--surface))]",
  Held: "bg-hold",
  Rejected: "bg-stop",
  Blocked: "bg-[color-mix(in_oklch,var(--stop)_55%,var(--surface))]",
  "In progress": "bg-faint",
};
// Shape as well as colour: each decision's key is the queue's own verdict glyph.
const GLYPH: Record<string, Verdict> = { Paid: "paid", "Sent, settling": "settling", Approved: "approved", Held: "held", Rejected: "rejected", Blocked: "blocked", "In progress": "pending" };

/** Each decision with its claims, in the queue's order, none at zero. */
export function decisionItems(tally: ReadonlyMap<string, number>) {
  return [...tally.keys()]
    .sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99))
    .map((label) => ({ label, n: tally.get(label)! }))
    .filter((i) => i.n > 0);
}

export interface DecisionMixViewProps {
  items: { label: string; n: number }[];
  selected?: Set<string>;
  onToggle?: (value: string) => (e: MouseEvent) => void;
  onReset?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
}

export function DecisionMixView({ items, selected = new Set(), onToggle, onReset, onKeyDown }: DecisionMixViewProps) {
  const total = items.reduce((s, i) => s + i.n, 0) || 1;
  const share = (n: number) => `${Math.round((n / total) * 100)}%`;
  const row = "grid w-full grid-cols-[1fr_auto_3rem] items-center gap-3 rounded-control px-2 py-0.5 text-left";
  const cells = (i: { label: string; n: number }) => (
    <>
      <span className="flex items-center gap-2 text-ui text-text">
        <VerdictGlyph verdict={GLYPH[i.label] ?? "pending"} />
        {shownAs(i.label)}
      </span>
      <span className="font-mono text-ui text-text tabular-nums">{i.n}</span>
      <span className="text-right font-mono text-micro text-faint tabular-nums">{share(i.n)}</span>
    </>
  );

  return (
    // An 8px gutter on the right, so a pick ring and the shares inside it never meet the panel's edge.
    <div className="flex h-full min-h-0 flex-col gap-3 pr-2 pb-1" onClick={onReset}>
      <div aria-hidden="true" className="flex h-3 gap-0.5 overflow-hidden rounded-[3px]">
        {items.map((i) => (
          <span key={i.label} className={clsx("h-full min-w-[3px]", FILL[i.label] ?? "bg-faint", selected.size > 0 && !selected.has(i.label) && "opacity-30")} style={{ flexGrow: i.n }} />
        ))}
      </div>
      {/* Each row's hover tint reaches 8px past the bar on the left, so the marks and words start on the bar's own edge; on the
          right it ends on the panel's edge, its figures 8px inside the pick ring, never cut by the panel. */}
      <ul className="-ml-2 flex min-h-0 flex-col" onKeyDown={onKeyDown}>
        {items.map((i) => (
          <li key={i.label}>
            {onToggle ? (
              <button
                type="button"
                aria-pressed={selected.has(i.label)}
                onClick={onToggle(i.label)}
                className={clsx(
                  row,
                  "transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-0",
                  selected.has(i.label) && "bg-surface-2 ring-1 ring-text-2 ring-inset",
                  selected.size > 0 && !selected.has(i.label) && "opacity-45",
                )}
              >
                {cells(i)}
              </button>
            ) : (
              <div className={row}>{cells(i)}</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
