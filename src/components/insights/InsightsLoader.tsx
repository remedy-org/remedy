"use client";

import dynamic from "next/dynamic";
import type { InsightsData } from "@/app/console/insights/facts";
import { InsightsSkeleton } from "./InsightsSkeleton";

// AG Studio (with Grid and Charts Enterprise inside it) loads only here, in the browser, so no other console page
// carries its weight.
const InsightsStudio = dynamic(() => import("./InsightsStudio"), { ssr: false, loading: () => <InsightsSkeleton /> });

export function InsightsLoader({ data }: { data: InsightsData }) {
  return <InsightsStudio data={data} />;
}
