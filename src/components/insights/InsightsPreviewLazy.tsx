"use client";

import dynamic from "next/dynamic";
import { studioLicence } from "@/lib/agStudioLicence";

// AG Studio's chunk (about 1.6MB gzipped) for the homepage's Insights step: imported only when the tour asks
// (loadInsightsPreview, as the tour's frame comes near, or on hover, focus or pick of the Insights tab, at 1024px and up),
// never with the page, never on phones, and only under a valid, unexpired key (lib/agStudioLicence.ts): without one the
// still (InsightsStill, the same page in plain DOM) is the step, and Studio's module never loads. Read in the browser
// at load, so a page built before the key expired still keeps Studio off after it.

export const STUDIO_ON_HOME = studioLicence() !== null;

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
