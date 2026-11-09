import { describe, expect, it, vi } from "vitest";
import { toDrawerClaim } from "@/app/console/_lib/drawer";
import { sampleClaim } from "@/lib/__fixtures__/claim";
import { demoDataset } from "@/lib/demo/dataset";
import { DEMO_SAMPLES, type DemoSample } from "@/lib/demo/samples";
import VERDICTS from "@/lib/demo/verdicts.json";
import { decide } from "@/lib/rule";
import type { Claim, Recall, Verdict } from "@/lib/types";
import { sixRows } from "./CheckList";
import { checkRows, cutInHalf, handWrittenLabel, nounOf } from "./model";

vi.mock("server-only", () => ({}));

// An owner and the company read one claim's five checks the same way: the owner's claim page (sixRows) files every
// recorded answer under the check the console's panel (drawer.ts fiveRowsOf) files it under, so each of the five has
// the same state on both. RM-9629's blurred tag, for one, holds "Tag shows X-VESOLJE and H9D" on both, and "Pillow cut in
// half" passes on both.

const KEYS = ["session", "duplicate", "account", "code", "destroyed"] as const;
// The owner's list marks a check that stopped the claim before the photo check as blocked; the console's panel as failed.
const same = (state: string) => (state === "blocked" ? "reject" : state);

function owner(claim: Claim, recall: Recall) {
  const spec = recall.spec;
  const rows = sixRows(checkRows(claim, spec), {
    code: claim.code,
    noun: nounOf(spec),
    cut: cutInHalf(spec),
    decided: claim.decision !== "pending",
    held: claim.decision === "held",
    demo: Boolean(claim.demo),
    photos: claim.photos.length,
    written: handWrittenLabel(spec),
    steps: spec.proof_steps,
  });
  return KEYS.map((k) => same(rows.find((r) => r.key === k)!.state));
}

const company = (claim: Claim, recall: Recall) => toDrawerClaim(claim, recall).fiveRows.map((r) => same(r.state));

/** A /try sample as the pipeline leaves it: the photo check's recorded answer through the rule, or blocked before it. */
function sampleOf(s: DemoSample, recall: Recall): Claim {
  const code = s.code ?? "M4T";
  const base = sampleClaim({ id: `RM-${s.id}`, code, demo: true, recallId: recall.id, events: [{ at: "2026-11-08T10:00:00.000Z", type: "demo_sample", detail: s.id }] });
  if (s.expect === "blocked") return { ...base, decision: "blocked", reasons: [{ check: s.decidedBy, outcome: "reject", text: "Stopped before the photo check" }] };
  const answer = (VERDICTS as { case: string; verdict: unknown }[]).find((v) => v.case === s.source);
  if (!answer) throw new Error(`No recorded answer for ${s.source}`);
  const verdict = answer.verdict as Verdict;
  const { outcome, reasons } = decide(verdict, { spec: recall.spec, code, photos: s.photos.length });
  return { ...base, verdict, reasons, decision: outcome === "pass" ? "paid" : outcome === "hold" ? "held" : "rejected" };
}

describe("the owner's five checks and the console's", () => {
  const { recall, claims } = demoDataset();

  it.each(claims.map((c) => [c.id, c] as const))("group %s's answers the same way", (_, claim) => {
    expect(owner(claim, recall)).toEqual(company(claim, recall));
  });

  it.each(DEMO_SAMPLES.map((s) => [s.id, s] as const))("group the /try sample %s's answers the same way", (_, s) => {
    const claim = sampleOf(s, recall);
    expect(owner(claim, recall)).toEqual(company(claim, recall));
  });

  it("hold RM-9629's tag check on both, and pass its cut on both", () => {
    const claim = claims.find((c) => c.id === "RM-9629")!;
    expect(owner(claim, recall)).toEqual(["pass", "pass", "pass", "hold", "pass"]);
    expect(company(claim, recall)).toEqual(["pass", "pass", "pass", "hold", "pass"]);
  });
});
