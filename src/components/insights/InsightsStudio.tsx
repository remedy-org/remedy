"use client";

import clsx from "clsx";
import type { AgReportState, AgStudioApi } from "ag-studio";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import type { InsightsData } from "@/app/console/insights/facts";
import { INSIGHTS_ACTIONS } from "./actions";
import { buildAnalyst } from "./analyst";
import { InsightsLedger } from "./InsightsLedger";
import "./insights.css";
import { CONSOLE_CHART, filterClaims, filterLabel, filterPicks, insightsReport, paidByDayChart, PAID_BY_DAY, panelName, reportRows, type FilterPick } from "./report";
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
  // A chart's tooltip names its series as the page does ("Paid through PayPal"), never Studio's "(sum)", and a
  // cross-filter's part of it in words.
  aggregationSumFieldName: "${name}",
  aggregationMaxFieldName: "${name}",
  crossFilterSumFieldName: "${name}, in this filter",
  crossFilterMaxFieldName: "${name}, in this filter",
  panelTitleAi: "Recall analyst",
  aiMessageInputPlaceholder: "Ask about this recall’s claims…",
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
    // The day chart keeps its columns' skeleton until AG Charts has drawn (insights.css), so its heading never sits over
    // an empty panel.
    if (text("title") === PAID_BY_DAY && !panel.hasAttribute("data-day-chart")) panel.setAttribute("data-day-chart", "");
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
const findActions = () => document.getElementById(INSIGHTS_ACTIONS);
const noActions = () => null;
const nextFrame = (changed: () => void) => {
  const id = requestAnimationFrame(changed);
  return () => cancelAnimationFrame(id);
};
const pageOf = (state: AgReportState<InsightsRegistry>) => state.pages.find((p) => p.id === state.selectedPageId);

const plural = (n: number, one: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : `${one}s`}`;

// Studio's canvas rows are 16px, inside its 32px padding top and bottom: the host is sized to the report, so the page
// scrolls as one and no panel scrolls inside another.
const ROW = 16;
const CANVAS_PAD = 64;

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
      return { theme: buildTheme(lib, resolve, fonts()), labelColor: resolve("var(--pay-fill-text)") };
    } finally {
      done();
    }
  }, [mode]);
  // The theme Studio starts with; later changes go through setProperty below.
  const initialTheme = useRef(theme);
  const initialLabel = useRef(labelColor);
  const [askOpen, setAskOpen] = useState(false);
  const askButton = useRef<HTMLButtonElement>(null);
  // The page header's slot for the button, read as an external store: a render can run before a client-side navigation
  // has committed the new page's header (a cached Insights chunk renders at once), and React reads the store again once
  // the page is committed (and on the next frame), so the button always finds its slot.
  const actions = useSyncExternalStore(nextFrame, findActions, noActions);
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
  }, [theme]);

  // The day chart's labels follow the page's background into a new theme, and step aside under a pick: the dimmed
  // columns and the solid part the pick keeps say it, where Studio would print the kept amount at each column's foot.
  const labelled = picks.length === 0;
  const chartFormat = useRef({ labelColor, labelled });
  useEffect(() => {
    const studio = api.current;
    if (!studio || (chartFormat.current.labelColor === labelColor && chartFormat.current.labelled === labelled)) return;
    chartFormat.current = { labelColor, labelled };
    const state = studio.getState();
    studio.setState({
      ...state,
      pages: state.pages.map((page) => {
        const chart = page.widgets?.["paid-by-day"];
        if (!chart || chart.type !== "column-chart-grouped") return page;
        return { ...page, widgets: { ...page.widgets, "paid-by-day": { ...chart, format: { ...chart.format, ...paidByDayChart(labelColor, labelled, CONSOLE_CHART).format, title: chart.format?.title } } } };
      }),
    });
  }, [labelColor, labelled]);

  const toggleAsk = () => {
    const studio = api.current;
    if (!studio) return;
    const state = studio.getState();
    const open = state.panels?.ai?.collapsed === true;
    studio.setState({ ...state, panels: { ...state.panels, ai: { ...state.panels?.ai, collapsed: !open } } });
    setAskOpen(open);
    if (!open) return;
    // The rail is a sheet fixed under the console's header (insights.css): the page never scrolls to it. Focus goes into
    // its question box, ready to type, once Studio has drawn it (a frame or two after the state changes).
    let tries = 0;
    const settle = () => {
      const box = host.current?.querySelector<HTMLElement>(".ag-studio-ai-panel textarea, .ag-studio-ai-panel [contenteditable]");
      if (!box) return void (tries++ < 20 && requestAnimationFrame(settle));
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
    // While the analyst's sheet is open, the page gives it its width (from 1024px), so the panels reflow beside it
    // rather than lie half under it.
    <div className={clsx("flex w-full flex-col transition-[padding] duration-160", askOpen && "lg:pr-[400px]")}>
      {actions &&
        !askOpen &&
        createPortal(
          // The quiet button beside the title: the analyst is the page's second way in, after the panels themselves.
          <Button ref={askButton} variant="secondary" size="sm" onClick={toggleAsk} aria-expanded={false}>
            Ask the analyst
          </Button>,
          actions,
        )}
      {/* Open, the way out sits in the sheet's own header (the sheet covers the page header's corner), at any scroll. */}
      {askOpen &&
        createPortal(
          <button
            type="button"
            onClick={() => {
              toggleAsk();
              requestAnimationFrame(() => askButton.current?.focus());
            }}
            aria-expanded
            className="fixed top-[68px] right-4 z-40 inline-flex min-h-8 items-center rounded-control px-2 text-ui text-muted transition-colors duration-160 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-0"
          >
            Close the analyst
          </button>,
          document.body,
        )}
      {/* The figures follow the page's filter; a pick no list here can read leaves them on every claim. */}
      <div className="page">
        <InsightsLedger claims={(filtered && shown) || data.claims} unitsSold={data.recall.unitsSold} />
      </div>
      {/* The page's filter, said in words with a way out: a pick in one panel changes every number on the page. Always
          there at one height, saying how to pick until something is, so nothing under it moves when a pick lands. */}
      <div className="page">
        <div ref={bar} tabIndex={-1} role="status" className="flex h-11 items-center gap-x-3 border-b border-line text-ui outline-none">
          {!filtered && (
            <p className="min-w-0 truncate text-muted">
              Showing all {plural(data.claims.length, "claim")} · Pick a decision, a drop or a reason to filter the page
            </p>
          )}
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
      </div>
      <div
        ref={host}
        // The analyst's empty column says what it answers from (insights.css prints it).
        style={{ height, ["--analyst-intro" as string]: JSON.stringify(`Answers from this recall’s ${plural(data.claims.length, "claim")}, naming the claim IDs it used. Ask for a chart and it adds one to this page.`) }}
        className={clsx("insights-report insights-frame [&_.ag-cell]:[font-variant-numeric:normal] [&_.ag-studio-layout-widget-title]:font-medium!", !askOpen && "insights-ask-closed")}
      />
      <p id={PANEL_KEYS} hidden>
        Press Enter to use this panel&rsquo;s controls, the arrow keys or Tab to move between them, and Escape to come back out. A pick filters the whole page until you
        pick it again or press Clear filter above the report.
      </p>
    </div>
  );
}
