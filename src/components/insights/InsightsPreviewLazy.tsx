"use client";

import dynamic from "next/dynamic";

// AG Studio's chunk (about 1.6MB gzipped) for the homepage's Insights step: imported only when the tour asks
// (loadInsightsPreview, as the tour's frame comes near, or on hover, focus or pick of the Insights tab, at 1024px and up),
// never with the page, never on phones. The step names AG Studio, so the real canvas mounts in every build, licensed or not (a
// build without NEXT_PUBLIC_AG_STUDIO_LICENSE shows Studio's trial watermark): the still is only what stands in while it
// loads, and on screens too narrow for its canvas. tour-state.test.ts keeps it on.

export const STUDIO_ON_HOME = true;

/** What a visitor has cross-filtered Studio's page to ("Filed 7 Nov"), and how to clear it. */
export interface StudioFilter {
  label: string;
  clear: () => void;
}

const load = () => import("./InsightsPreview");
let started: ReturnType<typeof load> | null = null;

/** Starts the import (once). Safe to call on every hover. */
export function loadInsightsPreview() {
  started ??= load();
  return started;
}

export const InsightsPreviewLazy = dynamic(() => loadInsightsPreview(), { ssr: false });
