import { describe, expect, it } from "vitest";
import { sampleClaim } from "@/lib/__fixtures__/claim";
import { DEMO_SPEC } from "@/lib/demo/kikea";
import { acceptsStandIn, businessDaysAfter, codeDiff, handWrittenLabel, ownerLabel, productNoun, receiptPollDelay, refusalHeadline, timelineOf } from "./model";
import { nextSample, scoreLine } from "./Scoreboard";

describe("codeDiff", () => {
  it("marks the one character the model read differently, and says which", () => {
    const d = codeDiff("K7P", "K7Q");
    expect(d.cells.map((c) => c.same)).toEqual([true, true, false]);
    expect(d.caption).toBe("The third character: P in your code, Q on the tag.");
  });

  it("says when nothing was readable", () => {
    expect(codeDiff("K7P", null)).toMatchObject({ readable: false, caption: "No code was readable on the tag." });
    expect(codeDiff("K7P", "").readable).toBe(false);
  });

  it("counts several differences", () => {
    expect(codeDiff("K7P", "R8D").caption).toBe("3 of 3 characters differ: K7P in your code, R8D on the tag.");
  });
});

describe("refusalHeadline", () => {
  const refused = (check: string, decision: "rejected" | "blocked" = "rejected") => sampleClaim({ decision, reasons: [{ check, outcome: "reject", text: "x" }] });
  it("names the check that decided it", () => {
    expect(refusalHeadline(refused("code"), DEMO_SPEC)).toBe("The code on the tag doesn't match");
    expect(refusalHeadline(refused("step_1"), DEMO_SPEC)).toBe("The photo doesn't show it cut fully in half");
    expect(refusalHeadline(refused("session", "blocked"), DEMO_SPEC)).toBe("This photo wasn't taken on this page's camera");
    expect(refusalHeadline(refused("duplicate_photo", "blocked"), DEMO_SPEC)).toBe("This photo was already used in another claim");
  });
  it("falls back to the general sentence", () => {
    expect(refusalHeadline(refused("something_new"), DEMO_SPEC)).toBe("This photo doesn't prove the claim");
  });
});

describe("businessDaysAfter", () => {
  it("skips the weekend", () => {
    // Saturday 7 Nov 2026 -> Tuesday 10 Nov; Thursday 5 Nov -> Monday 9 Nov.
    expect(businessDaysAfter("2026-11-07T14:32:00.000Z", 2)).toBe("Tue 10 Nov");
    expect(businessDaysAfter("2026-11-05T09:00:00.000Z", 2)).toBe("Mon 9 Nov");
  });
});

describe("the view's timeline", () => {
  it("keeps only the stage events, with no detail", () => {
    const events = [
      { at: "2026-11-07T10:00:00.000Z", type: "created", detail: "Logged in" },
      { at: "2026-11-07T10:00:05.000Z", type: "photos_received", detail: "1 photo" },
      { at: "2026-11-07T10:00:20.000Z", type: "payout_sent", detail: "batch X" },
    ];
    expect(timelineOf(events)).toEqual([
      { type: "photos_received", at: "2026-11-07T10:00:05.000Z" },
      { type: "payout_sent", at: "2026-11-07T10:00:20.000Z" },
    ]);
  });
});

describe("copy helpers", () => {
  it("makes the recalled product singular", () => {
    expect(productNoun({ product: "X-VESOLJE Nursing Pillows" })).toBe("X-VESOLJE Nursing Pillow");
  });
  it("stops the receipt's polling within 2 minutes", () => {
    expect(receiptPollDelay(0)).toBe(5_000);
    expect(receiptPollDelay(30_000)).toBe(15_000);
    expect(receiptPollDelay(110_000)).toBeNull();
  });
});

describe("the code step's instruction", () => {
  it("reads the demo's hand-written label, without the note meant for the check", () => {
    expect(handWrittenLabel(DEMO_SPEC)).toBe("X-VESOLJE");
    expect(ownerLabel(DEMO_SPEC.label_must_show[0])).toBe("X-VESOLJE, hand-written on a paper tag tied to the pillow");
    expect(acceptsStandIn(DEMO_SPEC)).toBe(true);
  });
  it("leaves a printed label alone", () => {
    const spec = { label_must_show: ["Model number HB-200, on the sewn-in label"], product: "a high chair" };
    expect(handWrittenLabel(spec)).toBeNull();
    expect(ownerLabel(spec.label_must_show[0])).toBe("Model number HB-200, on the sewn-in label");
    expect(acceptsStandIn(spec)).toBe(false);
  });
});

describe("the demo round", () => {
  it("scores this round's runs against what each sample should do", () => {
    expect(scoreLine([]).text).toBe("0 of 4 run");
    expect(scoreLine([{ sample: "genuine", decision: "paid" }]).text).toBe("1 of 4 run · all as expected");
    expect(scoreLine([{ sample: "genuine", decision: "held" }]).text).toBe("1 of 4 run · 0 of 1 as expected");
    const all = [
      { sample: "reposted", decision: "blocked" },
      { sample: "ai-no-session", decision: "blocked" },
      { sample: "wrong-code", decision: "rejected" },
      { sample: "genuine", decision: "paid" },
    ] as const;
    expect(scoreLine([...all]).text).toBe("All 4 run · 4 of 4 as expected");
  });
  it("counts a run the model never answered as model unavailable, not as a miss", () => {
    expect(scoreLine([{ sample: "genuine", decision: "held", unanswered: true }]).text).toBe("1 of 4 run · 1 model unavailable");
    const round = [
      { sample: "reposted", decision: "blocked" },
      { sample: "ai-no-session", decision: "blocked" },
      { sample: "wrong-code", decision: "held", unanswered: true },
      { sample: "genuine", decision: "held", unanswered: true },
    ] as const;
    expect(scoreLine([...round])).toMatchObject({ expected: 2, unanswered: 2, text: "All 4 run · 2 of 2 as expected · 2 model unavailable" });
    // A run again that the model answered replaces it.
    expect(scoreLine([{ sample: "genuine", decision: "paid" }, ...round]).text).toBe("All 4 run · 3 of 3 as expected · 1 model unavailable");
  });
  it("suggests the next unrun sample in the guided order", () => {
    expect(nextSample([{ sample: "genuine", decision: "paid" }], "genuine")?.id).toBe("wrong-code");
    expect(nextSample([{ sample: "wrong-code", decision: "rejected" }], "wrong-code")?.id).toBe("genuine");
    expect(nextSample([{ sample: "genuine", decision: "paid" }, { sample: "wrong-code", decision: "rejected" }, { sample: "ai-no-session", decision: "blocked" }], "reposted")).toBeNull();
  });
});
