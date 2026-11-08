"use client";

import clsx from "clsx";
import type { AgWidgetParams } from "ag-studio";
import type { MouseEvent } from "react";
import { funnel, KIND_LABEL, shownAs, type StopKind } from "../funnel";
import type { CheckFunnelDef } from "./defs";
import { moveBetweenItems } from "./listKeys";
import { num, useRows } from "./useRows";

// Custom widget 2: how far claims got, stage by stage. Each drop is split into the claims refused there (red) and the
// ones held for a person (blue, waiting, not refused), each with its reasons and their counts; tied reasons are never
// passed off as the top one. Clicking a drop cross-filters the page to the claims that stopped there.

const TONE: Record<StopKind, string> = { refused: "text-stop", held: "text-hold", waiting: "text-faint" };

export function CheckFunnel(params: AgWidgetParams<CheckFunnelDef>) {
  const { dataMapping, widgetApi } = params;
  const stage = dataMapping.stage?.[0];
  const reason = dataMapping.reason?.[0];
  const decision = dataMapping.decision?.[0];
  const count = dataMapping.count?.[0];
  const rows = useRows(widgetApi, () => (stage && reason && count ? [{ fields: decision ? [stage, reason, decision, count] : [stage, reason, count] }] : null), [params]);
  if (!rows || !stage || !reason || !count) return null;

  const steps = funnel(
    rows[0].map((r) => ({
      stage: String(r[stage.key]),
      stopReason: (r[reason.key] as string | null) ?? null,
      decision: decision ? ((r[decision.key] as string | null) ?? null) : "Rejected",
      count: num(r[count.key]),
    })),
  );
  const filed = steps[0].reached || 1;
  const selected = new Set(widgetApi.getCrossFilterSelections()?.flatMap((s) => (s.type === "value" ? s.values.map(String) : [])) ?? []);

  const toggle = (value: string) => (e: MouseEvent) => {
    e.stopPropagation();
    widgetApi.toggleCrossFilter({ type: "value", field: stage, value, group: 0, reset: !(e.metaKey || e.ctrlKey) });
  };

  return (
    <ol className="flex h-full min-h-0 flex-col justify-between gap-0.5 pb-1" onClick={() => widgetApi.resetCrossFilter()} onKeyDown={moveBetweenItems}>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.stage} className="flex flex-col gap-1">
            <div className="grid grid-cols-[9.5rem_2.5rem_1fr] items-center gap-3">
              <span className="truncate text-ui text-text">{shownAs(s.stage)}</span>
              <span className="text-right font-mono text-ui text-text tabular-nums">{s.reached}</span>
              <span className="relative h-3 rounded-[3px] bg-surface-2" aria-hidden="true">
                <span
                  className={clsx("absolute inset-y-0 left-0 rounded-[3px]", last ? "bg-pay" : "bg-[color-mix(in_oklch,var(--text)_26%,var(--surface))]")}
                  style={{ width: `max(2px, ${(s.reached / filed) * 100}%)` }}
                />
              </span>
            </div>
            {/* A stage where no claim stopped says nothing: the next bar's length already shows it. */}
            {!last && s.stopped > 0 && (
              <button
                type="button"
                disabled={!s.stopped}
                aria-pressed={selected.has(s.stage)}
                onClick={toggle(s.stage)}
                className={clsx(
                  "group ml-[9.5rem] flex min-h-6 items-center gap-2 rounded-control px-2 py-0.5 text-left text-micro transition-colors",
                  "disabled:cursor-default enabled:hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-0",
                  selected.has(s.stage) ? "bg-surface-2 ring-1 ring-text-2" : "",
                )}
                // The reasons in full (a long one wraps to two lines here), then what a click does.
                title={s.stopped ? [...s.groups.map((g) => `${g.count} ${KIND_LABEL[g.kind]}: ${g.summary}`), `Filter the page to these ${s.stopped}`].join("\n") : undefined}
              >
                <span aria-hidden="true" className="self-start font-mono text-faint">↳</span>
                {s.stopped ? (
                  <span className="flex min-w-0 flex-col">
                    {s.groups.map((g) => (
                      <span key={g.kind} className="flex min-w-0 items-baseline gap-2">
                        <span className={clsx("shrink-0 font-mono tabular-nums", TONE[g.kind])}>−{g.count}</span>
                        <span className={clsx("shrink-0", TONE[g.kind])}>{KIND_LABEL[g.kind]}</span>
                        <span className="line-clamp-2 text-muted group-enabled:group-hover:text-text">{g.summary}</span>
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
