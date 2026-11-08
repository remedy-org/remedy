import { describe, expect, it } from "vitest";
import { nextTab, stateAt, STEPS } from "./tour-state";

const openId = "RM-9629";

describe("tour steps", () => {
  it("has at most one amber subject, and only on 02 at rest", () => {
    for (const step of STEPS) {
      for (const at of ["start", "final"] as const) {
        const { amber } = stateAt(step, at, { openId });
        if (step === 1 && at === "final") expect(amber).toBe(`${openId} row`);
        else expect(amber).toBeNull();
      }
    }
  });

  it("shows every step in its final state under reduced motion", () => {
    for (const step of STEPS) {
      expect(stateAt(step, "start", { openId, reduced: true })).toEqual(stateAt(step, "final", { openId }));
    }
  });

  it("says the test-money line on 01 to 03 only (the report sheet says it itself)", () => {
    expect(STEPS.map((s) => stateAt(s, "final", { openId }).money)).toEqual([true, true, true, false]);
  });

  it("starts 01 before the claim arrives and 02 before the held claim opens", () => {
    expect(stateAt(0, "start", { openId }).arrival).toBe("before");
    expect(stateAt(1, "start", { openId })).toMatchObject({ filter: "held", openId: null });
    expect(stateAt(1, "final", { openId })).toMatchObject({ filter: "held", openId });
  });

  it("credits Studio only when Studio is on screen", () => {
    expect(stateAt(2, "final", { openId }).credit).toBe("insightsStill");
    expect(stateAt(2, "final", { openId, studio: true }).credit).toBe("insights");
  });
});

describe("tablist keys", () => {
  it("wraps the arrows and jumps with Home and End", () => {
    expect(nextTab("ArrowRight", 0)).toBe(1);
    expect(nextTab("ArrowRight", 3)).toBe(0);
    expect(nextTab("ArrowLeft", 0)).toBe(3);
    expect(nextTab("Home", 2)).toBe(0);
    expect(nextTab("End", 1)).toBe(3);
    expect(nextTab("Enter", 1)).toBeNull();
    expect(nextTab("Tab", 1)).toBeNull();
  });
});
