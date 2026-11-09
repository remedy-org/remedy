import { describe, expect, it } from "vitest";
import { datasetClaim } from "@/lib/demo/dataset";
import { EXHIBIT, RECEIPT_ROWS } from "../teardown/claim";
import { CHAPTERS, CLAIM } from "./claim";

// RM-0442's two money steps as the console's timeline gives them: sent to PayPal, then PayPal's confirmation.
const since = (type: string) => {
  const c = datasetClaim(CLAIM.id)!;
  const at = (t: string) => Date.parse(c.events.find((e) => e.type === t)!.at);
  return (at(type) - at("photos_received")) / 1000;
};

describe("the homepage's payout times", () => {
  it("say sent and confirmed at the console's times", () => {
    expect([CLAIM.seconds, CLAIM.confirmed]).toEqual([since("payout_sent"), since("payout_updated")]);
    expect([EXHIBIT.seconds, EXHIBIT.confirmed]).toEqual([CLAIM.seconds, CLAIM.confirmed]);
  });

  it("never call the 15 s a payout landing", () => {
    const words = [...CHAPTERS.map((c) => c.text), ...RECEIPT_ROWS.map(([k, v]) => `${k} ${v}`)].join(" ");
    expect(words).not.toMatch(/paid[^.]*15 seconds|photo to payout/i);
    expect(words).toContain(`confirmed it at ${CLAIM.confirmed} s`);
  });
});

describe("chapter 01, the consent screen", () => {
  it("is the claim page's, word for word", async () => {
    const { CAPTURE_SESSION_MINUTES } = await import("@/lib/ids");
    const { consentLines } = await import("@/components/claim/consentCopy");
    const { demoRecall } = await import("@/lib/demo/kikea");
    const { CONSENT } = await import("./claim");
    expect(CLAIM.minutes).toBe(CAPTURE_SESSION_MINUTES);
    expect(CONSENT).toEqual(consentLines(demoRecall(), CAPTURE_SESSION_MINUTES));
    expect(CONSENT.title).toBe("$29.99 back for your X-VESOLJE Nursing Pillow");
    expect(CONSENT.clock).toBe("Your code is good for 10 minutes, so cut the pillow first.");
  });
});
