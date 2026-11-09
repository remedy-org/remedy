"use client";

import type { AgWidgetParams } from "ag-studio";
import type { RecallProgressDef } from "./defs";
import { RecallProgressView } from "./RecallProgressView";
import { num, useRows } from "./useRows";

// Custom widget 1: units remedied against units sold, on a ruler with the share recalls usually reach. Remedy's own
// number is a sliver next to the 6-10% band on purpose: the scale is honest, and the gap is the point.

export function RecallProgress(params: AgWidgetParams<RecallProgressDef>) {
  const { dataMapping, widgetApi } = params;
  const remedied = dataMapping.remedied?.[0];
  const sold = dataMapping.sold?.[0];
  const days = dataMapping.days?.[0];
  const rows = useRows(widgetApi, () => (remedied && sold ? [{ fields: [remedied] }, { fields: [sold] }, ...(days ? [{ fields: [days] }] : [])] : null), [params]);
  if (!rows || !remedied || !sold) return null;

  const done = num(rows[0][0]?.[remedied.key]);
  const total = num(rows[1][0]?.[sold.key]);
  // The pace, so a few days of a recall never read as its whole life against the band (which is years).
  const dayCount = days ? num(rows[2]?.[0]?.[days.key]) : 0;
  return <RecallProgressView done={done} total={total} dayCount={dayCount} dated={Boolean(days)} />;
}
