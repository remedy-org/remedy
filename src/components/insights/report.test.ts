import { describe, expect, it } from "vitest";
import { filterClaims, filterLabel, filterPicks, insightsLedger, panelName, refusalRows, timeField } from "./report";

type Row = Parameters<typeof insightsLedger>[0][number];
const row = (over: Partial<Row> = {}): Row => ({ remedied: 0, refused: 0, amountPaid: 0, amountSent: 0, timeToSendSec: null, modelSec: 2, ...over });

describe("figures", () => {
  it("counts money really sent through PayPal, with what was approved and not sent beside it", () => {
    const l = insightsLedger([row({ remedied: 1, amountPaid: 29.99 }), row({ remedied: 1, amountPaid: 29.99, amountSent: 29.99, timeToSendSec: 4 }), row({ refused: 1 })]);
    expect(l).toMatchObject({ remedied: 2, paidCents: 2999, unsentCents: 2999, refused: 1 });
  });

  it("is the median of payouts really sent, and falls back to the photo check's time when none was", () => {
    expect(insightsLedger([row({ timeToSendSec: 4 }), row({ timeToSendSec: 6 }), row({ timeToSendSec: 90 }), row()])).toMatchObject({ median: 6, timeLabel: "median photo to payout", timed: 3 });
    expect(insightsLedger([row({ modelSec: 3 }), row({ modelSec: null })])).toMatchObject({ median: 3, timeLabel: "median photo check", timed: 1 });
    expect(timeField([row()])).toBe("modelSec");
    expect(insightsLedger([])).toMatchObject({ median: null, timed: 0 });
  });
});

describe("layout", () => {
  it("gives the refusals row room for every reason, never less than the 22-row default", () => {
    expect(refusalRows(0)).toBe(22);
    expect(refusalRows(3)).toBe(22);
    expect(refusalRows(5)).toBeGreaterThan(22);
    // Every reason (its full text over the check that caught it, about 58px) fits in the 224px the 22-row card leaves on a 1280px laptop, plus 16px a row.
    for (let n = 4; n <= 11; n++) expect(224 + (refusalRows(n) - 22) * 16).toBeGreaterThanOrEqual(n * 58);
  });

  it("names a panel's keyboard stop by its title", () => {
    expect(panelName("Decisions")).toBe("Decisions");
  });
});

describe("cross-filter", () => {
  const claim = (id: string, decision: string, refusalReason: string | null, source: "Starter" | "Demo" | "Owner", filedAt = "2026-11-07T10:00:00Z") => ({
    id,
    decision,
    refusalReason,
    source,
    filedAt,
    stage: decision === "Paid" ? ("Paid" as const) : ("Passed photo check" as const),
    amountPaid: decision === "Paid" ? 29.99 : 0,
    modelSec: 2,
    paidOnReview: 0,
  });
  const claims = [
    claim("RM-1", "Paid", null, "Starter", "2026-11-04T23:59:00Z"),
    claim("RM-2", "Paid", null, "Demo"),
    claim("RM-3", "Rejected", "Rejected by a person on review", "Demo"),
    claim("RM-4", "Rejected", "Photo of a screen or a print", "Owner"),
  ];
  const value = (id: string, ...values: string[]) => ({ type: "value" as const, group: 0, field: { id }, values });

  it("reads every widget's picks from the page state", () => {
    expect(filterPicks(undefined)).toEqual([]);
    expect(filterPicks({ crossFilter: { values: { refusals: [value("claims.refusalReason", "Rejected by a person on review")], decisions: [value("claims.decision")] } } })).toEqual([
      { field: "claims.refusalReason", values: ["Rejected by a person on review"] },
    ]);
    expect(filterPicks({ crossFilter: { values: { chart: [{ type: "range", group: 0, field: { id: "claims.modelSec" }, from: 1 }] } } })).toEqual([{ field: "", values: [] }]);
  });

  it("leaves the claims every pick matches, and can't check a pick it can't read", () => {
    const reason = { field: "claims.refusalReason", values: ["Rejected by a person on review"] };
    expect(filterClaims(claims, [reason])?.map((c) => c.id)).toEqual(["RM-3"]);
    expect(filterClaims(claims, [{ field: "claims.decision", values: ["Paid", "Rejected"] }, { field: "claims.source", values: ["Demo"] }])?.map((c) => c.id)).toEqual(["RM-2", "RM-3"]);
    expect(filterClaims(claims, [{ field: "calendar::day", values: ["20261104"] }])?.map((c) => c.id)).toEqual(["RM-1"]);
    expect(filterClaims(claims, [reason, { field: "", values: [] }])).toBeNull();
  });

  it("names the picks in the bar", () => {
    expect(filterLabel([{ field: "claims.refusalReason", values: ["Rejected by a person on review"] }])).toBe("Rejected by a person on review");
    expect(filterLabel([{ field: "claims.stage", values: ["Photos sent"] }, { field: "claims.decision", values: ["Held", "Blocked"] }])).toBe("Furthest stage: Photos sent · Verdict: Held or Blocked");
    expect(filterLabel([{ field: "calendar::day", values: ["20261107", "20261104"] }])).toBe("Filed 7 Nov or 4 Nov");
    expect(filterLabel([{ field: "", values: [] }])).toBe("A pick on a chart");
  });
});
