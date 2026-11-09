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
