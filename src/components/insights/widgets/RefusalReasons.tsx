"use client";

import clsx from "clsx";
import type { AgWidgetParams } from "ag-studio";
import type { MouseEvent } from "react";
import type { RefusalReasonsDef } from "./defs";
import { num, useRows } from "./useRows";

// Custom widget 3: why claims were refused, each reason tagged with the kind of check that caught it (a pre-check
// that needs no AI, the model reading the photo, or a person). Refusals are always --stop, never a palette slot.

const GATE_LABEL: Record<string, string> = { "No AI": "NO AI", "Model reads": "MODEL READS", Person: "PERSON" };

export function RefusalReasons(params: AgWidgetParams<RefusalReasonsDef>) {
  const { dataMapping, widgetApi } = params;
  const reason = dataMapping.reason?.[0];
  const gate = dataMapping.gate?.[0];
  const count = dataMapping.count?.[0];
  const rows = useRows(widgetApi, () => (reason && gate && count ? [{ fields: [reason, gate, count] }] : null), [params]);
  if (!rows || !reason || !gate || !count) return null;

  const items = rows[0]
    .map((r) => ({ reason: r[reason.key] as string | null, gate: String(r[gate.key] ?? ""), count: num(r[count.key]) }))
    .filter((r): r is { reason: string; gate: string; count: number } => Boolean(r.reason) && r.count > 0)
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
  const max = Math.max(1, ...items.map((i) => i.count));
  const total = items.reduce((n, i) => n + i.count, 0);
  const selected = new Set(widgetApi.getCrossFilterSelections()?.flatMap((s) => (s.type === "value" ? s.values.map(String) : [])) ?? []);

  const toggle = (value: string) => (e: MouseEvent) => {
    e.stopPropagation();
    widgetApi.toggleCrossFilter({ type: "value", field: reason, value, group: 0, reset: !(e.metaKey || e.ctrlKey) });
  };

  if (!items.length) {
    return <p className="flex h-full items-center justify-center text-ui text-muted">No claim was refused.</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 px-1.5 pb-1" onClick={() => widgetApi.resetCrossFilter()}>
      <p className="text-micro text-muted">
        <span className="font-mono text-text tabular-nums">{total}</span> refused. Each reason names the check that caught it.
      </p>
      <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {items.map((i) => (
          <li key={i.reason}>
            <button
              type="button"
              aria-pressed={selected.has(i.reason)}
              onClick={toggle(i.reason)}
              className={clsx(
                "grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-control px-2 py-1 text-left transition-colors hover:bg-surface-2",
                "focus-visible:outline-2 focus-visible:outline-offset-0",
                selected.has(i.reason) && "bg-accent-soft ring-1 ring-accent",
                selected.size > 0 && !selected.has(i.reason) && "opacity-45",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-ui text-text">{i.reason}</span>
                <span className="shrink-0 rounded-[4px] border border-line px-1.5 font-mono text-[0.6875rem] leading-[1.125rem] tracking-[0.06em] text-muted">{GATE_LABEL[i.gate] ?? i.gate.toUpperCase()}</span>
              </span>
              <span className="text-right font-mono text-ui text-text tabular-nums">{i.count}</span>
              <span aria-hidden="true" className="col-span-2 h-1.5 rounded-full bg-surface-2">
                <span className="block h-full rounded-full bg-stop" style={{ width: `${(i.count / max) * 100}%` }} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
