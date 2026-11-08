"use client";

import dynamic from "next/dynamic";

// AG Studio's chunk (about 1.6MB gzipped) for the homepage's Insights step: imported only when the tour asks
// (loadInsightsPreview, on hover, focus or pick of the Insights tab at 1280px and up), never with the page, never from
// scrolling, never on phones. STUDIO_ON_HOME is settled at build: without a production licence key the step keeps its
// still, since Studio would draw its trial watermark across the homepage.

export const STUDIO_ON_HOME = Boolean(process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE);

const load = () => import("./InsightsPreview");
let started: ReturnType<typeof load> | null = null;

/** Starts the import (once). Safe to call on every hover. */
export function loadInsightsPreview() {
  started ??= load();
  return started;
}

export const InsightsPreviewLazy = dynamic(() => loadInsightsPreview(), { ssr: false });
