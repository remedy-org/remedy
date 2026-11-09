import "server-only";
import { buildInsights, type InsightsData } from "@/app/console/insights/facts";
import { previewNow, previewSeed, typeset } from "@/components/console/preview";

// The homepage's Insights, built on the server from the same 40 seeded claims as the console preview
// (components/console/preview.ts): the facts /console/insights would show for a workspace holding only those claims.

export function insightsPreview(): InsightsData {
  const { recall, claims } = previewSeed();
  return typeset(buildInsights([...claims].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), recall, previewNow()));
}

/** The facts Studio needs on the homepage, without the dossiers (the analyst's reading, which the homepage never runs). */
export function insightsPreviewForStudio(): InsightsData {
  return { ...insightsPreview(), dossiers: {} };
}
