"use client";

import clsx from "clsx";
import type { AgWidgetParams } from "ag-studio";
import type { MouseEvent } from "react";
import type { RefusalReasonsDef } from "./defs";
import { moveBetweenItems } from "./listKeys";
import { num, useRows } from "./useRows";

// Custom widget 3: why claims were refused, each reason followed by where it was caught: before the model read the
// photo (a pre-check), by the model, or by a person. The bars are the funnel's muted ink: the title already says
// these were refused.

const GATE_LABEL: Record<string, string> = { "No AI": "before the model", "Model reads": "by the model", Person: "by a person" };

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
  const selected = new Set(widgetApi.getCrossFilterSelections()?.flatMap((s) => (s.type === "value" ? s.values.map(String) : [])) ?? []);

  const toggle = (value: string) => (e: MouseEvent) => {
    e.stopPropagation();
    widgetApi.toggleCrossFilter({ type: "value", field: reason, value, group: 0, reset: !(e.metaKey || e.ctrlKey) });
  };

  if (!items.length) {
    return <p className="flex h-full items-center justify-center text-ui text-muted">No claim was refused.</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col px-1.5 pb-1" onClick={() => widgetApi.resetCrossFilter()}>
      <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto" onKeyDown={moveBetweenItems}>
        {items.map((i) => (
          <li key={i.reason}>
            <button
              type="button"
              aria-pressed={selected.has(i.reason)}
              onClick={toggle(i.reason)}
              className={clsx(
                "grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-control px-2 py-1 text-left transition-colors hover:bg-surface-2",
                "focus-visible:outline-2 focus-visible:outline-offset-0",
                selected.has(i.reason) && "bg-surface-2 ring-1 ring-text-2",
                selected.size > 0 && !selected.has(i.reason) && "opacity-45",
              )}
            >
              {/* The reason whole, its count beside it, and where it was caught on the line under it: never cut off. */}
              <span className="min-w-0 text-ui text-text">{i.reason}</span>
              <span className="self-start text-right font-mono text-ui text-text tabular-nums">{i.count}</span>
              {GATE_LABEL[i.gate] && <span className="col-span-2 -mt-1 text-micro text-muted">Caught {GATE_LABEL[i.gate]}</span>}
              <span aria-hidden="true" className="col-span-2 h-1.5 rounded-full bg-surface-2">
                <span className="block h-full rounded-full bg-[color-mix(in_oklch,var(--text)_26%,var(--surface))]" style={{ width: `${(i.count / max) * 100}%` }} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
