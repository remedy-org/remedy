"use client";

import type { AgWidgetApi, AgWidgetDataQuery } from "ag-studio";
import { useEffect, useRef, useState } from "react";

export type Row = Record<string, unknown>;

/**
 * Runs a widget's queries through Studio's data engine, so page filters and cross-filters apply, and keeps Studio's
 * overlay in step: loading on the first load only, "no data" when nothing matches, "incomplete" when a field is unmapped.
 * `queries` returns null while the widget's data mapping is incomplete. `deps` re-run it (the params object Studio
 * passes changes on every filter change). While the widget holds a cross-filter selection of its own, it asks for the
 * unfiltered rows, so it keeps showing what there is to pick from (the picked rows stand out, the rest dim).
 */
export function useRows(widgetApi: AgWidgetApi, queries: () => AgWidgetDataQuery[] | null, deps: unknown[]): Row[][] | null {
  const [rows, setRows] = useState<Row[][] | null>(null);
  const loaded = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    const list = queries();
    if (!list) {
      widgetApi.setDisplayState("incompleteDataMapping");
      return () => controller.abort();
    }
    widgetApi.setDisplayState("loading", { prominent: !loaded.current });
    const own = (widgetApi.getCrossFilterSelections()?.length ?? 0) > 0;
    Promise.all(list.map((q, i) => widgetApi.getData(q, { queryId: `q${i}`, signal: controller.signal, crossFilter: own ? "highlight" : "filter" })))
      .then((responses) => {
        const next = responses.map((r) => r.results.rows);
        loaded.current = true;
        setRows(next);
        widgetApi.setDisplayState(next[0].length ? "displayed" : "noData");
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        console.error("[insights] widget query failed", e);
        widgetApi.setDisplayState("noData");
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return rows;
}

export const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
