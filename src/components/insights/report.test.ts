import { describe, expect, it } from "vitest";
import { captions, filterClaims, filterLabel, filterPicks, kpiCaptions, panelName, provenance, refusalRows } from "./report";

type Row = Parameters<typeof provenance>[0][number];
const paid = (source: Row["source"], paidOnReview = 0): Row => ({ decision: "Paid", source, amountPaid: 29.99, modelSec: 2, paidOnReview });

describe("timing tile", () => {
  it("is the median of payouts really sent, and says how many waited for a person", () => {
    const say = captions(provenance([paid("Owner"), paid("Demo"), paid("Demo", 1), paid("Starter")]));
    expect(say).toMatchObject({ timeTitle: "Median photo to PayPal", timeField: "timeToSendSec", time: "3 sent · 1 after a person's review" });
    // Exhibit E charts the tile's own median by day, so it never shows sample timings beside a sent-payout median.
    expect(say).toMatchObject({ timeChart: "Photo to PayPal, by day", timeExhibit: "MEDIAN SECONDS · PAYOUTS SENT" });
  });

  it("names the count when no payout waited, and falls back to the model's time when none was sent", () => {
    expect(captions(provenance([paid("Owner")])).time).toBe("Median of 1 sent payout");
    expect(captions(provenance([paid("Starter"), paid("Starter", 1)]))).toMatchObject({
      timeTitle: "Median photo check",
      timeField: "modelSec",
      time: "2 claims checked",
      timeChart: "Photo check, by day",
      timeExhibit: "MEDIAN SECONDS · PHOTO CHECK",
    });
  });
});

describe("layout", () => {
  it("gives the refusals row room for every reason, never less than the 22-row default", () => {
    expect(refusalRows(0)).toBe(22);
    expect(refusalRows(5)).toBe(22);
    expect(refusalRows(7)).toBeGreaterThan(22);
    // Every reason (about 39px each) fits in the 224px the 22-row card leaves on a 1280px laptop, plus 16px a row.
    for (let n = 6; n <= 11; n++) expect(224 + (refusalRows(n) - 22) * 16).toBeGreaterThanOrEqual(n * 39);
  });

  it("names a panel's keyboard stop by its title and exhibit letter", () => {
    expect(panelName("Decisions", "EXHIBIT B · DECIDED BY THE RULE")).toBe("Decisions, Exhibit B");
    expect(panelName("Units remedied", "")).toBe("Units remedied");
    expect(panelName("A chart the analyst made", "By day")).toBe("A chart the analyst made");
  });
});

describe("cross-filter", () => {
  const claim = (id: string, decision: string, refusalReason: string | null, source: Row["source"], filedAt = "2026-11-07T10:00:00Z") => ({
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
    expect(filterLabel([{ field: "claims.stage", values: ["Photos sent"] }, { field: "claims.decision", values: ["Held", "Blocked"] }])).toBe("Furthest stage: Photos sent · Decision: Held or Blocked");
    expect(filterLabel([{ field: "calendar::day", values: ["20261107", "20261104"] }])).toBe("Filed 7 Nov or 4 Nov");
    expect(filterLabel([{ field: "", values: [] }])).toBe("A pick on a chart");
  });

  it("captions the tiles for the picked claims, never the whole recall's under a filtered number", () => {
    expect(kpiCaptions(claims, claims)).toMatchObject({ remedied: "Destroyed and verified on camera", paid: "$29.99 approved", time: "Median of 1 sent payout" });
    expect(kpiCaptions(claims, [claims[2]])).toEqual({ remedied: "Destroyed and verified on camera", paid: "USD through PayPal", time: "None sent among these claims" });
    expect(kpiCaptions(claims, null)).toEqual({ remedied: "Picked claims only", paid: "Picked claims only", time: "Picked claims only" });
  });
});
