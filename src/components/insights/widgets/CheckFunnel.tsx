"use client";

import clsx from "clsx";
import type { AgWidgetParams } from "ag-studio";
import type { MouseEvent } from "react";
import { funnel } from "../funnel";
import type { CheckFunnelDef } from "./defs";
import { num, useRows } from "./useRows";

// Custom widget 2: how far claims got, stage by stage, with each drop labelled by its commonest reason. Clicking a
// drop cross-filters the page to the claims that stopped there.

export function CheckFunnel(params: AgWidgetParams<CheckFunnelDef>) {
  const { dataMapping, widgetApi } = params;
  const stage = dataMapping.stage?.[0];
  const reason = dataMapping.reason?.[0];
  const count = dataMapping.count?.[0];
  const rows = useRows(widgetApi, () => (stage && reason && count ? [{ fields: [stage, reason, count] }] : null), [params]);
  if (!rows || !stage || !reason || !count) return null;

  const steps = funnel(rows[0].map((r) => ({ stage: String(r[stage.key]), stopReason: (r[reason.key] as string | null) ?? null, count: num(r[count.key]) })));
  const filed = steps[0].reached || 1;
  const selected = new Set(widgetApi.getCrossFilterSelections()?.flatMap((s) => (s.type === "value" ? s.values.map(String) : [])) ?? []);

  const toggle = (value: string) => (e: MouseEvent) => {
    e.stopPropagation();
    widgetApi.toggleCrossFilter({ type: "value", field: stage, value, group: 0, reset: !(e.metaKey || e.ctrlKey) });
  };

  return (
    <ol className="flex h-full min-h-0 flex-col justify-between gap-0.5 px-1.5 pb-1" onClick={() => widgetApi.resetCrossFilter()}>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.stage} className="flex flex-col gap-1">
            <div className="grid grid-cols-[9.5rem_2.5rem_1fr] items-center gap-3">
              <span className="truncate text-ui text-text">{s.stage}</span>
              <span className="text-right font-mono text-ui text-text tabular-nums">{s.reached}</span>
              <span className="relative h-3 rounded-[3px] bg-surface-2" aria-hidden="true">
                <span
                  className={clsx("absolute inset-y-0 left-0 rounded-[3px]", last ? "bg-pay" : "bg-[color-mix(in_oklch,var(--text)_26%,var(--surface))]")}
                  style={{ width: `max(2px, ${(s.reached / filed) * 100}%)` }}
                />
              </span>
            </div>
            {!last && (
              <button
                type="button"
                disabled={!s.stopped}
                aria-pressed={selected.has(s.stage)}
                onClick={toggle(s.stage)}
                className={clsx(
                  "group ml-[9.5rem] flex min-h-6 items-center gap-2 rounded-control px-2 text-left text-micro transition-colors",
                  "disabled:cursor-default enabled:hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-0",
                  selected.has(s.stage) ? "bg-accent-soft ring-1 ring-accent" : "",
                )}
                title={s.stopped ? `Filter the page to the ${s.stopped} that stopped here` : undefined}
              >
                <span aria-hidden="true" className="font-mono text-faint">↳</span>
                <span className={clsx("font-mono tabular-nums", s.stopped ? "text-stop" : "text-faint")}>{s.stopped ? `−${s.stopped}` : "0"}</span>
                <span className="truncate text-muted group-enabled:group-hover:text-text">{s.topReason ?? "none stopped here"}</span>
                {s.reasons > 1 && (
                  <span className="shrink-0 font-mono text-faint">
                    +{s.reasons - 1} more {s.reasons === 2 ? "reason" : "reasons"}
                  </span>
                )}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
