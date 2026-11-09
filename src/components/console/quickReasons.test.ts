import { describe, expect, it } from "vitest";
import { quickReasons, sharedQuickReasons } from "./quickReasons";

const checks = (states: Record<string, string>) => Object.entries(states).map(([id, state]) => ({ id, state }));

describe("quick reasons", () => {
  it("lead with what held the claim, and never offer one a passed check contradicts", () => {
    const sameItem = quickReasons(checks({ session: "pass", label: "pass", code: "pass", same_item: "hold", screen: "pass", step_1: "pass", step_2: "pass" }));
    expect(sameItem.map((q) => q.label)).toEqual(["Not the same item"]);
    expect(sameItem[0].text("R8D")).toBe("The two photos don't show the same product. Take both photos of one product in a new claim.");
  });

  it("offer the general reasons when the photo check never answered, numbered as they remain", () => {
    expect(quickReasons(checks({ label: "waiting", code: "waiting", step_1: "waiting" })).map((q) => q.label)).toEqual(["Wrong code", "No tag", "Not destroyed", "Wrong product"]);
    expect(quickReasons(checks({ label: "pass", code: "reject", step_1: "pass" })).map((q) => q.label)).toEqual(["Wrong code"]);
    expect(quickReasons(checks({ label: "pass", code: "pass", step_1: "hold" })).map((q) => q.label)).toEqual(["Not destroyed"]);
  });

  it("give a pick only the reasons every claim in it can take", () => {
    const a = checks({ label: "pass", code: "pass", same_item: "hold", step_1: "pass" });
    const b = checks({ label: "waiting", code: "waiting", step_1: "waiting" });
    expect(sharedQuickReasons([a, b]).map((q) => q.label)).toEqual([]);
    expect(sharedQuickReasons([b, b]).map((q) => q.label)).toEqual(["Wrong code", "No tag", "Not destroyed", "Wrong product"]);
  });
});
