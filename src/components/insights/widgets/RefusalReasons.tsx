"use client";

import type { AgWidgetParams } from "ag-studio";
import type { MouseEvent } from "react";
import type { RefusalReasonsDef } from "./defs";
import { moveBetweenItems } from "./listKeys";
import { RefusalReasonsView, type RefusalItem } from "./RefusalReasonsView";
import { num, useRows } from "./useRows";

// Custom widget 3: why claims were refused (RefusalReasonsView draws it). Clicking a reason cross-filters the page.

// `params` is kept whole (not destructured with a rest), so its identity, which useRows re-runs on, is Studio's own.
export function RefusalReasons(params: AgWidgetParams<RefusalReasonsDef> & { flush?: boolean }) {
  const { dataMapping, widgetApi } = params;
  const reason = dataMapping.reason?.[0];
  const gate = dataMapping.gate?.[0];
  const count = dataMapping.count?.[0];
  const rows = useRows(widgetApi, () => (reason && gate && count ? [{ fields: [reason, gate, count] }] : null), [params]);
  if (!rows || !reason || !gate || !count) return null;

  const items = rows[0]
    .map((r) => ({ reason: r[reason.key] as string | null, gate: String(r[gate.key] ?? ""), count: num(r[count.key]) }))
    .filter((r): r is RefusalItem => Boolean(r.reason) && r.count > 0)
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
  const selected = new Set(widgetApi.getCrossFilterSelections()?.flatMap((s) => (s.type === "value" ? s.values.map(String) : [])) ?? []);

  const toggle = (value: string) => (e: MouseEvent) => {
    e.stopPropagation();
    widgetApi.toggleCrossFilter({ type: "value", field: reason, value, group: 0, reset: !(e.metaKey || e.ctrlKey) });
  };

  return <RefusalReasonsView items={items} selected={selected} onToggle={toggle} onReset={() => widgetApi.resetCrossFilter()} onKeyDown={moveBetweenItems} flush={params.flush} />;
}

/** The homepage's refusal reasons, on the panel title's edge. */
export const HomeRefusalReasons = (params: AgWidgetParams<RefusalReasonsDef>) => (
  <div className="h-full px-2 pb-2">
    <RefusalReasons {...params} flush />
  </div>
);
