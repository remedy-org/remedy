import { describe, expect, it } from "vitest";
import { sampleClaim, sampleRecall } from "@/lib/__fixtures__/claim";
import { summarize } from "@/lib/store/store";
import type { Claim } from "@/lib/types";
import { decideStarter, decideStarterRow, encodeDecisions, parseDecisions, withDecisions, type StarterDecision } from "./starter";
import { toRow } from "./view";

const recall = sampleRecall();
const held: Claim = sampleClaim({ decision: "held", seeded: true, reasons: [{ check: "same_item", outcome: "hold", text: "Couldn't tell if both photos show the same item" }] });
const approve: StarterDecision = { k: "approve", at: "2026-11-08T22:08:58.000Z", by: "Kikea Store" };
const reject: StarterDecision = { k: "reject", at: "2026-11-08T22:09:30.000Z", by: "Kikea Store", r: "The two photos don't show the same pillow" };

describe("a company's decisions on starter claims", () => {
  it("round-trips through the cookie, for that company only", () => {
    const raw = encodeDecisions("COMPANY00001", { "RM-0412": approve });
    expect(parseDecisions(raw, "COMPANY00001")).toEqual({ "RM-0412": approve });
    expect(parseDecisions(raw, "COMPANY00002")).toEqual({});
    expect(parseDecisions("not-a-cookie", "COMPANY00001")).toEqual({});
    expect(parseDecisions(undefined, "COMPANY00001")).toEqual({});
  });

  it("decides a held starter claim as the company did, and leaves every other claim as it is", () => {
    // Approved with nothing sent through PayPal: it reads Approved, never Paid.
    const approved = decideStarter(held, approve);
    expect(approved).toMatchObject({ decision: "paid", payout: null });
    expect(approved.events.at(-1)?.type).toBe("approved");
    expect(approved.events.some((e) => e.type === "payout_sent")).toBe(false);
    expect(decideStarter(held, reject)).toMatchObject({ decision: "rejected", reasons: expect.arrayContaining([{ check: "review", outcome: "reject", text: "Rejected on review: The two photos don't show the same pillow" }]) });
    const real = { ...held, seeded: undefined };
    expect(decideStarter(real, approve)).toBe(real);
    expect(decideStarter(held, undefined)).toBe(held);
  });

  it("gives the index row what the decided claim's row says, keeping its version", () => {
    for (const d of [approve, reject]) {
      const fromRow = toRow(decideStarterRow(summarize(held), d, recall), recall);
      const fromClaim = toRow(summarize(decideStarter(held, d)), recall);
      const pick = (r: typeof fromRow) => [r.decision, r.reason, r.payoutStatus, r.amount, r.note, r.bars?.map((b) => b.state).join(), r.timeline?.end];
      expect(pick(fromRow)).toEqual(pick(fromClaim));
      expect(decideStarterRow(summarize(held), d, recall).version).toBe(summarize(held).version);
    }
    const rows = [summarize(held), summarize({ ...held, id: "RM-0413" })];
    expect(withDecisions(rows, { "RM-0413": reject }, recall).map((r) => r.decision)).toEqual(["held", "rejected"]);
  });
});
