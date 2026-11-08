"use client";

import clsx from "clsx";
import type { AgReportState, AgStudioApi } from "ag-studio";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { InsightsData } from "@/app/console/insights/facts";
import { buildAnalyst } from "./analyst";
import { captions, filterClaims, filterLabel, filterPicks, insightsReport, kpiCaptions, panelName, provenance, type FilterPick } from "./report";
import { buildSources } from "./sources";
import lib from "./studio-lib";
import { buildTheme } from "./theme";
import { toolDisplay } from "./ToolCards";
import { insightsWidgets, type InsightsRegistry } from "./widgets";

// AG Studio, loaded on this route only (InsightsLoader imports it with ssr: false), from its self-contained UMD build
// (see studio-lib.js) and driven through its vanilla API. The licence key is public by design (AG keys sit in the
// client bundle); without one, Studio runs with its trial watermark.

if (process.env.NODE_ENV !== "production") lib.enableStudioDevValidations();

const LICENSE = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE;
if (LICENSE) lib.AgStudioLicenseManager.setLicenseKey(LICENSE);

// Studio's own words for the rail, in the console's voice.
const LOCALE = { panelTitleAi: "Recall analyst", aiMessageInputPlaceholder: "Ask about this recall's claims…" };

// The analyst's rail lives in Studio's edit-mode panels; the report opens there with only that panel shown.
const PANELS = { edit: { right: ["ai" as const] }, view: { right: ["filters" as const] } };

const readTheme = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
function onThemeChange(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** Any CSS colour, tokens and color-mix() included, as the sRGB the browser paints: what Studio and its charts need. */
function colorResolver() {
  const probe = document.createElement("span");
  probe.style.display = "none";
  document.body.appendChild(probe);
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const resolve = (css: string) => {
    probe.style.color = css;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = getComputedStyle(probe).color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
  };
  return { resolve, done: () => probe.remove() };
}

function fonts() {
  const root = getComputedStyle(document.documentElement);
  const stack = (name: string, fallback: string) => {
    const family = root.getPropertyValue(name).trim();
    return family ? `${family}, ${fallback}` : fallback;
  };
  return { sans: stack("--font-schibsted", "ui-sans-serif, system-ui, sans-serif"), mono: stack("--font-jetbrains", "ui-monospace, Menlo, monospace") };
}

// Studio's keyboard model for the canvas: Tab goes from panel to panel, Enter goes into a panel's controls and Esc comes
// back out. Studio leaves those stops unnamed, so each is named for its panel ("Decisions, Exhibit B") and says the
// keys (globals.css draws the amber ring and shows them); a panel with nothing to operate, a KPI tile, leaves the Tab
// order. Studio's editor overlays (the field-mapping skeleton behind every panel, "Value KPI") stay in the DOM on a
// report nobody edits, so they leave the accessibility tree and the Tab order. Re-run whenever Studio redraws a panel.
const PANEL_KEYS = "insights-panel-keys";
const CONTROLS = "a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])";

function namePanels(root: HTMLElement) {
  const set = (el: HTMLElement, name: string, value: string) => el.getAttribute(name) !== value && el.setAttribute(name, value);
  for (const panel of root.querySelectorAll<HTMLElement>(".ag-studio-layout-widget")) {
    const stop = panel.querySelector<HTMLElement>(":scope > .ag-studio-layout-widget-focus-container");
    const content = panel.querySelector(".ag-studio-layout-widget-content");
    if (!stop || !content) continue;
    const text = (cls: string) => panel.querySelector(`.ag-studio-layout-widget-${cls}`)?.textContent?.trim() ?? "";
    set(stop, "role", "group");
    set(stop, "aria-label", panelName(text("title"), text("subtitle")) || "Panel");
    set(stop, "aria-describedby", PANEL_KEYS);
    // Studio's tab guards hand focus to the stop, so globals.css takes both out of the Tab order.
    const inert = !content.querySelector(CONTROLS);
    if (panel.hasAttribute("data-no-controls") !== inert) panel.toggleAttribute("data-no-controls", inert);
    for (const overlay of panel.querySelectorAll<HTMLElement>(".ag-studio-layout-widget-skeleton-overlay-container:not([inert])")) {
      overlay.setAttribute("aria-hidden", "true");
      overlay.inert = true;
    }
  }
}

const samePicks = (a: FilterPick[], b: FilterPick[]) => JSON.stringify(a) === JSON.stringify(b);
const pageOf = (state: AgReportState<InsightsRegistry>) => state.pages.find((p) => p.id === state.selectedPageId);

/**
 * The money and timing tiles' captions say where their numbers come from (report.ts captions()), so under a filter they
 * follow it. They are written into the tiles here, keyed by tile title, not through Studio's state: a state change
 * redraws every panel and drops the keyboard's place in the exhibit that set the filter.
 */
function followCaptions(root: HTMLElement, byTitle: Record<string, string>) {
  for (const panel of root.querySelectorAll<HTMLElement>(".ag-studio-layout-widget")) {
    const text = byTitle[panel.querySelector(".ag-studio-layout-widget-title")?.textContent?.trim() ?? ""];
    const caption = panel.querySelector(".ag-studio-layout-widget-caption");
    if (text !== undefined && caption && caption.textContent !== text) caption.textContent = text;
  }
}

const plural = (n: number, one: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : `${one}s`}`;

// Below 1024px Studio's canvas doesn't reflow, so the page shows a summary instead and the rail takes the full width.
const wide = {
  subscribe(onChange: () => void) {
    const q = window.matchMedia("(min-width: 1024px)");
    q.addEventListener("change", onChange);
    window.addEventListener("resize", onChange);
    return () => {
      q.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
    };
  },
  width: () => (window.matchMedia("(min-width: 1024px)").matches ? 400 : document.documentElement.clientWidth),
};

export default function InsightsStudio({ data }: { data: InsightsData }) {
  const host = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const api = useRef<AgStudioApi<InsightsRegistry> | null>(null);
  // What a click on a funnel drop, a decision or a refusal reason filters the whole page to (Studio's cross-filter).
  const [picks, setPicks] = useState<FilterPick[]>([]);
  const shown = useMemo(() => filterClaims(data.claims, picks), [data, picks]);
  const tileCaptions = useRef<Record<string, string>>({});
  const mode = useSyncExternalStore(onThemeChange, readTheme, () => "dark");
  const railWidth = useSyncExternalStore(wide.subscribe, wide.width, () => 400);
  const theme = useMemo(() => {
    void mode; // Rebuilt from the live tokens whenever the theme toggles.
    const { resolve, done } = colorResolver();
    try {
      return buildTheme(lib, resolve, fonts(), railWidth);
    } finally {
      done();
    }
  }, [mode, railWidth]);
  // The theme Studio starts with; later changes go through setProperty below.
  const initialTheme = useRef(theme);

  useEffect(() => {
    if (!host.current) return;
    const studio = lib.createStudio<InsightsRegistry>(
      host.current,
      {
        theme: initialTheme.current,
        loadThemeGoogleFonts: false,
        // A day reads as the rest of the app writes it ("4 Nov"), not in the browser's locale (11/04/2026).
        data: { ...buildSources(data), buckets: lib.createBuckets<InsightsRegistry>({ overrides: [{ id: "day", format: "d mmm" }] }) },
        initialState: insightsReport(data),
        widgets: insightsWidgets(lib),
        panels: PANELS,
        localeText: LOCALE,
        ai: buildAnalyst(lib, data),
        aiToolDisplay: toolDisplay,
        mode: "edit",
        onStateUpdated: ({ state }) => {
          const next = filterPicks(pageOf(state));
          setPicks((prev) => (samePicks(prev, next) ? prev : next));
        },
      },
      { modules: [lib.AgStudioAiModule] },
    );
    api.current = studio;
    const root = host.current;
    namePanels(root);
    const panels = new MutationObserver(() => {
      namePanels(root);
      followCaptions(root, tileCaptions.current);
    });
    panels.observe(root, { childList: true, subtree: true });
    return () => {
      panels.disconnect();
      api.current = null;
      studio.destroy();
    };
  }, [data]);

  useEffect(() => {
    if (api.current && theme !== initialTheme.current) api.current.setProperty("theme", theme);
  }, [theme]);

  // The money and timing tiles' captions describe the claims on the page, so under a filter they follow it.
  useEffect(() => {
    const base = captions(provenance(data.claims));
    const say = kpiCaptions(data.claims, picks.length ? shown : data.claims);
    tileCaptions.current = { "Units remedied": say.remedied, "Paid through PayPal": say.paid, [base.timeTitle]: say.time };
    if (host.current) followCaptions(host.current, tileCaptions.current);
  }, [data, picks, shown]);

  const clearFilter = () => {
    const studio = api.current;
    if (!studio) return;
    const state = studio.getState();
    studio.setState({ ...state, pages: state.pages.map((page) => ({ ...page, crossFilter: undefined })) });
    // The Clear button goes with the filter; the bar keeps the focus and says what the page shows now.
    bar.current?.focus();
  };

  // Studio sets its widget titles in 700, outside DESIGN.md's 400/500/600; the theme's title weight doesn't reach them.
  // insights-report (globals.css) takes Studio's editor chrome off the read-only exhibits.
  return (
    <div className="flex h-full w-full flex-col">
      {/* The page's filter, said in words with a way out: a pick in one exhibit changes every number on the page. */}
      <div
        ref={bar}
        tabIndex={-1}
        role="status"
        className={clsx(
          "hidden min-h-10 items-center gap-x-3 border-b border-line px-4 text-micro outline-none sm:px-6 lg:flex lg:px-8",
          picks.length > 0 && "bg-surface-2",
        )}
      >
        {picks.length > 0 ? (
          <>
            <p className="min-w-0 truncate text-muted">
              Showing <span className="font-medium text-text">{filterLabel(picks)}</span>
              {shown && (
                <>
                  {" "}
                  · <span className="font-mono text-text tabular-nums">{shown.length}</span> of {plural(data.claims.length, "claim")}
                </>
              )}
            </p>
            <button
              type="button"
              onClick={clearFilter}
              className="shrink-0 rounded-control px-2 py-1 font-medium text-text underline decoration-line-2 underline-offset-4 hover:decoration-text focus-visible:outline-2 focus-visible:outline-offset-0"
            >
              Clear filter
            </button>
          </>
        ) : (
          <p className="text-muted">
            All {plural(data.claims.length, "claim")}. Pick a stage in the funnel, a decision or a refusal reason to filter the page to those claims.
          </p>
        )}
      </div>
      <div ref={host} className="insights-report min-h-0 w-full flex-1 [&_.ag-cell]:[font-variant-numeric:normal] [&_.ag-studio-layout-widget-title]:font-medium!" />
      <p id={PANEL_KEYS} hidden>
        Press Enter to use this panel&apos;s controls, the arrow keys or Tab to move between them, and Escape to come back out. A pick filters the whole page until you
        pick it again or press Clear filter above the report.
      </p>
    </div>
  );
}
