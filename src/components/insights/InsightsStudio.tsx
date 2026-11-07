"use client";

import type { AgStudioApi } from "ag-studio";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { InsightsData } from "@/app/console/insights/facts";
import { buildAnalyst } from "./analyst";
import { insightsReport } from "./report";
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
  return { sans: stack("--font-instrument-sans", "ui-sans-serif, system-ui, sans-serif"), mono: stack("--font-plex-mono", "ui-monospace, Menlo, monospace") };
}

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
  const api = useRef<AgStudioApi<InsightsRegistry> | null>(null);
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
        data: buildSources(data),
        initialState: insightsReport(data),
        widgets: insightsWidgets(lib),
        panels: PANELS,
        localeText: LOCALE,
        ai: buildAnalyst(lib, data),
        aiToolDisplay: toolDisplay,
        mode: "edit",
      },
      { modules: [lib.AgStudioAiModule] },
    );
    api.current = studio;
    return () => {
      api.current = null;
      studio.destroy();
    };
  }, [data]);

  useEffect(() => {
    if (api.current && theme !== initialTheme.current) api.current.setProperty("theme", theme);
  }, [theme]);

  return <div ref={host} className="h-full w-full" />;
}
