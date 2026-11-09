"use client";

import clsx from "clsx";
import type { AgWidgetParams } from "ag-studio";
import type { MouseEvent } from "react";
import { VerdictGlyph, type Verdict } from "@/components/console/VerdictMark";
import type { DecisionMixDef } from "./defs";
import { shownAs } from "../funnel";
import { moveBetweenItems } from "./listKeys";
import { num, useRows } from "./useRows";

// Custom widget 4: what the rule decided, as one 100% bar in the state colours every pill and barcode in Remedy uses.
// A built-in donut takes its colours from palette order, so a decision's colour would depend on the data; this can't.

const ORDER = ["Paid", "Held", "Rejected", "Blocked", "In progress"];
const FILL: Record<string, string> = {
  Paid: "bg-pay",
  Held: "bg-hold",
  Rejected: "bg-stop",
  Blocked: "bg-[color-mix(in_oklch,var(--stop)_55%,var(--surface))]",
  "In progress": "bg-faint",
};
// Shape as well as colour: each decision's key is the queue's own verdict glyph.
const GLYPH: Record<string, Verdict> = { Paid: "paid", Held: "held", Rejected: "rejected", Blocked: "blocked", "In progress": "pending" };

export function DecisionMix(params: AgWidgetParams<DecisionMixDef>) {
  const { dataMapping, widgetApi } = params;
  const decision = dataMapping.decision?.[0];
  const count = dataMapping.count?.[0];
  const rows = useRows(widgetApi, () => (decision && count ? [{ fields: [decision, count] }] : null), [params]);
  if (!rows || !decision || !count) return null;

  const tally = new Map(rows[0].map((r) => [String(r[decision.key]), num(r[count.key])]));
  const items = [...tally.keys()]
    .sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99))
    .map((label) => ({ label, n: tally.get(label)! }))
    .filter((i) => i.n > 0);
  const total = items.reduce((s, i) => s + i.n, 0) || 1;
  const selected = new Set(widgetApi.getCrossFilterSelections()?.flatMap((s) => (s.type === "value" ? s.values.map(String) : [])) ?? []);
  const share = (n: number) => `${Math.round((n / total) * 100)}%`;

  const toggle = (value: string) => (e: MouseEvent) => {
    e.stopPropagation();
    widgetApi.toggleCrossFilter({ type: "value", field: decision, value, group: 0, reset: !(e.metaKey || e.ctrlKey) });
  };

  return (
    // An 8px gutter on the right, so a pick ring and the shares inside it never meet the panel's edge.
    <div className="flex h-full min-h-0 flex-col gap-3 pr-2 pb-1" onClick={() => widgetApi.resetCrossFilter()}>
      <div aria-hidden="true" className="flex h-3 gap-0.5 overflow-hidden rounded-[3px]">
        {items.map((i) => (
          <span key={i.label} className={clsx("h-full min-w-[3px]", FILL[i.label] ?? "bg-faint", selected.size > 0 && !selected.has(i.label) && "opacity-30")} style={{ flexGrow: i.n }} />
        ))}
      </div>
      {/* Each row's hover tint reaches 8px past the bar on the left, so the marks and words start on the bar's own edge; on the
          right it ends on the panel's edge, its figures 8px inside the pick ring, never cut by the panel. */}
      <ul className="-ml-2 flex min-h-0 flex-col" onKeyDown={moveBetweenItems}>
        {items.map((i) => (
          <li key={i.label}>
            <button
              type="button"
              aria-pressed={selected.has(i.label)}
              onClick={toggle(i.label)}
              className={clsx(
                "grid w-full grid-cols-[1fr_auto_3rem] items-center gap-3 rounded-control px-2 py-0.5 text-left transition-colors hover:bg-surface-2",
                "focus-visible:outline-2 focus-visible:outline-offset-0",
                selected.has(i.label) && "bg-surface-2 ring-1 ring-text-2 ring-inset",
                selected.size > 0 && !selected.has(i.label) && "opacity-45",
              )}
            >
              <span className="flex items-center gap-2 text-ui text-text">
                <VerdictGlyph verdict={GLYPH[i.label] ?? "pending"} />
                {shownAs(i.label)}
              </span>
              <span className="font-mono text-ui text-text tabular-nums">{i.n}</span>
              <span className="text-right font-mono text-micro text-faint tabular-nums">{share(i.n)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
