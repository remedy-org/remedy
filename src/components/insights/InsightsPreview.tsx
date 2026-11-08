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
// editing, no analyst (no AI module, no OpenAI call). Loaded only on intent, at 1280px and up (InsightsPreviewLazy). It sits inside the tour's inert frame: a picture, read through
// the panel's description.

const LICENSE = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE;
if (LICENSE) lib.AgStudioLicenseManager.setLicenseKey(LICENSE);

const PANELS = { view: { left: [], right: [] } };
const WIDGETS = 6;

/** Every widget on the page has drawn its body (not a loading or empty overlay). */
function displayed(root: HTMLElement) {
  const panels = root.querySelectorAll(".ag-studio-layout-widget");
  if (panels.length < WIDGETS) return false;
  return [...panels].every((p) => (p.querySelector(".ag-studio-layout-widget-content")?.textContent ?? "").trim().length > 0);
}

export default function InsightsPreview({ data, rows, onDisplayed }: { data: InsightsData; rows: number; onDisplayed?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<AgStudioApi<InsightsRegistry> | null>(null);
  const mode = useSyncExternalStore(onThemeChange, readTheme, () => "dark");
  const theme = useMemo(() => {
    void mode; // Rebuilt from the live tokens whenever the theme toggles.
    const { resolve, done } = colorResolver();
    try {
      return buildTheme(lib, resolve, fonts());
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
      initialState: homeInsightsReport(data, rows),
      widgets: insightsWidgets(lib, { home: true }),
      panels: PANELS,
      mode: "view",
    });
    api.current = studio;
    let told = false;
    const watch = new MutationObserver(() => {
      if (told || !displayed(root)) return;
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
  }, [data, rows]);

  useEffect(() => {
    if (api.current && theme !== initialTheme.current) api.current.setProperty("theme", theme);
  }, [theme]);

  return <div ref={host} className="insights-report h-full w-full [&_.ag-cell]:[font-variant-numeric:normal] [&_.ag-studio-layout-widget-title]:font-medium!" />;
}
