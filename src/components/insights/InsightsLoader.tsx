"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import type { InsightsData } from "@/app/console/insights/facts";
import { InsightsSkeleton } from "./InsightsSkeleton";

// AG Studio (with Grid and Charts Enterprise inside it) loads only here, in the browser, so no other console page
// carries its weight. From 640px it is the report; below 1024px its panels stack one per row at the canvas's full
// width (a laptop at 200% zoom keeps every panel). Phones get MobileSummary's figures and funnel instead.
const InsightsStudio = dynamic(() => import("./InsightsStudio"), { ssr: false, loading: () => <InsightsSkeleton /> });

function media(query: string) {
  return {
    subscribe(onChange: () => void) {
      const q = window.matchMedia(query);
      q.addEventListener("change", onChange);
      return () => q.removeEventListener("change", onChange);
    },
    read: () => window.matchMedia(query).matches,
  };
}
const shown = media("(min-width: 640px)");
const wide = media("(min-width: 1024px)");

export function InsightsLoader({ data }: { data: InsightsData }) {
  const isShown = useSyncExternalStore(shown.subscribe, shown.read, () => false);
  const isWide = useSyncExternalStore(wide.subscribe, wide.read, () => true);
  return isShown ? <InsightsStudio data={data} narrow={!isWide} /> : <InsightsSkeleton />;
}
