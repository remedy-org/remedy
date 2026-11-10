"use client";

import clsx from "clsx";
import type { AgAiHarness, AgReportState, AgStudioApi } from "ag-studio";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import type { InsightsData } from "@/app/console/insights/facts";
import { studioLicence } from "@/lib/agStudioLicence";
import { INSIGHTS_ACTIONS } from "./actions";
import { buildAnalyst } from "./analyst";
import { FilterBar } from "./FilterBar";
import { InsightsLedger } from "./InsightsLedger";
import { PaidLines } from "./PaidLines";
import "./insights.css";
import { chartsPaidByDay, CONSOLE_CHART, filterClaims, filterPicks, insightsReport, paidByDayChart, paidDays, PAID_BY_DAY, panelName, reportRows, type FilterPick } from "./report";
import { buildSources } from "./sources";
import { colorResolver, fonts, onThemeChange, readTheme } from "./studio-setup";
import lib from "./studio-lib";
import { buildTheme } from "./theme";
import { toolDisplay } from "./ToolCards";
import { insightsWidgets, type InsightsRegistry } from "./widgets";

// AG Studio, loaded on this route only (InsightsLoader imports it with ssr: false), from its self-contained UMD build
// (see studio-lib.js) and driven through its vanilla API. The page mounts it only under a valid, unexpired key
// (lib/agStudioLicence.ts); without one it draws Remedy's own report (InsightsReport) and this module never loads.

if (process.env.NODE_ENV !== "production") lib.enableStudioDevValidations();

const LICENSE = studioLicence();
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
  // A count of claims is said in words ("Claim count"), never Studio's "Claim (countd)".
  aggregationCountdFieldName: "${name} count",
  aggregationCountdBucketName: "${name} count",
  crossFilterCountdFieldName: "${name} count, in this filter",
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
    // Studio's editor overlay behind every panel (its field-mapping skeleton: "Column Chart", "Grouped", "Claim count")
    // is for building a report, which nobody does here: out of the accessibility tree, on every panel.
    for (const overlay of panel.querySelectorAll<HTMLElement>(".ag-studio-layout-widget-skeleton-overlay-container:not([inert])")) {
      overlay.setAttribute("aria-hidden", "true");
      overlay.inert = true;
    }
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
  }
}

// An answer that failed offers one quiet "Try again" under its line, on the conversation's last message only; it sends
// the reader's last question again.
function offerRetry(root: HTMLElement, retry: () => void) {
  const messages = root.querySelectorAll<HTMLElement>(".ag-studio-ai-output-message, .ag-studio-ai-user-message, .ag-studio-ai-input-message");
  const last = messages[messages.length - 1];
  const errors = root.querySelectorAll<HTMLElement>(".ag-studio-ai-output-message-error");
  const live = [...errors].find((e) => last?.contains(e)) ?? null;
  for (const b of root.querySelectorAll<HTMLElement>("[data-retry]")) if (b.parentElement !== live) b.remove();
  if (!live || live.querySelector("[data-retry]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.retry = "";
  button.className = "insights-retry";
  button.textContent = "Try again";
  button.addEventListener("click", retry);
  live.append(button);
}

// The reader's last question in the conversation whose answer failed, sent again through Studio's own session.
function resend(harness: AgAiHarness | null) {
  const sessions = (harness?.threads ?? []).map((t) => harness?.getSession?.(t.threadId)).filter((s) => s !== undefined);
  const session = sessions.find((s) => s.status === "error");
  const question = session?.messages.findLast((m) => m.role === "user");
  const text = question?.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();
  if (session && text) session.sendMessage(text);
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

// Studio's canvas rows are 16px, inside its 32px padding top and bottom and a pixel of edge each side (measured: at 64
// Studio's own layout was a 2px scroller that took the wheel): the host is sized to the report, so the page scrolls as
// one and no panel scrolls inside another.
const ROW = 16;
const CANVAS_PAD = 66;

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
    const analyst = buildAnalyst(lib, data);
    let harness: AgAiHarness | null = null;
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
        // Kept, so an answer that failed can be asked again (offerRetry).
        ai: (params) => (harness = typeof analyst === "function" ? analyst(params) : analyst),
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
    const retry = () => resend(harness);
    namePanels(root);
    const panels = new MutationObserver(() => {
      namePanels(root);
      offerRetry(root, retry);
    });
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
    // The analyst gets a separate column on wide desktops; narrower windows use a sheet to protect chart legibility.
    <div data-analyst={askOpen ? "open" : undefined} className="flex w-full flex-col">
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
            Close
          </button>,
          document.body,
        )}
      {/* The figures follow the page's filter; a pick no list here can read leaves them on every claim. */}
      <div className="page">
        <InsightsLedger claims={(filtered && shown) || data.claims} unitsSold={data.recall.unitsSold} />
      </div>
      <FilterBar ref={bar} picks={picks} shown={shown ? shown.length : null} total={data.claims.length} onClear={clearFilter} />
      <div
        ref={host}
        // The analyst's empty column says what it answers from (insights.css prints it).
        // The panels start on the canvas's top edge (insights.css), so all of its padding is left under the last row: the
        // day lines are drawn up over that empty foot, so they follow the panels as one panel follows another.
        style={{ height, marginBottom: chartsPaidByDay(data) ? undefined : -CANVAS_PAD, ["--analyst-intro" as string]: JSON.stringify(`Answers from this recall’s ${plural(data.claims.length, "claim")}, naming the claim IDs it used. Ask for a chart and it adds one to this page.`) }}
        className={clsx("insights-report insights-frame [&_.ag-cell]:[font-variant-numeric:normal] [&_.ag-studio-layout-widget-title]:font-medium!", !askOpen && "insights-ask-closed")}
      />
      {/* Under three days of payouts, the day chart is plain lines: each day, its payouts and its dollars, following the
          page's filter as the figures above do. */}
      {!chartsPaidByDay(data) && <PaidLines days={paidDays((filtered && shown) || data.claims)} />}
      <p id={PANEL_KEYS} hidden>
        Press Enter to use this panel&rsquo;s controls, the arrow keys or Tab to move between them, and Escape to come back out. A pick filters the whole page until you
        pick it again or press Clear filter above the report.
      </p>
    </div>
  );
}
