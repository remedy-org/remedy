"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import type { InsightsData } from "@/app/console/insights/facts";
import { InsightsSkeleton } from "./InsightsSkeleton";

// AG Studio (with Grid and Charts Enterprise inside it) loads only here, in the browser, so no other console page
// carries its weight. Below 1024px its canvas doesn't reflow, so it isn't mounted there: the page shows MobileSummary.
const InsightsStudio = dynamic(() => import("./InsightsStudio"), { ssr: false, loading: () => <InsightsSkeleton /> });

const QUERY = "(min-width: 1024px)";
const wide = {
  subscribe(onChange: () => void) {
    const q = window.matchMedia(QUERY);
    q.addEventListener("change", onChange);
    return () => q.removeEventListener("change", onChange);
  },
  read: () => window.matchMedia(QUERY).matches,
};

export function InsightsLoader({ data }: { data: InsightsData }) {
  const isWide = useSyncExternalStore(wide.subscribe, wide.read, () => false);
  return isWide ? (
    <InsightsStudio data={data} />
  ) : (
    <div className="hidden h-full lg:block">
      <InsightsSkeleton />
    </div>
  );
}
