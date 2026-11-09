import { describe, expect, it } from "vitest";
import { byCheck, decidingCheck, inDecidingOrder } from "./reasonOrder";
import { decide, preCheck } from "./rule";
import type { CheckSpec, Outcome, Reason, Verdict } from "./types";

const spec: CheckSpec = {
  recall: "Kikea Store X-VESOLJE nursing pillows (CPSC 27-071)",
  source: "https://www.cpsc.gov/Recalls/2027/kikea",
  product: "C-shaped nursing pillow",
  label_must_show: ["X-VESOLJE"],
  proof_steps: ["The pillow is cut fully in half, so it can no longer be used", "The X-VESOLJE tag is on the cut pillow"],
};

type Tri = "yes" | "no" | "unclear";
type Step = "done" | "not_done" | "unclear";

function verdict({ label = "yes", code = "M4T", screen = "no", steps = ["done", "done"] }: { label?: Tri; code?: string; screen?: Tri; steps?: Step[] } = {}): Verdict {
  return {
    label: { text_seen: "X-VESOLJE", matches_recalled_product: label, evidence: "" },
    steps: steps.map((status, i) => ({ step: `step ${i + 1}`, status, evidence: "" })),
    challenge_code: { text_seen: code, matches: code === "M4T" ? "yes" : "no", evidence: "" },
    same_item_in_all_photos: "yes",
    looks_like_photo_of_screen_or_print: screen,
    summary: "",
  };
}

const run = (v: Verdict) => decide(v, { spec, code: "M4T", photos: 1 });
const ids = (rs: Pick<Reason, "check">[]) => rs.map((r) => r.check);

describe("reasons in deciding order", () => {
  // x06 in the 9 Nov test, a screenshot of the CPSC page: the code, the screen and both steps failed in every run, the
  // label in runs 2 and 3 only. Recorded as decide() writes them, run 1 led with the code and run 2 with the label.
  const run1 = run(verdict({ code: "H6N", screen: "yes", steps: ["not_done", "not_done"] }));
  const run2 = run(verdict({ label: "no", code: "H6N", screen: "yes", steps: ["not_done", "not_done"] }));

  it("leads with the same check in both runs of a photo whose label answer changed", () => {
    expect(run1.reasons.find((r) => r.outcome === "reject")?.check).not.toBe(run2.reasons.find((r) => r.outcome === "reject")?.check);
    expect(decidingCheck(run1.reasons)?.check).toBe("code");
    expect(decidingCheck(run2.reasons)?.check).toBe("code");
    expect(ids(inDecidingOrder(run1.reasons))).toEqual(ids(inDecidingOrder(run2.reasons)));
  });

  it("lists the code, then the label, the same item, the screen and each step in the notice's order", () => {
    expect(ids(inDecidingOrder(run2.reasons))).toEqual(["code", "label", "screen", "step_1", "step_2"]);
    const two = decide(verdict(), { spec, code: "M4T", photos: 2 });
    expect(ids(byCheck(two.reasons))).toEqual(["code", "label", "same_item", "screen", "step_1", "step_2"]);
  });

  it("puts the deciding check first even when a hold comes before it in check order", () => {
    // The code unreadable (a hold) and the pillow not cut (a reject): the claim is rejected on the cut.
    const r = run({ ...verdict({ steps: ["not_done", "done"] }), challenge_code: { text_seen: null, matches: "unclear", evidence: "" } });
    expect(r.outcome).toBe("reject");
    expect(ids(inDecidingOrder(r.reasons))).toEqual(["step_1", "code", "label", "screen", "step_2"]);
  });

  it("names the check decide() acts on, for every answer it can give", () => {
    const tri: Tri[] = ["yes", "no", "unclear"];
    const step: Step[] = ["done", "not_done", "unclear"];
    const codes = ["M4T", "M4I"];
    for (const label of tri)
      for (const screen of tri)
        for (const code of codes)
          for (const s1 of step)
            for (const s2 of step) {
              const { outcome, reasons } = run(verdict({ label, screen, code, steps: [s1, s2] }));
              const d = decidingCheck(reasons);
              expect(d?.outcome ?? "pass").toBe(outcome);
              // Ordering never adds, drops or changes a reason.
              expect([...inDecidingOrder(reasons)].sort((a, b) => a.check.localeCompare(b.check))).toEqual([...reasons].sort((a, b) => a.check.localeCompare(b.check)));
            }
  });

  it("keeps preCheck's order for the checks before the model", () => {
    const reasons = preCheck({
      claim: { id: "RM-1", recallId: "R-1", payerId: "P", payerVerified: false, decision: "pending", captureSession: null },
      sessionId: "s",
      photoHashes: ["0000000000000000"],
      others: [{ id: "RM-0", recallId: "R-1", payerId: "P", decision: "paid", photoHashes: ["0000000000000000"] }],
    });
    expect(ids(reasons)).toEqual(["session", "payer_verified", "duplicate_photo", "payer"]);
    expect(ids(inDecidingOrder(reasons))).toEqual(ids(reasons));
  });

  const r = (check: string, outcome: Outcome = "pass"): Reason => ({ check, outcome, text: check });

  it("sorts steps by number and leaves every other reason where it was recorded", () => {
    const reasons = [r("review"), r("step_10"), r("auto_pay", "hold"), r("step_2"), r("label"), r("payout", "hold")];
    expect(ids(byCheck(reasons))).toEqual(["review", "label", "auto_pay", "step_2", "step_10", "payout"]);
    expect(ids(inDecidingOrder(reasons))).toEqual(["auto_pay", "review", "label", "step_2", "step_10", "payout"]);
    expect(decidingCheck([r("label"), r("code")])).toBeNull();
  });

  it("keeps a held claim's first hold ahead of a conflict found on approve", () => {
    // Held because the model didn't answer; approve then found another claim from the account (review.ts appends it).
    expect(decidingCheck([r("model", "hold"), r("payer", "hold")])?.check).toBe("model");
    // Held on an unreadable code; the same conflict appended after the model's answers.
    const held = [r("label"), r("code", "hold"), r("screen"), r("step_1"), r("payer", "hold")];
    expect(decidingCheck(held)?.check).toBe("code");
  });
});
