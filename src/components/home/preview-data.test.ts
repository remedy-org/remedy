import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { ARRIVE_ID, PREVIEW_OPEN_ID, previewProps, previewSeed, reportPreview } = await import("@/components/console/preview");
const { insightsPreview } = await import("@/components/insights/preview");
const { insightsStill } = await import("@/components/insights/still");
const { homeInsightsReport } = await import("@/components/insights/report");

// The homepage's grid, Insights still, Studio report and CPSC draft all read the one seed: their numbers must agree.

describe("homepage console tour data", () => {
  it("counts the same 40 claims everywhere", () => {
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

  it("replays an arrival of a paid claim already in the rows, never a 41st", () => {
    const { rows } = previewProps();
    const arrive = rows.find((r) => r.id === ARRIVE_ID);
    expect(arrive?.decision).toBe("paid");
    expect(previewSeed().claims.filter((c) => c.id === ARRIVE_ID)).toHaveLength(1);
    expect(rows.find((r) => r.id === PREVIEW_OPEN_ID)?.decision).toBe("held");
  });

  it("opens newest first, the arriving claim on top, every claim with photos clickable, and the same rows How it works shows", async () => {
    const { CONSOLE_ROWS } = await import("./custody/claim");
    const { formatDayTime } = await import("@/components/console/format");
    const { duration } = await import("@/app/console/_lib/view");
    const { rows } = previewProps();
    expect(rows.map((r) => r.createdAt)).toEqual([...rows.map((r) => r.createdAt)].sort().reverse());
    expect(rows[0].id).toBe(ARRIVE_ID);
    expect(rows.filter((r) => r.evidence).map((r) => r.id)).toEqual(rows.filter((r) => r.photoCount > 0).map((r) => r.id));
    const decided = rows.filter((r) => r.decision !== "pending").slice(0, CONSOLE_ROWS.length);
    expect(CONSOLE_ROWS.map((r) => [r.id, r.status, r.filed, r.time ?? null])).toEqual(
      decided.map((r) => [r.id, r.decision, formatDayTime(r.createdAt), r.modelSec === null ? null : duration(r.modelSec)]),
    );
    expect(CONSOLE_ROWS.find((r) => r.status === "held")?.id).toBe(PREVIEW_OPEN_ID);
  });

  it("draws the claims as a live workspace: paid through PayPal, nothing labelled as a sample", () => {
    const { ledger } = previewProps();
    const { report } = reportPreview();
    expect(ledger!.paidCents).toBeGreaterThan(0);
    expect(report).toMatchObject({ demo: 0 });
    expect(report.sentCents).toBe(ledger!.paidCents);
  });

  it("starts every claim on or after the recall's date", () => {
    const { recall } = reportPreview();
    const first = previewSeed().claims.map((c) => c.createdAt).sort()[0];
    expect(first.slice(0, 10) >= recall.recallDate).toBe(true);
  });

  it("opens a held claim whose recorded answers name only what the photos show", () => {
    const open = previewProps().rows.find((r) => r.id === PREVIEW_OPEN_ID)!.evidence!;
    expect(open.decision).toBe("held");
    const read = { checks: open.checks, summary: open.summary, sentence: open.sentence };
    expect(JSON.stringify(read)).not.toMatch(/\b(demo|sample|test)\b/i);
  });

  it("puts all 40 claims in the grid", () => {
    expect(previewProps().rows).toHaveLength(40);
  });

  it("keeps Studio's home report to six widgets, titled, with two value KPIs and the day chart, fitted to its rows", () => {
    // The tallest frame (680px) gives Studio 37 rows.
    const state = homeInsightsReport(insightsPreview(), 37);
    const page = state.pages![0];
    const widgets = Object.values(page.widgets ?? {}) as { type?: string; format?: { subtitle?: unknown } }[];
    expect(Object.keys(page.widgets ?? {})).toHaveLength(6);
    const layout = Object.values(page.widgetLayout ?? {}) as { yTrack: number; ySpan: number }[];
    expect(Math.max(...layout.map((l) => l.yTrack + l.ySpan))).toBe(37);
    expect(widgets.every((w) => !w.format?.subtitle)).toBe(true);
    expect(widgets.filter((w) => w.type === "value")).toHaveLength(2);
  });

  it("gives the refusal reasons' place to the day chart on a shorter frame, so each day's dollars fit in its column", () => {
    const widgets = homeInsightsReport(insightsPreview(), 35).pages[0].widgets ?? {};
    expect(Object.keys(widgets)).not.toContain("refusals");
    expect(Object.keys(widgets)).toContain("paid-by-day");
  });
});
