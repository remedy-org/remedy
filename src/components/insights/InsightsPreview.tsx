"use client";

import type { AgReportState, AgStudioApi } from "ag-studio";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { InsightsData } from "@/app/console/insights/facts";
import { studioLicence } from "@/lib/agStudioLicence";
import { InsightsLedger } from "./InsightsLedger";
import "./insights.css";
import type { StudioFilter } from "./InsightsPreviewLazy";
import { PaidLines } from "./PaidLines";
import { chartsPaidByDay, filterClaims, filterLabel, filterPicks, insightsReport, paidDays, reportRows } from "./report";
import { buildSources } from "./sources";
import { colorResolver, fonts, onThemeChange, readTheme } from "./studio-setup";
import lib from "./studio-lib";
import { buildTheme } from "./theme";
import { insightsWidgets, type InsightsRegistry } from "./widgets";

// The homepage's Insights step, in real AG Studio: the console's own Insights page (its report state, its widgets, its
// ledger over the canvas and its day lines under it) over the recall's seven claims, in view mode, no panels, no
// editing, no analyst (no AI module, no OpenAI call). Loaded at 1024px and up once the tour's frame is near
// (InsightsPreviewLazy), and live once shown: its cross-filters work as in the console, and the ledger follows them.
// Drawn as the console draws it (insights.css), its canvas padding the frame's 20px inset, as the still is.

// Loaded only under a valid, unexpired key (STUDIO_ON_HOME); without one the tour keeps the still.
const LICENSE = studioLicence();
if (LICENSE) lib.AgStudioLicenseManager.setLicenseKey(LICENSE);

const PANELS = { view: { left: [], right: [] } };
// The console's words for a series, never Studio's "(sum)".
const LOCALE = {
  aggregationSumFieldName: "${name}",
  aggregationMaxFieldName: "${name}",
  crossFilterSumFieldName: "${name}, in this filter",
  crossFilterMaxFieldName: "${name}, in this filter",
  aggregationCountdFieldName: "${name} count",
  aggregationCountdBucketName: "${name} count",
  crossFilterCountdFieldName: "${name} count, in this filter",
};

// Studio's canvas rows are 16px, inside its 20px of padding top and bottom and a pixel of edge each side (measured: a
// host any shorter leaves Studio's own layout a scroller, which would take the wheel): the host is sized to the report,
// so the frame scrolls as one and no panel scrolls inside another.
const ROW = 16;
const CANVAS_PAD = 42;

const pageOf = (state: AgReportState<InsightsRegistry>) => state.pages.find((p) => p.id === state.selectedPageId);

/** Every widget on the page has drawn its body (not a loading or empty overlay). */
function displayed(root: HTMLElement, widgets: number) {
  const panels = root.querySelectorAll(".ag-studio-layout-widget");
  if (panels.length < widgets) return false;
  return [...panels].every((p) => (p.querySelector(".ag-studio-layout-widget-content")?.textContent ?? "").trim().length > 0);
}

export default function InsightsPreview({
  data,
  active = true,
  onDisplayed,
  onFilter,
}: {
  data: InsightsData;
  active?: boolean;
  onDisplayed?: () => void;
  /** The page's cross-filter changed: what it shows now, or null for every claim. */
  onFilter?: (filter: StudioFilter | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<AgStudioApi<InsightsRegistry> | null>(null);
  const mode = useSyncExternalStore(onThemeChange, readTheme, () => "dark");
  const { theme, labelColor } = useMemo(() => {
    void mode; // Rebuilt from the live tokens whenever the theme toggles.
    const { resolve, done } = colorResolver();
    try {
      return {
        theme: buildTheme(lib, resolve, fonts()).withParams({ studioCanvasPadding: 20 }),
        labelColor: resolve("var(--pay-fill-text)"),
      };
    } finally {
      done();
    }
  }, [mode]);
  const initialTheme = useRef(theme);
  const notify = useRef(onDisplayed);
  const filterNotice = useRef(onFilter);
  useEffect(() => {
    notify.current = onDisplayed;
    filterNotice.current = onFilter;
  }, [onDisplayed, onFilter]);
  // The claims the page's cross-filter leaves: the ledger and the day lines follow them, as the console's do.
  const [shown, setShown] = useState<InsightsData["claims"] | null>(null);
  const height = reportRows(data) * ROW + CANVAS_PAD;

  useEffect(() => {
    const root = host.current;
    if (!root) return;
    let label = "";
    const clear = () => {
      const studio = api.current;
      if (!studio) return;
      const state = studio.getState();
      studio.setState({ ...state, pages: state.pages.map((p) => ({ ...p, crossFilter: undefined })) });
    };
    const follow = (state: AgReportState<InsightsRegistry>) => {
      const picks = filterPicks(pageOf(state));
      setShown(picks.length ? filterClaims(data.claims, picks) : null);
      const next = picks.length ? filterLabel(picks) : "";
      if (next === label) return;
      label = next;
      filterNotice.current?.(next ? { label: next, clear } : null);
    };
    const report = insightsReport(data, false, labelColor);
    const studio = lib.createStudio<InsightsRegistry>(root, {
      theme: initialTheme.current,
      loadThemeGoogleFonts: false,
      data: { ...buildSources(data), buckets: lib.createBuckets<InsightsRegistry>({ overrides: [{ id: "day", format: "d mmm" }] }) },
      initialState: report,
      widgets: insightsWidgets(lib),
      panels: PANELS,
      localeText: LOCALE,
      mode: "view",
      onStateUpdated: ({ state }) => follow(state),
    });
    api.current = studio;
    let told = false;
    const widgets = Object.keys(report.pages[0].widgets ?? {}).length;
    const watch = new MutationObserver(() => {
      if (told || !displayed(root, widgets)) return;
      told = true;
      watch.disconnect();
      notify.current?.();
    });
    watch.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      watch.disconnect();
      filterNotice.current?.(null);
      api.current = null;
      studio.destroy();
    };
    // A theme toggle redraws the page whole: the chart's labels take their colour from the state.
  }, [data, labelColor]);

  useEffect(() => {
    if (api.current && theme !== initialTheme.current) api.current.setProperty("theme", theme);
  }, [theme]);

  // A visitor who filtered the page and moved on finds it whole when they come back.
  useEffect(() => {
    const studio = api.current;
    if (active || !studio) return;
    const state = studio.getState();
    if (state.pages.some((p) => p.crossFilter)) studio.setState({ ...state, pages: state.pages.map((p) => ({ ...p, crossFilter: undefined })) });
  }, [active]);

  const claims = shown ?? data.claims;
  return (
    // The tour hands this the wheel once a visitor rests on it, clicks or focuses it (tour.module.css data-insights-scroll).
    <div data-insights-scroll className="flex h-full w-full flex-col overflow-y-auto pt-5 pb-5">
      <InsightsLedger claims={claims} unitsSold={data.recall.unitsSold} className="mx-5" />
      <div
        ref={host}
        // The day lines are drawn up over the canvas's empty foot (its padding, all under the last row), as on the console.
        style={{ height, marginBottom: chartsPaidByDay(data) ? undefined : -CANVAS_PAD }}
        className="insights-report w-full shrink-0 [&_.ag-cell]:[font-variant-numeric:normal] [&_.ag-studio-layout-widget-title]:font-medium!"
      />
      {!chartsPaidByDay(data) && <PaidLines days={paidDays(claims)} className="mx-5" id="studio-paid-lines" />}
    </div>
  );
}
