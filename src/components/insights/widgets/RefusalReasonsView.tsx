import clsx from "clsx";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";

// Why claims were refused, as plain props: each reason tagged with the kind of check that caught it (a pre-check that
// needs no AI, the model reading the photo, or a person). Refusals are always --stop, never a palette slot. The
// console's Studio widget (RefusalReasons.tsx) makes each reason a cross-filter button; the homepage's still renders
// it from the seed with nothing to press.

export const GATE_LABEL: Record<string, string> = { "No AI": "NO AI", "Model reads": "MODEL READS", Person: "PERSON" };

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
  /** Phones: a long reason wraps instead of being cut, its chip after it. */
  compact?: boolean;
}

export function RefusalReasonsView({ items, selected = new Set(), onToggle, onReset, onKeyDown, compact }: RefusalReasonsViewProps) {
  if (!items.length) {
    return <p className="flex h-full items-center justify-center text-ui text-muted">No claim was refused.</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.count));
  const total = items.reduce((n, i) => n + i.count, 0);
  const Item = onToggle ? "button" : "div";

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 px-1.5 pb-1" onClick={onReset}>
      <p className="text-micro text-muted">
        <span className="font-mono text-text tabular-nums">{total}</span> refused. Each reason names the check that caught it.
      </p>
      <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto" onKeyDown={onKeyDown}>
        {items.map((i, n) => (
          <li key={i.reason}>
            <Item
              {...(onToggle ? { type: "button" as const, "aria-pressed": selected.has(i.reason), onClick: onToggle(i.reason) } : {})}
              className={clsx(
                "grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-control px-2 py-1 text-left",
                onToggle && "transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-0",
                selected.has(i.reason) && "bg-accent-soft ring-1 ring-accent",
                selected.size > 0 && !selected.has(i.reason) && "opacity-45",
              )}
            >
              <span className={clsx("flex min-w-0 items-center gap-2", compact && "flex-wrap gap-y-1")}>
                <span className={clsx("text-ui text-text", !compact && "truncate")}>{i.reason}</span>
                <span className="shrink-0 rounded-[4px] border border-line px-1.5 font-mono text-micro leading-[1.125rem] tracking-[0.06em] text-muted">{GATE_LABEL[i.gate] ?? i.gate.toUpperCase()}</span>
              </span>
              <span className="text-right font-mono text-ui text-text tabular-nums">{i.count}</span>
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
