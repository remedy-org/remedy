import clsx from "clsx";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import { KIND_LABEL, shownAs, type FunnelStep, type StopKind } from "../funnel";

// The check funnel as plain props: how far claims got, stage by stage. Each drop is split into the claims refused there
// (red) and the ones held for a person (blue, waiting, not refused), each with its reasons and their counts; tied
// reasons are never passed off as the top one. The console's Studio widget (CheckFunnel.tsx) feeds it Studio's rows and
// makes each drop a cross-filter button; the homepage's still renders it from the seed with nothing to press.

const TONE: Record<StopKind, string> = { refused: "text-stop", held: "text-hold", waiting: "text-faint" };

export interface CheckFunnelViewProps {
  steps: FunnelStep[];
  /** The stages picked in the page's cross-filter. */
  selected?: Set<string>;
  /** With these, each drop is a button that filters the page (the console); without, plain text (the homepage). */
  onToggle?: (stage: string) => (e: MouseEvent) => void;
  onReset?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
  /** Phones: each stage's name and count over its bar, the drops under it (as the console's MobileSummary). */
  compact?: boolean;
  /** Spread the stages over the card's height (the console's canvas); off, they sit 16px apart from the top. */
  spread?: boolean;
  /** The homepage: on the card's own content edge (no inset), figures in the sans face. */
  flush?: boolean;
}

export function CheckFunnelView({ steps, selected = new Set(), onToggle, onReset, onKeyDown, compact, spread = true, flush = false }: CheckFunnelViewProps) {
  const filed = steps[0]?.reached || 1;
  const figure = flush ? "tabular-nums" : "font-mono tabular-nums";
  if (compact) {
    return (
      <ol className="flex flex-col gap-2">
        {steps.map((s, i) => (
          <li key={s.stage} className="flex flex-col gap-1">
            <div className="grid grid-cols-[1fr_2rem] items-center gap-2 text-ui">
              <span>{s.stage}</span>
              <span className={clsx("text-right", figure)}>{s.reached}</span>
            </div>
            <span aria-hidden="true" className="h-2 rounded-[3px] bg-surface-2">
              <span
                className={clsx("block h-full rounded-[3px]", i === steps.length - 1 ? "bg-pay" : "bg-[color-mix(in_oklch,var(--text)_26%,var(--surface))]")}
                style={{ width: `${(s.reached / filed) * 100}%` }}
              />
            </span>
            {i < steps.length - 1 &&
              s.groups.map((g) => (
                // Every reason in full, wrapping: a phone has no hover to read a cut one.
                <p key={g.kind} className="text-micro text-pretty text-muted">
                  <span className={clsx(figure, TONE[g.kind])}>−{g.count}</span> <span className={TONE[g.kind]}>{KIND_LABEL[g.kind]}</span> · {g.summary}
                </p>
              ))}
          </li>
        ))}
      </ol>
    );
  }
  const Drop = onToggle ? "button" : "div";
  const list = (
    <ol className={clsx("flex min-h-0 flex-col", flush ? "flex-1" : "h-full pb-1", spread ? "justify-between gap-0.5" : "gap-4")} onClick={onReset} onKeyDown={onKeyDown}>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.stage} className="flex flex-col gap-1">
            <div className="grid grid-cols-[11.5rem_2.5rem_1fr] items-center gap-3">
              <span className="truncate text-ui text-text">{flush ? s.stage : shownAs(s.stage)}</span>
              <span className={clsx("text-right text-ui text-text", figure)}>{s.reached}</span>
              <span className="relative h-3 rounded-[3px] bg-surface-2" aria-hidden="true">
                <span
                  data-bar="funnel"
                  className={clsx("absolute inset-y-0 left-0 rounded-[3px]", last ? "bg-pay" : "bg-[color-mix(in_oklch,var(--text)_26%,var(--surface))]")}
                  style={{ width: `max(2px, ${(s.reached / filed) * 100}%)`, "--i": i } as CSSProperties}
                />
              </span>
            </div>
            {/* A stage where no claim stopped says nothing: the next bar's length already shows it. */}
            {!last && s.stopped > 0 && (
              <Drop
                {...(onToggle
                  ? {
                      type: "button" as const,
                      disabled: !s.stopped,
                      "aria-pressed": selected.has(s.stage),
                      onClick: onToggle(s.stage),
                      // The reasons in full (a long one wraps to two lines here), then what a click does.
                      title: s.stopped ? [...s.groups.map((g) => `${g.count} ${KIND_LABEL[g.kind]}: ${g.summary}`), `Filter the page to these ${s.stopped}`].join("\n") : undefined,
                    }
                  : {})}
                className={clsx(
                  "group ml-[11.5rem] flex min-h-6 items-center gap-2 rounded-control py-0.5 text-left text-micro transition-colors",
                  flush ? "pl-3" : "px-2",
                  onToggle && "disabled:cursor-default enabled:hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-0",
                  selected.has(s.stage) ? "bg-surface-2 ring-1 ring-text-2 ring-inset" : "",
                )}
              >
                <span className="flex min-w-0 flex-col">
                    {s.groups.map((g) => (
                      <span key={g.kind} className="flex min-w-0 items-baseline gap-2">
                        <span className={clsx("shrink-0", figure, TONE[g.kind])}>−{g.count}</span>
                        <span className={clsx("shrink-0", TONE[g.kind])}>{KIND_LABEL[g.kind]}</span>
                        {/* A narrow card (a 1024px screen) wraps the reasons to a second line, never cutting one mid-word. */}
                        <span
                          title={flush && !onToggle ? g.summary : undefined}
                          className={clsx("line-clamp-2", "text-muted", onToggle && "group-enabled:group-hover:text-text")}
                        >
                          {g.summary}
                        </span>
                      </span>
                    ))}
                </span>
              </Drop>
            )}
          </li>
        );
      })}
    </ol>
  );
  if (!flush) return list;
  // The homepage: the funnel's outcome under it, filed to paid, where the card has room for it (a 900px laptop
  // screen and up); the stages keep a steady pitch above it instead of spreading over the whole card.
  const paid = steps.at(-1)?.reached ?? 0;
  const out = (kind: StopKind) => steps.reduce((n, s) => n + s.groups.filter((g) => g.kind === kind).reduce((m, g) => m + g.count, 0), 0);
  const stopped = [
    [out("refused"), KIND_LABEL.refused],
    [out("held"), KIND_LABEL.held],
    [out("waiting"), KIND_LABEL.waiting],
  ].filter(([n]) => n) as [number, string][];
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 [container-type:size]">
      {list}
      <p className="hidden shrink-0 items-baseline justify-between gap-4 border-t border-line pt-3 [@container(min-height:20rem)]:flex">
        <span className="min-w-0 truncate text-micro text-muted">
          <span className="text-ui text-text">Filed to paid</span> · {paid} of {filed} claims
          {stopped.length > 0 && `; ${stopped.map(([n, w]) => `${n} ${w}`).join(", ")}`}
        </span>
        <span className="shrink-0 text-[22px] leading-none">{Math.round((paid / filed) * 100)}%</span>
      </p>
    </div>
  );
}
