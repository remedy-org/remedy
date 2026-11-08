"use client";

import type { AgStudioApi } from "ag-studio";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { InsightsData } from "@/app/console/insights/facts";
import { homeInsightsReport } from "./report";
import { buildSources } from "./sources";
import { colorResolver, fonts, onThemeChange, readTheme } from "./studio-setup";
import lib from "./studio-lib";
import { buildTheme } from "./theme";
import { insightsWidgets, type InsightsRegistry } from "./widgets";

// The homepage's Insights step, in real AG Studio: view mode, six widgets over the recall's 40 claims, no panels, no
// editing, no analyst (no AI module, no OpenAI call). Loaded at 1280px and up once the tour's frame is near
// (InsightsPreviewLazy), and live once shown: its charts' tooltips and its cross-filters work as in the console.
// Laid out on the still's geometry (InsightsStill.tsx): 14px of canvas padding and 6px around each panel put its cards
// on the frame's 20px inset, 12px apart, with the still's hairline.

const LICENSE = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE;
if (LICENSE) lib.AgStudioLicenseManager.setLicenseKey(LICENSE);

const PANELS = { view: { left: [], right: [] } };
// Every widget on the page, read from the state it starts with (a short frame leaves out the refusal reasons).
const widgetCount = (rows: number, data: InsightsData) => Object.keys(homeInsightsReport(data, rows).pages[0].widgets ?? {}).length;

/** Every widget on the page has drawn its body (not a loading or empty overlay). */
function displayed(root: HTMLElement, widgets: number) {
  const panels = root.querySelectorAll(".ag-studio-layout-widget");
  if (panels.length < widgets) return false;
  return [...panels].every((p) => (p.querySelector(".ag-studio-layout-widget-content")?.textContent ?? "").trim().length > 0);
}

export default function InsightsPreview({ data, rows, active = true, onDisplayed }: { data: InsightsData; rows: number; active?: boolean; onDisplayed?: () => void }) {
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
  useEffect(() => {
    notify.current = onDisplayed;
  }, [onDisplayed]);

  useEffect(() => {
    const root = host.current;
    if (!root) return;
    const studio = lib.createStudio<InsightsRegistry>(root, {
      theme: initialTheme.current,
      loadThemeGoogleFonts: false,
      data: { ...buildSources(data), buckets: lib.createBuckets<InsightsRegistry>({ overrides: [{ id: "day", format: "d mmm" }] }) },
      initialState: homeInsightsReport(data, rows, labelColor),
      widgets: insightsWidgets(lib, { home: true }),
      panels: PANELS,
      mode: "view",
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
    return () => {
      watch.disconnect();
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
