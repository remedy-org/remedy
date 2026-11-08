"use client";

import clsx from "clsx";
import type { AgReportState, AgStudioApi } from "ag-studio";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { InsightsData } from "@/app/console/insights/facts";
import { INSIGHTS_ACTIONS } from "./actions";
import { buildAnalyst } from "./analyst";
import { InsightsLedger } from "./InsightsLedger";
import "./insights.css";
import { filterClaims, filterLabel, filterPicks, insightsReport, paidByDayChart, panelName, reportRows, type FilterPick } from "./report";
import { buildSources } from "./sources";
import { colorResolver, fonts, onThemeChange, readTheme } from "./studio-setup";
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

// Studio's own words for the analyst's panel, in the console's voice. Its thread picker is hidden (insights.css); the
// button beside it reads "Start over".
const LOCALE = {
  panelTitleAi: "Recall analyst",
  aiMessageInputPlaceholder: "Ask about this recall's claims…",
  aiNewChat: "This conversation",
  aiNewThreadButton: "Start over",
};

// The analyst's rail lives in Studio's edit-mode panels (view mode's panels take only filters); the report opens there
// with only that panel shown, and insights.css takes the editor chrome off the read-only panels.
const PANELS = { edit: { right: ["ai" as const] }, view: { right: ["filters" as const] } };

// Studio's keyboard model for the canvas: Tab goes from panel to panel, Enter goes into a panel's controls and Esc comes
// back out. Studio leaves those stops unnamed, so each is named for its panel ("Decisions") and says the keys
// (insights.css draws the focus ring on the panel's card); a panel with nothing to operate leaves the Tab order.
// Studio's editor overlays (the field-mapping skeleton behind every panel) stay in the DOM on a report nobody edits,
// so they leave the accessibility tree and the Tab order. Re-run whenever Studio redraws a panel.
const PANEL_KEYS = "insights-panel-keys";
const CONTROLS = "a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])";

function namePanels(root: HTMLElement) {
  const set = (el: HTMLElement, name: string, value: string) => el.getAttribute(name) !== value && el.setAttribute(name, value);
  for (const panel of root.querySelectorAll<HTMLElement>(".ag-studio-layout-widget")) {
    const stop = panel.querySelector<HTMLElement>(":scope > .ag-studio-layout-widget-focus-container");
    const content = panel.querySelector(".ag-studio-layout-widget-content");
    if (!stop || !content) continue;
    const text = (cls: string) => panel.querySelector(`.ag-studio-layout-widget-${cls}`)?.textContent?.trim() ?? "";
    // Studio's tab guards hand focus to the stop, so a panel with nothing to operate takes both out of the Tab order.
    const inert = !content.querySelector(CONTROLS);
    if (panel.hasAttribute("data-no-controls") !== inert) panel.toggleAttribute("data-no-controls", inert);
    for (const el of [stop, ...panel.querySelectorAll<HTMLElement>(":scope > .ag-tab-guard")]) set(el, "tabindex", inert ? "-1" : "0");
    if (inert) {
      for (const name of ["role", "aria-label", "aria-describedby"]) stop.removeAttribute(name);
      continue;
    }
    set(stop, "role", "group");
    set(stop, "aria-label", panelName(text("title")) || "Panel");
    set(stop, "aria-describedby", PANEL_KEYS);
    for (const overlay of panel.querySelectorAll<HTMLElement>(".ag-studio-layout-widget-skeleton-overlay-container:not([inert])")) {
      overlay.setAttribute("aria-hidden", "true");
      overlay.inert = true;
    }
  }
}

const samePicks = (a: FilterPick[], b: FilterPick[]) => JSON.stringify(a) === JSON.stringify(b);
const pageOf = (state: AgReportState<InsightsRegistry>) => state.pages.find((p) => p.id === state.selectedPageId);

const plural = (n: number, one: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : `${one}s`}`;

// Studio's canvas rows are 16px, inside its 32px padding top and bottom: the host is sized to the report, so the page
// scrolls as one and no panel scrolls inside another.
const ROW = 16;
const CANVAS_PAD = 64;
// The console's header and its hairline, which the analyst's rail sticks under.
const HEADER = 57;

export default function InsightsStudio({ data, narrow = false }: { data: InsightsData; narrow?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const api = useRef<AgStudioApi<InsightsRegistry> | null>(null);
  // What a click on a funnel drop, a decision or a refusal reason filters the whole page to (Studio's cross-filter).
  const [picks, setPicks] = useState<FilterPick[]>([]);
  const shown = useMemo(() => filterClaims(data.claims, picks), [data, picks]);
  const mode = useSyncExternalStore(onThemeChange, readTheme, () => "dark");
  const { theme, labelColor } = useMemo(() => {
    void mode; // Rebuilt from the live tokens whenever the theme toggles.
    const { resolve, done } = colorResolver();
    try {
      // The day chart prints each day's dollars on its green column in the page's background colour.
      return { theme: buildTheme(lib, resolve, fonts()), labelColor: resolve("var(--bg)") };
    } finally {
      done();
    }
  }, [mode]);
  // The theme Studio starts with; later changes go through setProperty below.
  const initialTheme = useRef(theme);
  const initialLabel = useRef(labelColor);
  const [askOpen, setAskOpen] = useState(false);
  // Rendered in the browser only (InsightsLoader), after the page header that holds the slot.
  const [actions] = useState(() => document.getElementById(INSIGHTS_ACTIONS));
  const height = reportRows(data, narrow) * ROW + CANVAS_PAD;

  useEffect(() => {
    if (!host.current) return;
    const studio = lib.createStudio<InsightsRegistry>(
      host.current,
      {
        theme: initialTheme.current,
        loadThemeGoogleFonts: false,
        // A day reads as the rest of the app writes it ("4 Nov"), not in the browser's locale (11/04/2026).
        data: { ...buildSources(data), buckets: lib.createBuckets<InsightsRegistry>({ overrides: [{ id: "day", format: "d mmm" }] }) },
        initialState: insightsReport(data, narrow, initialLabel.current),
        widgets: insightsWidgets(lib),
        panels: PANELS,
        localeText: LOCALE,
        ai: buildAnalyst(lib, data),
        aiToolDisplay: toolDisplay,
        mode: "edit",
        onStateUpdated: ({ state }) => {
          const next = filterPicks(pageOf(state));
          setPicks((prev) => (samePicks(prev, next) ? prev : next));
          // The panel's own header closes it too: the page's button follows. Studio's state names a panel only while it is
          // collapsed (or resized), so an open analyst has no `collapsed` at all.
          setAskOpen(state.panels?.ai?.collapsed !== true);
        },
      },
      { modules: [lib.AgStudioAiModule] },
    );
    api.current = studio;
    const root = host.current;
    namePanels(root);
    const panels = new MutationObserver(() => namePanels(root));
    panels.observe(root, { childList: true, subtree: true });
    return () => {
      panels.disconnect();
      api.current = null;
      studio.destroy();
    };
  }, [data, narrow]);

  // Which input moved focus last: the panels' focus ring shows for the keyboard only (insights.css), since Studio focuses a
  // panel from code after a click too, where :focus-visible alone can't tell.
  useEffect(() => {
    const root = document.documentElement;
    const pointer = () => (root.dataset.modality = "pointer");
    const key = (e: KeyboardEvent) => !e.metaKey && !e.ctrlKey && (root.dataset.modality = "key");
    window.addEventListener("pointerdown", pointer, true);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointerdown", pointer, true);
      window.removeEventListener("keydown", key, true);
      delete root.dataset.modality;
    };
  }, []);

  useEffect(() => {
    const studio = api.current;
    if (!studio || theme === initialTheme.current) return;
    studio.setProperty("theme", theme);
    // The day chart's labels follow the page's background into the new theme.
    const state = studio.getState();
    studio.setState({
      ...state,
      pages: state.pages.map((page) => {
        const chart = page.widgets?.["paid-by-day"];
        if (!chart || chart.type !== "column-chart-grouped") return page;
        return { ...page, widgets: { ...page.widgets, "paid-by-day": { ...chart, format: { ...chart.format, ...paidByDayChart(labelColor).format, title: chart.format?.title } } } };
      }),
    });
  }, [theme, labelColor]);

  const toggleAsk = () => {
    const studio = api.current;
    if (!studio) return;
    const state = studio.getState();
    const open = state.panels?.ai?.collapsed === true;
    studio.setState({ ...state, panels: { ...state.panels, ai: { ...state.panels?.ai, collapsed: !open } } });
    setAskOpen(open);
    if (!open) return;
    // The rail sticks under the console's header at the window's height (insights.css): the page scrolls it up to there,
    // so its question box is on screen, then focus goes into the box, ready to type. Studio draws the rail a frame or two
    // after the state changes.
    let tries = 0;
    const settle = () => {
      const box = host.current?.querySelector<HTMLElement>(".ag-studio-ai-panel textarea, .ag-studio-ai-panel [contenteditable]");
      if (!box) return void (tries++ < 20 && requestAnimationFrame(settle));
      const top = (host.current?.getBoundingClientRect().top ?? 0) + window.scrollY - HEADER;
      if (box.getBoundingClientRect().bottom > window.innerHeight && top > window.scrollY) {
        window.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
      box.focus({ preventScroll: true });
    };
    requestAnimationFrame(settle);
  };

  const clearFilter = () => {
    const studio = api.current;
    if (!studio) return;
    const state = studio.getState();
    studio.setState({ ...state, pages: state.pages.map((page) => ({ ...page, crossFilter: undefined })) });
    // The Clear button goes with the filter; the bar keeps the focus and says what the page shows now.
    bar.current?.focus();
  };

  // Studio sets its widget titles in 700, outside DESIGN.md's 400/500/600; the theme's title weight doesn't reach them.
  // insights-report (insights.css) takes Studio's editor chrome off the read-only panels.
  const filtered = picks.length > 0;
  return (
    <div className="flex w-full flex-col">
      {actions &&
        createPortal(
          <button
            type="button"
            onClick={toggleAsk}
            aria-expanded={askOpen}
            className="-my-3 inline-flex min-h-11 items-center text-ui text-text underline decoration-line-strong underline-offset-4 hover:decoration-text"
          >
            {askOpen ? "Close the analyst" : "Ask about this recall"}
          </button>,
          actions,
        )}
      {/* The figures follow the page's filter; a pick no list here can read leaves them on every claim. */}
      <div className="px-4 sm:px-6 lg:px-8">
        <InsightsLedger claims={(filtered && shown) || data.claims} unitsSold={data.recall.unitsSold} />
      </div>
      {/* The page's filter, said in words with a way out: a pick in one panel changes every number on the page. */}
      <div ref={bar} tabIndex={-1} role="status" className={clsx("outline-none", filtered ? "mx-4 flex min-h-11 items-center gap-x-3 border-b border-line text-ui sm:mx-6 lg:mx-8" : "sr-only")}>
        {filtered && (
          <>
            <p className="min-w-0 truncate text-muted">
              Showing <span className="font-medium text-text">{filterLabel(picks)}</span>
              {shown ? (
                <>
                  {" "}
                  · <span className="tabular-nums text-text">{shown.length}</span> of {plural(data.claims.length, "claim")}
                </>
              ) : (
                " · the figures above count every claim"
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
        )}
      </div>
      <div
        ref={host}
        style={{ height }}
        className={clsx("insights-report w-full [&_.ag-cell]:[font-variant-numeric:normal] [&_.ag-studio-layout-widget-title]:font-medium!", !askOpen && "insights-ask-closed")}
      />
      <p id={PANEL_KEYS} hidden>
        Press Enter to use this panel&apos;s controls, the arrow keys or Tab to move between them, and Escape to come back out. A pick filters the whole page until you
        pick it again or press Clear filter above the report.
      </p>
    </div>
  );
}
