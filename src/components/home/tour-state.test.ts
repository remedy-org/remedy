import { describe, expect, it } from "vitest";
import { stepSentences, TOUR } from "./tour-copy";
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

  it("starts 01 before the claim arrives and 02 before the held claim opens", () => {
    expect(stateAt(0, "start", { openId }).arrival).toBe("before");
    expect(stateAt(1, "start", { openId })).toMatchObject({ body: "claims", openId: null });
    expect(stateAt(1, "final", { openId })).toMatchObject({ body: "claims", openId });
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

describe("tour copy", () => {
  it("names the recall analyst on 03 only when a recorded answer is on screen", () => {
    expect(stepSentences(false)[2]).not.toMatch(/analyst/);
    expect(stepSentences(true)[2]).toMatch(/recall analyst/);
    expect(stepSentences(true).filter((s, i) => s !== TOUR.steps[i].sentence)).toHaveLength(1);
  });

  it("speaks as the product: no sample, sandbox, test or demo labels in any string", () => {
    const strings = JSON.stringify(TOUR) + stepSentences(true).join(" ");
    expect(strings).not.toMatch(/\b(samples?|sandbox|test|demo|never sent|no money moved|AI-made|exhibit)\b/i);
  });

  it("keeps library names out of the steps' sentences (the footer credits AG Grid and AG Studio)", () => {
    for (const s of stepSentences(true)) expect(s).not.toMatch(/AG Grid|AG Studio/);
  });

  it("says a refusal in the status tabs' own words: rejected or blocked", () => {
    expect(TOUR.steps[0].sentence).toMatch(/rejected or blocked/);
    expect(TOUR.steps[0].sentence).not.toMatch(/refused/);
  });
});
