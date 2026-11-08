import clsx from "clsx";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";

// Why claims were refused, as plain props: each reason tagged with the kind of check that caught it (a pre-check that
// needs no AI, the model reading the photo, or a person). Never a palette slot. The
// console's Studio widget (RefusalReasons.tsx) makes each reason a cross-filter button; the homepage's still renders
// it from the seed with nothing to press.

export interface RefusalItem {
  reason: string;
  gate: string;
  count: number;
}

export interface RefusalReasonsViewProps {
  /** Commonest first. */
  items: RefusalItem[];
  selected?: Set<string>;
  onToggle?: (reason: string) => (e: MouseEvent) => void;
  onReset?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
  /** Phones: a long reason wraps instead of being cut, its gate under it. */
  compact?: boolean;
  /** The homepage: on the card's own content edge (no inset), the list as tall as its rows, figures in the sans face. */
  flush?: boolean;
  /** The console: where each gate caught its claims, in words ("by a pre-check"), on the line under the reason. */
  caughtBy?: Record<string, string>;
}

export function RefusalReasonsView({ items, selected = new Set(), onToggle, onReset, onKeyDown, compact, flush = false, caughtBy }: RefusalReasonsViewProps) {
  if (!items.length) {
    return <p className="flex h-full items-center justify-center text-ui text-muted">No claim was refused.</p>;
  }
  const total = items.reduce((n, i) => n + i.count, 0);
  // The homepage scales each bar to all the refusals (3 of 9 draws a third), in one muted red: the count says the rest.
  // The console scales to the commonest reason, which its cross-filter picks between, in the funnel's muted ink: the
  // title already says these were refused.
  const max = flush ? Math.max(1, total) : Math.max(1, ...items.map((i) => i.count));
  const Item = onToggle ? "button" : "div";
  const figure = flush ? "tabular-nums" : "font-mono tabular-nums";

  return (
    <div className={clsx("flex min-h-0 flex-col gap-2", flush ? "" : "h-full pb-1")} onClick={onReset}>
      {/* The list starts with the reasons: the title says what they are. In the console each reason's hover tint reaches
          8px past the column, so its words start on the panel title's edge. */}
      <ul className={clsx("flex min-h-0 flex-col", flush ? "gap-1" : "-mx-2 flex-1 overflow-y-auto")} onKeyDown={onKeyDown}>
        {items.map((i, n) => (
          <li key={i.reason}>
            <Item
              {...(onToggle ? { type: "button" as const, "aria-pressed": selected.has(i.reason), onClick: onToggle(i.reason) } : {})}
              className={clsx(
                "grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-control text-left",
                flush ? "py-0.5" : "px-2 py-1",
                onToggle && "transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-0",
                selected.has(i.reason) && "bg-surface-2 ring-1 ring-text-2",
                selected.size > 0 && !selected.has(i.reason) && "opacity-45",
              )}
            >
              {caughtBy ? (
                // The reason whole, its count beside it, and where it was caught on the line under it: never cut off.
                <span className="min-w-0 text-ui text-text">{i.reason}</span>
              ) : (
                <span className={clsx("flex min-w-0 gap-2", compact ? "flex-col items-start gap-y-0.5" : "items-center")}>
                  <span className={clsx("text-ui text-text", !compact && "truncate")}>{i.reason}</span>
                  <span className="shrink-0 text-micro text-muted">{i.gate}</span>
                </span>
              )}
              <span className={clsx("text-right text-ui text-text", (compact || caughtBy) && "self-start", figure)}>{i.count}</span>
              {caughtBy?.[i.gate] && <span className="col-span-2 -mt-1 text-micro text-muted">Caught {caughtBy[i.gate]}</span>}
              <span aria-hidden="true" className="col-span-2 h-1.5 rounded-full bg-surface-2">
                <span
                  data-bar="refusal"
                  className={clsx("block h-full rounded-full", flush ? "bg-[color-mix(in_oklch,var(--stop)_55%,var(--surface))]" : "bg-[color-mix(in_oklch,var(--text)_26%,var(--surface))]")}
                  style={{ width: `${(i.count / max) * 100}%`, "--i": n } as CSSProperties}
                />
              </span>
            </Item>
          </li>
        ))}
      </ul>
    </div>
  );
}
