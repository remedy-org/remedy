import { describe, expect, it } from "vitest";
import { checkOf, fiveSummary } from "./fiveChecks";

const pre = (account: "pass" | "skipped" = "pass") => [
  { id: "session", state: "pass" as const },
  { id: "duplicate_photo", state: "pass" as const },
  { id: "account", state: account },
];
const model = (over: Record<string, "pass" | "reject" | "hold"> = {}) =>
  ["label", "step_1", "code", "screen"].map((id) => ({ id, state: over[id] ?? ("pass" as const) }));

describe("the five checks", () => {
  it("groups every recorded check under the homepage's five, and leaves process holds out", () => {
    expect(["session", "duplicate_photo", "payer", "payer_verified", "label", "code", "step_2", "same_item", "screen"].map(checkOf)).toEqual([1, 2, 3, 3, 4, 4, 5, 5, 5]);
    expect(checkOf("model")).toBeNull();
    expect(checkOf("payout")).toBeNull();
  });

  it("counts a paid claim's answers as five checks, not one per model question", () => {
    expect(fiveSummary([...pre(), ...model(), { id: "payout", state: "pass" }])).toBe("5 of 5 checks passed");
  });

  it("says in full what failed on a refused claim, and what didn't run", () => {
    expect(fiveSummary([...pre(), ...model({ code: "reject" })])).toBe("1 of 5 failed: the code · 4 passed");
    expect(fiveSummary([...pre("skipped"), ...model({ code: "reject" })])).toBe("1 of 5 failed: the code · 3 passed · 1 not run");
    expect(fiveSummary([...pre(), ...model({ label: "reject", code: "reject" })])).toBe("1 of 5 failed: the label and the code · 4 passed");
  });

  it("says the photo check never ran when a check without AI stopped the claim", () => {
    const blocked = [{ id: "session", state: "blocked" as const }, { id: "duplicate_photo", state: "pass" as const }, { id: "account", state: "skipped" as const }];
    expect(fiveSummary(blocked)).toBe("1 of 5 failed: the live camera · 1 passed · 3 not run");
  });

  it("names a held check, and words open checks as the caller asks", () => {
    expect(fiveSummary([...pre(), ...model({ screen: "hold" })])).toBe("1 of 5 held: a real photo · 4 passed");
    expect(fiveSummary([...pre(), ...model().map((m) => ({ ...m, state: "waiting" as const }))], { open: "waiting" })).toBe("3 of 5 passed · 2 waiting");
    expect(fiveSummary([], { open: "waiting" })).toBe("5 checks waiting");
  });

  it("counts a check as passed only when all of it ran", () => {
    // The console records one claim per account and a verified account apart; a demo sample skips the first.
    const console = [{ id: "session", state: "pass" as const }, { id: "duplicate_photo", state: "pass" as const }, { id: "payer", state: "skipped" as const }, { id: "payer_verified", state: "pass" as const }];
    expect(fiveSummary([...console, ...model({ code: "reject" })], { open: "waiting", skipped: "not run" })).toBe("1 of 5 failed: the code · 3 passed · 1 not run");
  });
});
