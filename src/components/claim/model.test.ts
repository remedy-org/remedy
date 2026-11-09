import { describe, expect, it } from "vitest";
import { sampleClaim } from "@/lib/__fixtures__/claim";
import { DEMO_SPEC } from "@/lib/demo/kikea";
import { acceptsStandIn, businessDaysAfter, codeDiff, coverCrop, handWrittenLabel, maskEmail, misreadOf, ownerLabel, payoutHold, productNoun, readableReasons, receiptPollDelay, refusalHeadline, taggedThing, timelineOf } from "./model";
import { latestRuns, nextSample } from "./Scoreboard";

describe("codeDiff", () => {
  it("marks the one character the model read differently, and says which", () => {
    const d = codeDiff("K7P", "K7Q");
    expect(d.cells.map((c) => c.same)).toEqual([true, true, false]);
    expect(d.caption).toBe("The third character: the letter P in your code, the letter Q on the tag.");
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
    expect(refusalHeadline(refused("code"), DEMO_SPEC)).toBe("The code on the tag doesn’t match");
    expect(refusalHeadline(refused("step_1"), DEMO_SPEC)).toBe("The photo doesn’t show it cut fully in half");
    expect(refusalHeadline(refused("session", "blocked"), DEMO_SPEC)).toBe("This photo wasn’t sent from Remedy’s camera");
    expect(refusalHeadline(refused("duplicate_photo", "blocked"), DEMO_SPEC)).toBe("This photo was already used in another claim");
  });
  it("falls back to the general sentence", () => {
    expect(refusalHeadline(refused("something_new"), DEMO_SPEC)).toBe("This photo doesn’t prove the claim");
  });
  it("speaks of photos when several were reposted", () => {
    const claim = { ...refused("duplicate_photo", "blocked"), photos: sampleClaim().photos.concat(sampleClaim().photos) };
    expect(refusalHeadline(claim, DEMO_SPEC)).toBe("These photos were already used in another claim");
  });
});

describe("readableReasons", () => {
  const dupe = (n: number) => ({ check: "duplicate_photo", outcome: "reject" as const, text: `Photo ${n} was already used in another claim` });
  it("folds one repost line per photo into one", () => {
    expect(readableReasons([dupe(1), dupe(2), dupe(3)], 3).map((r) => r.text)).toEqual(["All three photos were already used in another claim"]);
    expect(readableReasons([dupe(1), dupe(3)], 3).map((r) => r.text)).toEqual(["Photos 1 and 3 were already used in another claim"]);
  });
  it("leaves a single reason, and other checks, as they are", () => {
    const session = { check: "session", outcome: "reject" as const, text: "Not taken in this session" };
    expect(readableReasons([dupe(1)], 1)).toEqual([dupe(1)]);
    expect(readableReasons([session, dupe(1), dupe(2)], 2).map((r) => r.text)).toEqual(["Not taken in this session", "Both photos were already used in another claim"]);
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
  it("keeps each sample's latest decided run once", () => {
    expect(latestRuns([]).size).toBe(0);
    expect(latestRuns([{ sample: "genuine", decision: "paid" }]).size).toBe(1);
    expect(latestRuns([{ sample: "genuine", decision: "paid" }, { sample: "genuine", decision: "held", unanswered: true }]).get("genuine")?.decision).toBe("paid");
    expect(latestRuns([{ sample: "wrong-code", decision: "pending" }]).size).toBe(0);
    const all = [
      { sample: "reposted", decision: "blocked" },
      { sample: "ai-no-session", decision: "blocked" },
      { sample: "wrong-code", decision: "rejected" },
      { sample: "genuine", decision: "paid" },
    ] as const;
    expect(latestRuns([...all]).size).toBe(4);
  });
  it("suggests the next unrun sample in the guided order", () => {
    expect(nextSample([{ sample: "genuine", decision: "paid" }], "genuine")?.id).toBe("wrong-code");
    expect(nextSample([{ sample: "wrong-code", decision: "rejected" }], "wrong-code")?.id).toBe("genuine");
    expect(nextSample([{ sample: "genuine", decision: "paid" }, { sample: "wrong-code", decision: "rejected" }, { sample: "ai-no-session", decision: "blocked" }], "reposted")).toBeNull();
  });
});

describe("misreadOf", () => {
  it("names the one character read differently, in the owner's terms", () => {
    expect(misreadOf("K7Q", "K7O")).toEqual({
      headline: "We read the letter O where your code has the letter Q",
      ask: "If your tag says K7Q, ask a person to look. They decide from your photos, and you can ask once.",
    });
  });
  it("names a digit in words, so a zero never reads as the letter O", () => {
    expect(misreadOf("K7O", "K70")?.headline).toBe("We read a zero where your code has the letter O");
    expect(codeDiff("B8K", "BBK").caption).toBe("The second character: an eight in your code, the letter B on the tag.");
  });
  it("names the whole code when several characters differ, and says nothing when nothing was read or it matches", () => {
    expect(misreadOf("K7P", "R8D")?.headline).toBe("We read R8D where your code is K7P");
    expect(misreadOf("K7P", null)).toBeNull();
    expect(misreadOf("K7P", "K7P")).toBeNull();
  });
});

describe("payoutHold", () => {
  const held = (detail: string) =>
    sampleClaim({
      decision: "held",
      reasons: [{ check: "payout", outcome: "hold", text: "PayPal didn't accept the payout, so a person will send it" }],
      events: [{ at: "2026-11-06T10:00:00Z", type: "payout_failed", detail }],
    });
  it("tells a refused payout from one that never reached PayPal, and is null for any other hold", () => {
    expect(payoutHold(held("PayPal didn't take the payout: RECEIVER_UNREGISTERED"))).toBe("refused");
    expect(payoutHold(held("Remedy couldn't reach PayPal: fetch failed"))).toBe("network");
    expect(payoutHold(sampleClaim({ decision: "held", reasons: [{ check: "model", outcome: "hold", text: "x" }] }))).toBeNull();
    expect(payoutHold(sampleClaim({ decision: "paid" }))).toBeNull();
  });
});

describe("coverCrop", () => {
  it("crops a landscape feed to a portrait viewfinder's centre, as object-cover shows it", () => {
    expect(coverCrop(1280, 720, 359, 534)).toEqual({ sx: 398, sy: 0, sw: 484, sh: 720 });
  });
  it("crops a portrait feed to a 4:3 frame's middle band", () => {
    expect(coverCrop(1440, 1920, 640, 480)).toEqual({ sx: 0, sy: 420, sw: 1440, sh: 1080 });
  });
  it("keeps the whole feed before the box is laid out", () => {
    expect(coverCrop(1280, 720, 0, 0)).toEqual({ sx: 0, sy: 0, sw: 1280, sh: 720 });
  });
});

describe("the tag's words", () => {
  it("finds what the hand-written tag is tied to", () => {
    expect(taggedThing(DEMO_SPEC)).toBe("cut pillow");
    expect(taggedThing({ proof_steps: ["Cut it in half"] })).toBeNull();
  });
  it("masks a login email so its owner recognises it", () => {
    expect(maskEmail("pat@owner.test")).toBe("p••@owner.test");
  });
});
