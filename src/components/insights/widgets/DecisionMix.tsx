"use client";

import type { AgWidgetParams } from "ag-studio";
import type { MouseEvent } from "react";
import { decisionItems, DecisionMixView } from "./DecisionMixView";
import type { DecisionMixDef } from "./defs";
import { moveBetweenItems } from "./listKeys";
import { num, useRows } from "./useRows";

// Custom widget 4: what the rule decided (DecisionMixView draws it). Clicking a decision cross-filters the page.

export function DecisionMix(params: AgWidgetParams<DecisionMixDef>) {
  const { dataMapping, widgetApi } = params;
  const decision = dataMapping.decision?.[0];
  const count = dataMapping.count?.[0];
  const rows = useRows(widgetApi, () => (decision && count ? [{ fields: [decision, count] }] : null), [params]);
  if (!rows || !decision || !count) return null;

  const items = decisionItems(new Map(rows[0].map((r) => [String(r[decision.key]), num(r[count.key])])));
  const selected = new Set(widgetApi.getCrossFilterSelections()?.flatMap((s) => (s.type === "value" ? s.values.map(String) : [])) ?? []);

  const toggle = (value: string) => (e: MouseEvent) => {
    e.stopPropagation();
    widgetApi.toggleCrossFilter({ type: "value", field: decision, value, group: 0, reset: !(e.metaKey || e.ctrlKey) });
  };

  return <DecisionMixView items={items} selected={selected} onToggle={toggle} onReset={() => widgetApi.resetCrossFilter()} onKeyDown={moveBetweenItems} />;
}
