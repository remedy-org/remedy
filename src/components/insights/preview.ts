import "server-only";
import { buildInsights, type InsightsData } from "@/app/console/insights/facts";
import { PREVIEW_NOW, previewSeed, typeset } from "@/components/console/preview";

// The homepage's Insights, built on the server from the same 40 seeded claims as the console preview
// (components/console/preview.ts): the facts /console/insights would show for a workspace holding only those claims.

// The kind of check that refused a claim, named as the funnel names its stages (Passed pre-checks, Passed photo check).
const GATE: Record<string, string> = { "No AI": "Pre-check", "Model reads": "Photo check", Person: "Review" };

export function insightsPreview(): InsightsData {
  const { recall, claims } = previewSeed();
  const data = typeset(buildInsights([...claims].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), recall, PREVIEW_NOW));
  return {
    ...data,
    claims: data.claims.map((c) => ({ ...c, refusalGate: (c.refusalGate && (GATE[c.refusalGate] ?? c.refusalGate)) as typeof c.refusalGate })),
  };
}

/** The facts Studio needs on the homepage, without the dossiers (the analyst's reading, which the homepage never runs). */
export function insightsPreviewForStudio(): InsightsData {
  return { ...insightsPreview(), dossiers: {} };
}
