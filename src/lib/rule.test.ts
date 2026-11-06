import { describe, expect, it } from "vitest";
import { decide, preCheck, sendCheck, type OtherClaim } from "./rule";
import type { CheckSpec, Verdict } from "./types";

const pillow: CheckSpec = {
  recall: "Kikea Store X-VESOLJE nursing pillows (CPSC 27-071)",
  source: "https://www.cpsc.gov/Recalls/2027/kikea",
  product: "C-shaped nursing pillow",
  label_must_show: [],
  proof_steps: ["The pillow is cut fully in half, so it can no longer be used"],
};

const heater: CheckSpec = { ...pillow, label_must_show: ["model DR-HSH015"], proof_steps: ["The cord is cut", "The label is visible"] };

function verdict(overrides: Partial<Verdict> = {}, steps: Verdict["steps"][number]["status"][] = ["done"]): Verdict {
  return {
    label: { text_seen: null, matches_recalled_product: "yes", evidence: "" },
    steps: steps.map((status, i) => ({ step: `step ${i + 1}`, status, evidence: "" })),
    challenge_code: { text_seen: "K7Q", matches: "yes", evidence: "" },
    same_item_in_all_photos: "yes",
    looks_like_photo_of_screen_or_print: "no",
    summary: "",
    ...overrides,
  };
}

const run = (v: Verdict, opts: Partial<Parameters<typeof decide>[1]> = {}) => decide(v, { spec: pillow, code: "K7Q", photos: 2, ...opts });
const reason = (r: ReturnType<typeof decide>, check: string) => r.reasons.find((x) => x.check === check);

describe("decide", () => {
  it("passes a clean claim, with a reason per check", () => {
    const r = run(verdict());
    expect(r.outcome).toBe("pass");
    expect(r.reasons.map((x) => x.check)).toEqual(["label", "code", "same_item", "screen", "step_1"]);
    expect(r.reasons.every((x) => x.outcome === "pass")).toBe(true);
  });

  it("rejects a wrong code and says what was written", () => {
    const r = run(verdict({ challenge_code: { text_seen: "K7O", matches: "no", evidence: "" } }));
    expect(r.outcome).toBe("reject");
    expect(reason(r, "code")?.text).toBe("Written code reads K7O; this claim's code is K7Q");
  });

  it("rejects a missing code", () => {
    const r = run(verdict({ challenge_code: { text_seen: null, matches: "no", evidence: "" } }));
    expect(reason(r, "code")?.text).toBe("No code written in the photos; this claim's code is K7Q");
  });

  it("checks the code itself, not just the model's matches answer", () => {
    const wrong = run(verdict({ challenge_code: { text_seen: "K7P", matches: "yes", evidence: "" } }));
    expect(wrong.outcome).toBe("reject");
    expect(reason(wrong, "code")?.text).toBe("Written code reads K7P; this claim's code is K7Q");
    const unread = run(verdict({ challenge_code: { text_seen: null, matches: "yes", evidence: "" } }));
    expect(unread.outcome).toBe("hold");
    expect(reason(unread, "code")?.text).toBe("Couldn't read the written code clearly; this claim's code is K7Q");
    expect(run(verdict({ challenge_code: { text_seen: " k7 q", matches: "yes", evidence: "" } })).outcome).toBe("pass");
  });

  it("skips the code check when the claim has no code", () => {
    const r = run(verdict({ challenge_code: { text_seen: null, matches: "unclear", evidence: "" } }), { code: null });
    expect(r.outcome).toBe("pass");
    expect(reason(r, "code")).toBeUndefined();
  });

  it("rejects an undone step, naming it", () => {
    const r = run(verdict({}, ["not_done"]));
    expect(r.outcome).toBe("reject");
    expect(reason(r, "step_1")?.text).toBe("Not done: The pillow is cut fully in half, so it can no longer be used");
  });

  it("holds when it can't tell the photos show the same item", () => {
    const r = run(verdict({ same_item_in_all_photos: "unclear" }));
    expect(r.outcome).toBe("hold");
    expect(reason(r, "same_item")?.text).toBe("Couldn't tell if both photos show the same item");
  });

  it("ignores same-item with one photo, as the spike does", () => {
    expect(run(verdict({ same_item_in_all_photos: "unclear" }), { photos: 1 }).outcome).toBe("pass");
  });

  it("rejects a photo of a screen, holds an unsure one", () => {
    expect(run(verdict({ looks_like_photo_of_screen_or_print: "yes" })).outcome).toBe("reject");
    expect(run(verdict({ looks_like_photo_of_screen_or_print: "unclear" })).outcome).toBe("hold");
  });

  it("rejects over holds", () => {
    expect(run(verdict({ same_item_in_all_photos: "unclear" }, ["not_done"])).outcome).toBe("reject");
  });

  it("quotes a wrong label", () => {
    const r = run(verdict({ label: { text_seen: "X-VESOLIE", matches_recalled_product: "no", evidence: "" } }), { spec: heater });
    expect(reason(r, "label")?.text).toBe('Label doesn\'t match the recalled product (reads "X-VESOLIE")');
  });

  it("holds a spec step the model skipped", () => {
    const r = run(verdict({}, ["done"]), { spec: heater });
    expect(r.outcome).toBe("hold");
    expect(reason(r, "step_2")?.text).toBe("Couldn't confirm: The label is visible");
  });
});

describe("preCheck", () => {
  const now = new Date("2026-11-07T10:00:00Z");
  const claim = {
    id: "RM-0412",
    recallId: "27-071",
    payerId: "PAYER1",
    payerVerified: true,
    decision: "pending" as const,
    captureSession: { id: "cs_a", expiresAt: "2026-11-07T10:05:00Z" },
  };
  const other = (o: Partial<OtherClaim>): OtherClaim => ({ id: "RM-0001", recallId: "27-071", payerId: "PAYER2", decision: "paid", photoHashes: ["ffff0000ffff0000"], ...o });
  const check = (o: Partial<Parameters<typeof preCheck>[0]> = {}) => preCheck({ claim, sessionId: "cs_a", photoHashes: ["0123456789abcdef"], others: [], now, ...o });

  it("passes a fresh claim", () => {
    expect(check()).toEqual([]);
  });

  it("rejects an unknown or expired session", () => {
    expect(check({ sessionId: "cs_b" })[0]).toMatchObject({ check: "session", outcome: "reject" });
    expect(check({ claim: { ...claim, captureSession: null } })[0]?.check).toBe("session");
    expect(check({ now: new Date("2026-11-07T10:06:00Z") })[0]?.text).toMatch(/expired/);
  });

  it("rejects a photo already used in another claim, even re-encoded", () => {
    const r = check({ photoHashes: ["aaaa", "ffff0000ffff0001"].map((h) => h.padEnd(16, "0")), others: [other({})] });
    expect(r).toEqual([{ check: "duplicate_photo", outcome: "reject", text: "Photo 2 was already used in another claim" }]);
  });

  it("doesn't match a claim's photos against itself", () => {
    expect(check({ photoHashes: ["ffff0000ffff0000"], others: [other({ id: "RM-0412" })] })).toEqual([]);
  });

  it("rejects a payer with a paid or held claim on this recall", () => {
    expect(check({ others: [other({ payerId: "PAYER1", decision: "held", photoHashes: [] })] })[0]?.text).toBe(
      "This PayPal account already has a claim for this recall (RM-0001)",
    );
  });

  it("rejects a payer whose other claim for this recall is still with the model", () => {
    expect(check({ others: [other({ payerId: "PAYER1", decision: "pending" })] })).toEqual([
      { check: "payer", outcome: "reject", text: "This PayPal account already has a claim for this recall (RM-0001)" },
    ]);
  });

  it("lets a payer retry after a rejection, claim another recall, or past a claim with no photos yet", () => {
    expect(check({ others: [other({ payerId: "PAYER1", decision: "rejected", photoHashes: [] })] })).toEqual([]);
    expect(check({ others: [other({ payerId: "PAYER1", decision: "blocked", photoHashes: [] })] })).toEqual([]);
    expect(check({ others: [other({ payerId: "PAYER1", recallId: "27-054", photoHashes: [] })] })).toEqual([]);
    expect(check({ others: [other({ payerId: "PAYER1", decision: "pending", photoHashes: [] })] })).toEqual([]);
  });

  it("rejects an unverified PayPal account", () => {
    expect(check({ claim: { ...claim, payerVerified: false } })).toEqual([
      { check: "payer_verified", outcome: "reject", text: "This PayPal account isn't verified; verify it with PayPal, then claim again" },
    ]);
  });

  it("rejects photos sent again to a claim that was already decided", () => {
    expect(check({ claim: { ...claim, decision: "held" } })).toEqual([{ check: "state", outcome: "reject", text: "This claim is already held" }]);
  });
});

describe("sendCheck", () => {
  const claim = { id: "RM-0412", recallId: "27-071", payerId: "PAYER1", payerVerified: true, decision: "pending" as const, photos: [{ key: "RM-0412/1.jpg", hash: "0123456789abcdef" }] };
  const other = (o: Partial<OtherClaim>): OtherClaim => ({ id: "RM-0001", recallId: "27-071", payerId: "PAYER2", decision: "pending", photoHashes: ["ffff0000ffff0000"], ...o });

  it("sends when nothing changed during the model call", () => {
    expect(sendCheck({ claim, others: [other({}), { ...other({}), id: "RM-0412", payerId: "PAYER1", photoHashes: ["0123456789abcdef"] }] })).toEqual([]);
  });

  it("holds when a parallel claim by this payer got photos or was paid meanwhile", () => {
    expect(sendCheck({ claim, others: [other({ payerId: "PAYER1" })] })).toEqual([
      { check: "payer", outcome: "hold", text: "This PayPal account already has a claim for this recall (RM-0001)" },
    ]);
    expect(sendCheck({ claim, others: [other({ payerId: "PAYER1", decision: "paid", photoHashes: [] })] })[0]?.check).toBe("payer");
  });

  it("holds when a parallel claim used the same photo", () => {
    expect(sendCheck({ claim, others: [other({ photoHashes: ["0123456789abcdee"] })] })).toEqual([
      { check: "duplicate_photo", outcome: "hold", text: "Photo 1 was already used in another claim" },
    ]);
  });

  it("doesn't send a claim that is no longer pending, or an unverified payer", () => {
    expect(sendCheck({ claim: { ...claim, decision: "held" }, others: [] })).toEqual([{ check: "state", outcome: "hold", text: "This claim is already held" }]);
    expect(sendCheck({ claim: { ...claim, payerVerified: false }, others: [] })[0]?.check).toBe("payer_verified");
  });
});
