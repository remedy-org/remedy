import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { sampleClaim } from "@/lib/__fixtures__/claim";
import { demoSample } from "@/lib/demo/samples";
import type { Claim } from "@/lib/types";
import { DemoRunEvidence } from "./DemoRunEvidence";

const at = "2026-11-11T09:17:23.456Z";
const event = (type: string, detail: string) => ({ type, detail, at });
const show = (overrides: Partial<Claim>, sample = "genuine") => renderToStaticMarkup(createElement(DemoRunEvidence, {
  claim: sampleClaim({ demo: true, code: "M4T", ...overrides }),
  sample: demoSample(sample)!,
}));

describe("the demo result's run record", () => {
  it("shows this attempt's model, duration and exact event time, with prepared-input limits", () => {
    const html = show({ id: "RM-1234", decision: "paid", events: [event("photos_received", "1 photo from the demo"), event("prechecked", "Sent in the camera session, new photos"), event("checked", "Photo check answered in 12.7 s (gpt-6.1-sol)")] });
    expect(html).toContain("A new photo-model response was saved for this claim.");
    expect(html).toContain("RM-1234");
    expect(html).toContain("Photo check answered in 12.7 s (gpt-6.1-sol)");
    expect(html).toContain(at);
    expect(html).toContain("Sent in the camera session, new photos");
    expect(html).toContain("Prepared AI-made photo.");
    expect(html).toContain("is fixed for this prepared sample");
    expect(html).toContain("camera-session condition is simulated");
    expect(html).toContain("compare only genuine claims");
    expect(html).toContain("Reloading shows this claim’s saved result");
  });

  it.each(["gpt-6.1-sol, recorded answer", "no model call"])("identifies local replay (%s), without claiming a new response", (model) => {
    const html = show({ decision: "held", events: [event("checked", `Photo check answered in 2.1 s (${model})`)] });
    expect(html).toContain("Local replay:");
    expect(html).toContain(model);
    expect(html).not.toContain("A new photo-model response");
  });

  it("says the model never ran only when a pre-check blocked the claim", () => {
    const html = show({ decision: "blocked", events: [event("blocked", "Blocked before the photo check: This photo wasn't sent in this claim's camera session")] }, "ai-no-session");
    expect(html).toContain("before the photo model ran");
    expect(html).toContain("Not run: stopped by a pre-check.");
    expect(html).toContain("deliberately mismatched");
    expect(html).toContain("one-claim-per-account rule is skipped");
  });

  it("does not mistake a failed or timed-out call for a model that never ran", () => {
    const html = show({ decision: "held", events: [] });
    expect(html).toContain("No photo-model response was recorded");
    expect(html).not.toContain("before the photo model ran");
    expect(html).not.toContain("A new photo-model response");
  });

  it("reads the returned code and evidence from this claim, rather than the sample's expected answer", () => {
    const html = show({
      decision: "rejected",
      events: [event("checked", "Photo check answered in 9.3 s (gpt-6.1-sol)")],
      verdict: {
        label: { text_seen: "X-VESOLJE", matches_recalled_product: "yes", evidence: "The product tag is readable." },
        challenge_code: { text_seen: "N4X", matches: "no", evidence: "The third character is X." },
        steps: [],
        same_item_in_all_photos: "yes",
        looks_like_photo_of_screen_or_print: "no",
        summary: "The code differs.",
      },
    });
    expect(html).toContain("N4X");
    expect(html).toContain("The third character is X.");
    expect(html).toContain("9.3 s");
  });

  it("never presents the illustrated console history as this attempt's evidence", () => {
    expect(show({ seeded: true, decision: "paid", events: [event("checked", "Photo check answered in 12.7 s")] })).toBe("");
  });
});
