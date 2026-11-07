import { describe, expect, it } from "vitest";
import { toDrawerClaim } from "@/app/console/_lib/drawer";
import { barsOf, decisionSentence, toRow } from "@/app/console/_lib/view";
import { decidingReasons } from "@/components/claim/model";
import { sampleClaim, sampleRecall } from "./__fixtures__/claim";
import { appealReason, canAskForReview, uncertainRead } from "./appeal";
import { DEMO_SPEC } from "./demo/kikea";
import recorded from "./review/replay.json";
import { decide } from "./rule";
import { decidingReason, summarize } from "./store/store";
import { Verdict, type Claim, type Reason } from "./types";

// The eval's recorded answers (src/lib/review/replay.json), decided by the app's own rule, as the claim they'd make.
function evalClaim(prefix: string, over: Partial<Claim> = {}): Claim {
  const r = (recorded as { case: string; code: string; photos: unknown[]; verdict: unknown }[]).find((x) => x.case.startsWith(prefix))!;
  const verdict = Verdict.parse(r.verdict);
  const { outcome, reasons } = decide(verdict, { spec: DEMO_SPEC, code: r.code, photos: r.photos.length });
  return sampleClaim({ code: r.code, verdict, reasons, decision: outcome === "pass" ? "paid" : outcome === "hold" ? "held" : "rejected", ...over });
}

const reviewRejected = (c: Claim): Claim => ({ ...c, decision: "rejected", reasons: [...c.reasons, { check: "review", outcome: "reject", text: "Rejected on review: the code is K7O" }] });
const asked = (c: Claim): Claim => ({
  ...c,
  decision: "held",
  reasons: [...c.reasons, appealReason()],
  events: [...c.events, { at: "2026-11-07T10:05:00.000Z", type: "review_requested", detail: "The owner asked a person to look at the photos" }],
});

describe("uncertainRead", () => {
  it("offers a review where the model hedged on the code it rejected (c09: 'appears to read K7O')", () => {
    const c09 = evalClaim("c09");
    expect(c09.decision).toBe("rejected");
    expect(uncertainRead(c09)).toBe(true);
    expect(canAskForReview(c09)).toBe(true);
  });

  it("never on a confident rejection: the wrong-code sample (c11) and a photo of a screen (c10)", () => {
    for (const prefix of ["c11", "c10"]) {
      const c = evalClaim(prefix);
      expect(c.decision).toBe("rejected");
      expect(uncertainRead(c)).toBe(false);
    }
  });

  it("never on a claim that isn't rejected by the rule's model checks", () => {
    expect(canAskForReview(evalClaim("c02"))).toBe(false);
    const hedged = evalClaim("c09");
    expect(canAskForReview({ ...hedged, decision: "blocked" })).toBe(false);
    // A hard rule, even beside an unsure read.
    const duplicate: Reason = { check: "duplicate_photo", outcome: "reject", text: "Photo 1 was already used in another claim" };
    expect(canAskForReview({ ...hedged, reasons: [...hedged.reasons, duplicate] })).toBe(false);
    expect(canAskForReview(reviewRejected(hedged))).toBe(false);
  });

  it("counts an unclear label or code, and a code the model said matches but read otherwise", () => {
    const base = evalClaim("c11");
    const step: Reason = { check: "step_1", outcome: "reject", text: "Not done: cut in half" };
    const unclearLabel = { ...base, reasons: [{ check: "label", outcome: "hold", text: "Couldn't read the label clearly" } as Reason, step] };
    expect(uncertainRead(unclearLabel)).toBe(true);
    const v = base.verdict!;
    const contradicted = { ...base, verdict: { ...v, challenge_code: { ...v.challenge_code, matches: "yes" as const } } };
    expect(uncertainRead(contradicted)).toBe(true);
  });

  it("is offered once, and never on the judges' demo samples or seeded claims", () => {
    const c09 = evalClaim("c09");
    expect(canAskForReview(asked(c09))).toBe(false);
    expect(canAskForReview({ ...c09, demo: true })).toBe(false);
    expect(canAskForReview({ ...c09, seeded: true })).toBe(false);
  });
});

describe("a claim the owner asked a person to look at", () => {
  const recall = { ...sampleRecall(), spec: DEMO_SPEC, refund: { value: "29.99", currency: "USD" as const }, autoPay: true };
  const claim = asked(evalClaim("c09", { photos: [{ key: "k/1.jpg", hash: "0123456789abcdef" }] }));

  it("leads the console's grid row with the owner's ask, and keeps it off the evidence barcode", () => {
    const row = toRow(summarize(claim), recall);
    expect(row.decision).toBe("held");
    expect(row.reason).toBe("Owner asked for a review");
    expect(barsOf(summarize(claim), recall)?.some((b) => b.id === "appeal")).toBe(false);
  });

  it("says in the evidence panel when it was asked and what the rule decided", () => {
    const drawer = toDrawerClaim(claim, recall);
    expect(drawer.appealedAt).toBe("2026-11-07T10:05:00.000Z");
    expect(drawer.checks.some((c) => c.id === "appeal")).toBe(false);
    expect(decisionSentence(claim, recall)).toBe(
      "The rule refused it (written code reads K7O; this claim's code is K7Q), and the owner asked for a review, so a person decides: approve sends the $29.99 refund, reject keeps it refused.",
    );
    expect(toDrawerClaim(evalClaim("c09"), recall).appealedAt).toBeNull();
  });

  it("shows the owner the rule's reasons while held, and a person's refusal once refused", () => {
    expect(decidingReasons(claim).map((r) => r.check)).toEqual(["code"]);
    const refused = reviewRejected(claim);
    expect(decidingReasons(refused).map((r) => r.check)).toEqual(["review"]);
    expect(decidingReason(refused)?.check).toBe("review");
  });
});
