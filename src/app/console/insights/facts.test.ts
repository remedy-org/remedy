import { describe, expect, it } from "vitest";
import { demoRecall } from "@/lib/demo/kikea";
import { buildSeedClaims, SEED_PHOTOS } from "@/lib/demo/seed";
import { summarize } from "@/lib/store/store";
import type { Claim } from "@/lib/types";
import { buildReport } from "../_lib/report";
import { reasonSummary } from "@/components/insights/funnel";
import { buildInsights, claimFact, funnel, refusalLabel, STAGES } from "./facts";

const now = new Date("2026-11-07T12:00:00Z");
const hashes = Object.fromEntries(SEED_PHOTOS.map((p, i) => [p, (i + 1).toString(16).padStart(16, "0")]));
const recall = demoRecall(new Date("2026-11-04T12:00:00Z"));
const claims = buildSeedClaims({ recall, hashes });
const data = buildInsights(claims, recall, now);

describe("buildInsights", () => {
  it("has one row per claim, and agrees with the CPSC report on every count", () => {
    const report = buildReport(claims.map(summarize), recall);
    expect(data.claims).toHaveLength(claims.length);
    const sum = (k: "remedied" | "refused" | "held" | "amountPaid") => data.claims.reduce((n, c) => n + c[k], 0);
    expect(sum("remedied")).toBe(report.stats.remedied);
    expect(sum("held")).toBe(report.stats.held);
    expect(sum("refused")).toBe(report.stats.rejected + report.stats.blocked);
    expect(Math.round(sum("amountPaid") * 100)).toBe(report.stats.paidCents);
    const reasons = new Map<string, number>();
    for (const c of data.claims) if (c.refusalReason) reasons.set(c.refusalReason, (reasons.get(c.refusalReason) ?? 0) + 1);
    expect(Object.fromEntries(reasons)).toEqual(Object.fromEntries(report.refusals.map((r) => [r.reason, r.count])));
  });

  it("names no claim a starter or a sample, and never exposes a full payer id", () => {
    expect(data.claims.every((c) => c.source === "Owner")).toBe(true);
    for (const c of data.claims) expect(c.payer).toMatch(/^•••• .{4}$/);
    expect(JSON.stringify(data)).not.toContain(claims[0].payerId);
  });

  it("times a paid claim from its photos to the payout, and leaves the rest blank", () => {
    for (const c of data.claims) {
      // Only a claim PayPal paid has a payout to time; one approved with nothing sent has none.
      if (c.payoutStatus === "SUCCESS") expect(c.timeToPaySec).toBeGreaterThan(0);
      else expect(c.timeToPaySec).toBeNull();
    }
  });

  it("quotes the model's evidence verbatim in each dossier", () => {
    const withVerdict = claims.find((c) => c.verdict && c.decision === "held")!;
    const d = data.dossiers[withVerdict.id];
    expect(d.reviewable).toBe(true);
    expect(d.checks.find((k) => k.label === "Label")?.evidence).toBe(withVerdict.verdict!.label.evidence);
  });
});

describe("funnel", () => {
  it("only ever narrows, and each stage's stopped claims are the drop to the next", () => {
    const f = funnel(data.claims);
    expect(f.map((s) => s.stage)).toEqual([...STAGES]);
    expect(f[0].reached).toBe(claims.length);
    for (let i = 1; i < f.length; i++) {
      expect(f[i].reached).toBeLessThanOrEqual(f[i - 1].reached);
      expect(f[i - 1].reached - f[i].reached).toBe(f[i - 1].stopped);
    }
    expect(f.at(-1)!.reached).toBe(data.claims.filter((c) => c.payoutStatus === "SUCCESS").length);
  });

  it("names the reasons claims stopped at a stage, commonest first, with counts when they differ", () => {
    const rows = [
      { stage: "Passed the account checks" as const, stopReason: "Photo of a screen or a print", decision: "Rejected" },
      { stage: "Passed the account checks" as const, stopReason: "Photo of a screen or a print", decision: "Rejected" },
      { stage: "Passed the account checks" as const, stopReason: "Wrong or missing code on the tag", decision: "Rejected" },
      { stage: "Paid" as const, stopReason: null, decision: "Paid" },
    ];
    expect(funnel(rows)[2]).toEqual({
      stage: "Passed the account checks",
      reached: 4,
      stopped: 3,
      groups: [{ kind: "refused", count: 3, summary: "Photo of a screen or a print 2, Wrong or missing code on the tag 1" }],
    });
  });

  it("never presents a tied reason as the top one", () => {
    const tally = (...counts: [string, number][]) => new Map(counts);
    expect(reasonSummary(tally(["PayPal account not verified", 1], ["Photo already used in another claim", 1], ["Second claim from one PayPal account", 1], ["Photos sent outside the camera session", 1]))).toBe(
      "PayPal account not verified, Photo already used in another claim, Photos sent outside the camera session, Second claim from one PayPal account",
    );
    expect(reasonSummary(tally(["b", 3], ["a", 3], ["c", 1]))).toBe("a 3, b 3, c 1");
    expect(reasonSummary(tally(["Photos showed different items", 3]))).toBe("Photos showed different items");
  });

  it("counts held claims apart from refused ones", () => {
    const rows = [
      { stage: "Passed the account checks", stopReason: "Couldn't tell if both photos show the same item", decision: "Held", count: 3 },
      { stage: "Passed the account checks", stopReason: "Photo of a screen or a print", decision: "Rejected", count: 6 },
    ];
    const step = funnel(rows)[2];
    expect(step.stopped).toBe(9);
    expect(step.groups.map((g) => [g.kind, g.count])).toEqual([
      ["refused", 6],
      ["held", 3],
    ]);
  });
});

describe("claimFact", () => {
  const base = claims.find((c) => c.decision === "paid")!;
  it("stops a blocked claim at the pre-checks with the pre-check's reason", () => {
    const blocked: Claim = { ...base, decision: "blocked", payout: null, reasons: [{ check: "session", outcome: "reject", text: "x" }] };
    expect(claimFact(blocked, recall)).toMatchObject({ stage: "Photos sent", stopReason: "Photos sent outside the camera session", refused: 1, amountPaid: 0 });
  });
  it("marks a claim paid only after a person approved it, so its wait is named and not hidden in a median", () => {
    const approved: Claim = { ...base, seeded: false, reasons: [...base.reasons, { check: "review", outcome: "pass", text: "Approved on review by Kikea" }] };
    expect(claimFact(approved, recall).paidOnReview).toBe(1);
    expect(claimFact({ ...base, seeded: false }, recall).paidOnReview).toBe(0);
  });
  it("names the check the grid's drawer leads with, whatever order the checks were recorded in", () => {
    // Recorded label first, then code: the code decides (lib/reasonOrder.ts), as the drawer reads it.
    const rejected: Claim = {
      ...base,
      decision: "rejected",
      payout: null,
      reasons: [
        { check: "label", outcome: "reject", text: "x" },
        { check: "code", outcome: "reject", text: "y" },
      ],
    };
    expect(claimFact(rejected, recall)).toMatchObject({
      refusalReason: refusalLabel("code"),
      refusalGate: "Model reads",
      failedCheck: "code",
      stage: "Passed the account checks",
      stopReason: refusalLabel("code"),
    });
  });
  it("keeps a pre-check's refusal with the account checks, with no AI in it", () => {
    const blocked: Claim = {
      ...base,
      decision: "blocked",
      payout: null,
      reasons: [
        { check: "payer", outcome: "reject", text: "x" },
        { check: "code", outcome: "reject", text: "y" },
      ],
    };
    expect(claimFact(blocked, recall)).toMatchObject({ refusalReason: refusalLabel("payer"), refusalGate: "No AI", stage: "Photos sent" });
  });
  it("stops a claim with no photos at Filed", () => {
    const pending: Claim = { ...base, decision: "pending", photos: [], payout: null, reasons: [], verdict: null };
    expect(claimFact(pending, recall)).toMatchObject({ stage: "Filed", stopReason: "No photos yet", decision: "In progress" });
  });
});
