import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { ARRIVE_ID, PREVIEW_OPEN_ID, previewProps, previewSeed, reportPreview } = await import("@/components/console/preview");
const { insightsPreview } = await import("@/components/insights/preview");
const { insightsStill } = await import("@/components/insights/still");
const { homeInsightsReport } = await import("@/components/insights/report");

// The homepage's grid, Insights still, Studio report and CPSC draft all read the demo claims (lib/demo/claims.ts): their
// numbers must agree. (src/lib/demo/claims.test.ts checks every replica against the dataset itself.)

describe("homepage console tour data", () => {
  it("counts the same 7 claims everywhere", () => {
    const counts = previewProps().counts!;
    const { report } = reportPreview();
    const { totals } = insightsStill(insightsPreview());
    expect(counts).toMatchObject({ all: 7, paid: 1, settling: 0, approved: 1, held: 1, rejected: 1, blocked: 3 });
    expect(report.stats).toMatchObject({ total: 7, remedied: 2, held: 1 });
    // Paid is only RM-0442, the claim PayPal paid; RM-6276 is approved with nothing sent.
    expect(report.outcomes.filter((o) => o.decision === "paid").map((o) => [o.label, o.count])).toEqual([
      ["Paid", 1],
      ["Approved", 1],
    ]);
    expect(totals).toMatchObject({ claims: 7, paid: 1, held: 1, refused: 4 });
    expect(totals.refused).toBe(counts.rejected + counts.blocked);
  });

  it("reads the funnel 7 → 4 → 2 → 1", () => {
    const { totals } = insightsStill(insightsPreview());
    expect([totals.photos, totals.preChecked, totals.photoChecked, totals.paid]).toEqual([7, 4, 2, 1]);
  });

  it("replays the arrival of RM-0442, already in the rows, never an extra claim", () => {
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
    const { verdictOf } = await import("@/components/console/VerdictMark");
    const decided = rows.filter((r) => r.decision !== "pending" && r.id !== ARRIVE_ID);
    expect(CONSOLE_ROWS.map((r) => [r.id, r.status, r.filed, r.time ?? null])).toEqual(
      decided.map((r) => [r.id, verdictOf(r), formatDayTime(r.createdAt), r.modelSec === null ? null : duration(r.modelSec)]),
    );
    expect(CONSOLE_ROWS.find((r) => r.status === "held")?.id).toBe(PREVIEW_OPEN_ID);
  });

  it("says paid through PayPal only for the money PayPal paid, and labels nothing as a sample", () => {
    const { ledger } = previewProps();
    const { report } = reportPreview();
    expect(ledger!.paidCents).toBe(2999);
    expect(report).toMatchObject({ demo: 0, sent: 1 });
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

  it("puts every claim in the grid", () => {
    expect(previewProps().rows).toHaveLength(7);
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
    const widgets = homeInsightsReport(insightsPreview(), 34).pages[0].widgets ?? {};
    expect(Object.keys(widgets)).not.toContain("refusals");
    expect(Object.keys(widgets)).toContain("paid-by-day");
  });
});
