import "server-only";
import { buildInsights, type InsightsData } from "@/app/console/insights/facts";
import { PREVIEW_NOW, previewSeed } from "@/components/console/preview";

// The homepage's Insights, built on the server from the same 40 seeded sample claims as the console preview
// (components/console/preview.ts): the facts /console/insights would show for a workspace holding only those claims.

export function insightsPreview(): InsightsData {
  const { recall, claims } = previewSeed();
  return buildInsights([...claims].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), recall, PREVIEW_NOW);
}

/** The facts Studio needs on the homepage, without the dossiers (the analyst's reading, which the homepage never runs). */
export function insightsPreviewForStudio(): InsightsData {
  return { ...insightsPreview(), dossiers: {} };
}
