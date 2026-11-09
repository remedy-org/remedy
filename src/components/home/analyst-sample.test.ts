import { describe, expect, it, vi } from "vitest";
import sample from "./analyst-sample.json";

vi.mock("server-only", () => ({}));

type Recording = { question: string; answer: string; tools: { name: string; id?: string }[] };
const recorded = (sample as { recorded: Recording | null }).recorded;

// The homepage's analyst answer is a recording: every claim id and count in it must be true of the demo claims (lib/demo/claims.ts).
describe.skipIf(!recorded)("analyst recording", () => {
  it("names only claims in the seed, and the seed's refusal count", async () => {
    const { previewSeed } = await import("@/components/console/preview");
    const { insightsPreview } = await import("@/components/insights/preview");
    const { insightsStill } = await import("@/components/insights/still");
    const ids = new Set(previewSeed().claims.map((c) => c.id));
    const text = `${recorded!.question}\n${recorded!.answer}\n${recorded!.tools.map((t) => t.id ?? "").join(" ")}`;
    for (const id of text.match(/RM-\d{4}/g) ?? []) expect(ids).toContain(id);
    const refused = insightsStill(insightsPreview()).totals.refused;
    const said = text.match(/(\d+) (?:claims )?(?:were )?refused/);
    if (said) expect(Number(said[1])).toBe(refused);
  });
});
