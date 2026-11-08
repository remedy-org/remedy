"use client";

import type { AgReportState, AgStudioApi } from "ag-studio";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { InsightsData } from "@/app/console/insights/facts";
import type { StudioFilter } from "./InsightsPreviewLazy";
import { captions, filterClaims, filterLabel, filterPicks, homeInsightsReport, homeKpiCaptions, provenance } from "./report";
import { buildSources } from "./sources";
import { colorResolver, fonts, onThemeChange, readTheme } from "./studio-setup";
import lib from "./studio-lib";
import { buildTheme } from "./theme";
import { insightsWidgets, type InsightsRegistry } from "./widgets";

// The homepage's Insights step, in real AG Studio: view mode, six widgets over the recall's 40 claims, no panels, no
// editing, no analyst (no AI module, no OpenAI call). Loaded at 1024px and up once the tour's frame is near
// (InsightsPreviewLazy), and live once shown: its charts' tooltips and its cross-filters work as in the console.
// Laid out on the still's geometry (InsightsStill.tsx): 14px of canvas padding and 6px around each panel put its cards
// on the frame's 20px inset, 12px apart, with the still's hairline.

const LICENSE = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE;
if (LICENSE) lib.AgStudioLicenseManager.setLicenseKey(LICENSE);

const PANELS = { view: { left: [], right: [] } };
// A chart's tooltip names its series as the page does: "Paid through PayPal", not "(sum)", and the cross-filter's part
// of it in words.
const LOCALE = {
  aggregationSumFieldName: "${name}",
  aggregationMaxFieldName: "${name}",
  crossFilterSumFieldName: "${name}, in this filter",
  crossFilterMaxFieldName: "${name}, in this filter",
};

/** The tiles' captions, by title, for the claims on the page; a caption already right is left alone. */
function setCaptions(root: HTMLElement, byTitle: Record<string, string>) {
  for (const panel of root.querySelectorAll<HTMLElement>(".ag-studio-layout-widget")) {
    const text = byTitle[panel.querySelector(".ag-studio-layout-widget-title")?.textContent?.trim() ?? ""];
    const caption = panel.querySelector(".ag-studio-layout-widget-caption");
    if (text !== undefined && caption && caption.textContent !== text) caption.textContent = text;
  }
}

const pageOf = (state: AgReportState<InsightsRegistry>) => state.pages.find((p) => p.id === state.selectedPageId);
// Every widget on the page, read from the state it starts with (a short frame leaves out the refusal reasons).
const widgetCount = (rows: number, data: InsightsData) => Object.keys(homeInsightsReport(data, rows).pages[0].widgets ?? {}).length;

/** Every widget on the page has drawn its body (not a loading or empty overlay). */
function displayed(root: HTMLElement, widgets: number) {
  const panels = root.querySelectorAll(".ag-studio-layout-widget");
  if (panels.length < widgets) return false;
  return [...panels].every((p) => (p.querySelector(".ag-studio-layout-widget-content")?.textContent ?? "").trim().length > 0);
}

export default function InsightsPreview({
  data,
  rows,
  active = true,
  onDisplayed,
  onFilter,
}: {
  data: InsightsData;
  rows: number;
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
        theme: buildTheme(lib, resolve, fonts()).withParams({ studioCanvasPadding: 14, studioValueWidgetFontSize: 28 }),
        labelColor: resolve("var(--bg)"),
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

  useEffect(() => {
    const root = host.current;
    if (!root) return;
    const say = captions(provenance(data.claims));
    // The median and Refused tiles' captions count the claims the page shows: under a cross-filter, the picked ones (or
    // nothing, when a pick can't be read here); Studio redraws a tile from its state, so they are set again after it.
    let byTitle: Record<string, string> = {};
    let label = "";
    const clear = () => {
      const studio = api.current;
      if (!studio) return;
      const state = studio.getState();
      studio.setState({ ...state, pages: state.pages.map((p) => ({ ...p, crossFilter: undefined })) });
    };
    const follow = (state: AgReportState<InsightsRegistry>) => {
      const picks = filterPicks(pageOf(state));
      const shown = picks.length ? filterClaims(data.claims, picks) : data.claims;
      const home = shown ? homeKpiCaptions(data.claims, shown) : { median: "", refused: "" };
      byTitle = { [say.timeTitle]: home.median, Refused: home.refused };
      setCaptions(root, byTitle);
      const next = picks.length ? filterLabel(picks) : "";
      if (next === label) return;
      label = next;
      filterNotice.current?.(next ? { label: next, clear } : null);
    };
    const studio = lib.createStudio<InsightsRegistry>(root, {
      theme: initialTheme.current,
      loadThemeGoogleFonts: false,
      data: { ...buildSources(data), buckets: lib.createBuckets<InsightsRegistry>({ overrides: [{ id: "day", format: "d mmm" }] }) },
      initialState: homeInsightsReport(data, rows, labelColor),
      widgets: insightsWidgets(lib, { home: true }),
      panels: PANELS,
      localeText: LOCALE,
      mode: "view",
      onStateUpdated: ({ state }) => follow(state),
    });
    api.current = studio;
    let told = false;
    const widgets = widgetCount(rows, data);
    const watch = new MutationObserver(() => {
      if (told || !displayed(root, widgets)) return;
      told = true;
      watch.disconnect();
      notify.current?.();
    });
    watch.observe(root, { childList: true, subtree: true, characterData: true });
    const tiles = new MutationObserver(() => setCaptions(root, byTitle));
    tiles.observe(root, { childList: true, subtree: true });
    return () => {
      watch.disconnect();
      tiles.disconnect();
      filterNotice.current?.(null);
      api.current = null;
      studio.destroy();
    };
    // A theme toggle redraws the page whole: the chart's labels take their colour from the state.
  }, [data, rows, labelColor]);

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

  return (
    <div
      ref={host}
      className="insights-report h-full w-full [&_.ag-cell]:[font-variant-numeric:normal] [&_.ag-studio-layout-widget]:p-1.5! [&_.ag-studio-layout-widget-container]:shadow-card [&_.ag-studio-layout-widget-title]:font-medium!"
    />
  );
}
