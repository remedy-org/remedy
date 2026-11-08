import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { ARRIVE_ID, PREVIEW_OPEN_ID, previewProps, previewSeed, reportPreview } = await import("@/components/console/preview");
const { insightsPreview } = await import("@/components/insights/preview");
const { insightsStill } = await import("@/components/insights/still");
const { homeInsightsReport } = await import("@/components/insights/report");

// The homepage's grid, Insights still, Studio report and CPSC draft all read the one seed: their numbers must agree.

describe("homepage console tour data", () => {
  it("counts the same 40 sample claims everywhere", () => {
    const counts = previewProps().counts!;
    const { report } = reportPreview();
    const { totals } = insightsStill(insightsPreview());
    expect(counts).toMatchObject({ all: 40, paid: 26, held: 3 });
    expect(counts.rejected + counts.blocked).toBe(9);
    expect(report.stats).toMatchObject({ total: 40, remedied: 26, held: 3 });
    expect(totals).toMatchObject({ claims: 40, paid: 26, held: 3, refused: 9 });
    expect(totals.refused).toBe(counts.rejected + counts.blocked);
  });

  it("reads the funnel 38 → 35 → 26", () => {
    const { totals } = insightsStill(insightsPreview());
    expect([totals.photos, totals.preChecked, totals.photoChecked, totals.paid]).toEqual([38, 35, 26, 26]);
  });

  it("replays an arrival of a seeded paid claim already in the rows, never a 41st", () => {
    const { rows } = previewProps();
    const arrive = rows.find((r) => r.id === ARRIVE_ID);
    expect(arrive?.decision).toBe("paid");
    expect(previewSeed().claims.find((c) => c.id === ARRIVE_ID)?.seeded).toBe(true);
    expect(rows.find((r) => r.id === PREVIEW_OPEN_ID)?.decision).toBe("held");
  });

  it("keeps Studio's home report to five widgets, titled, with two value KPIs", () => {
    const page = homeInsightsReport(insightsPreview()).pages![0];
    const widgets = Object.values(page.widgets ?? {}) as { type?: string; format?: { subtitle?: unknown } }[];
    expect(Object.keys(page.widgets ?? {})).toHaveLength(5);
    expect(widgets.every((w) => !w.format?.subtitle)).toBe(true);
    expect(widgets.filter((w) => w.type === "value")).toHaveLength(2);
  });
});
