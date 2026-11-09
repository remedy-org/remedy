"use client";

import type { AgWidgetParams } from "ag-studio";
import type { MouseEvent } from "react";
import { funnel } from "../funnel";
import { CheckFunnelView } from "./CheckFunnelView";
import type { CheckFunnelDef } from "./defs";
import { moveBetweenItems } from "./listKeys";
import { num, useRows } from "./useRows";

// Custom widget 2: how far claims got, stage by stage (CheckFunnelView draws it). Clicking a drop cross-filters the page
// to the claims that stopped there.

// `params` is kept whole (not destructured with a rest), so its identity, which useRows re-runs on, is Studio's own.
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
  const selected = new Set(widgetApi.getCrossFilterSelections()?.flatMap((s) => (s.type === "value" ? s.values.map(String) : [])) ?? []);

  const toggle = (value: string) => (e: MouseEvent) => {
    e.stopPropagation();
    widgetApi.toggleCrossFilter({ type: "value", field: stage, value, group: 0, reset: !(e.metaKey || e.ctrlKey) });
  };

  return <CheckFunnelView steps={steps} selected={selected} onToggle={toggle} onReset={() => widgetApi.resetCrossFilter()} onKeyDown={moveBetweenItems} />;
}

