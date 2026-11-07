import { describe, expect, it } from "vitest";
import { captions, panelName, provenance, refusalRows } from "./report";

type Row = Parameters<typeof provenance>[0][number];
const paid = (source: Row["source"], paidOnReview = 0): Row => ({ decision: "Paid", source, amountPaid: 29.99, modelSec: 2, paidOnReview });

describe("timing tile", () => {
  it("is the median of payouts really sent, and says how many waited for a person", () => {
    const say = captions(provenance([paid("Owner"), paid("Judges' demo"), paid("Judges' demo", 1), paid("Sample")]));
    expect(say).toMatchObject({ timeTitle: "Median photo to PayPal", timeField: "timeToSendSec", time: "3 sent · 1 after a person's review" });
    expect(say.timeExhibit).toBe("EXHIBIT E · MEDIAN SECONDS · SAMPLE TIMINGS");
  });

  it("names the count when no payout waited, and falls back to the model's time when none was sent", () => {
    expect(captions(provenance([paid("Owner")])).time).toBe("Median of 1 sent payout");
    expect(captions(provenance([paid("Sample"), paid("Sample", 1)]))).toMatchObject({ timeTitle: "Median photo check", timeField: "modelSec", time: "None sent yet · 2 claims checked" });
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
