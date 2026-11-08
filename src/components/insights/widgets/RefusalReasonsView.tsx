import clsx from "clsx";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";

// Why claims were refused, as plain props: each reason tagged with the kind of check that caught it (a pre-check that
// needs no AI, the model reading the photo, or a person). Refusals are always --stop, never a palette slot. The
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
}

export function RefusalReasonsView({ items, selected = new Set(), onToggle, onReset, onKeyDown, compact, flush = false }: RefusalReasonsViewProps) {
  if (!items.length) {
    return <p className="flex h-full items-center justify-center text-ui text-muted">No claim was refused.</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.count));
  const total = items.reduce((n, i) => n + i.count, 0);
  const Item = onToggle ? "button" : "div";
  const figure = flush ? "tabular-nums" : "font-mono tabular-nums";

  return (
    <div className={clsx("flex min-h-0 flex-col gap-2", flush ? "" : "h-full px-1.5 pb-1")} onClick={onReset}>
      <p className="text-micro text-muted">
        <span className={clsx("text-text", figure)}>{total}</span> refused. Each reason names the check that caught it.
      </p>
      <ul className={clsx("flex min-h-0 flex-col", flush ? "gap-1" : "flex-1 overflow-y-auto")} onKeyDown={onKeyDown}>
        {items.map((i, n) => (
          <li key={i.reason}>
            <Item
              {...(onToggle ? { type: "button" as const, "aria-pressed": selected.has(i.reason), onClick: onToggle(i.reason) } : {})}
              className={clsx(
                "grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-control py-1 text-left",
                !flush && "px-2",
                onToggle && "transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-0",
                selected.has(i.reason) && "bg-accent-soft ring-1 ring-accent",
                selected.size > 0 && !selected.has(i.reason) && "opacity-45",
              )}
            >
              <span className={clsx("flex min-w-0 gap-2", compact ? "flex-col items-start gap-y-0.5" : "items-center")}>
                <span className={clsx("text-ui text-text", !compact && "truncate")}>{i.reason}</span>
                <span className="shrink-0 text-micro text-muted">{i.gate}</span>
              </span>
              <span className={clsx("text-right text-ui text-text", compact && "self-start", figure)}>{i.count}</span>
              <span aria-hidden="true" className="col-span-2 h-1.5 rounded-full bg-surface-2">
                <span data-bar="refusal" className="block h-full rounded-full bg-stop" style={{ width: `${(i.count / max) * 100}%`, "--i": n } as CSSProperties} />
              </span>
            </Item>
          </li>
        ))}
      </ul>
    </div>
  );
}
