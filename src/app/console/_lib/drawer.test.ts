import { describe, expect, it, vi } from "vitest";
import { sampleClaim } from "@/lib/__fixtures__/claim";
import { buildSeedClaims, SEED_PHOTOS } from "@/lib/demo/seed";
import { demoRecall } from "@/lib/demo/kikea";
import { summarize } from "@/lib/store/store";
import { DEMO_SPEC } from "@/lib/demo/kikea";
import { duplicateFor, toDrawerClaim } from "./drawer";

vi.mock("server-only", () => ({}));
const { copiedFrom } = await import("./queue");

describe("duplicateFor", () => {
  it("opens the claim a seeded repost names, with the photo it copied", () => {
    const hashes = Object.fromEntries(SEED_PHOTOS.map((p, i) => [p, (i + 1).toString(16).padStart(16, "0")]));
    const claims = buildSeedClaims({ recall: demoRecall(new Date("2026-11-04T12:00:00Z")), now: new Date("2026-11-07T12:00:00Z"), hashes });
    const repost = claims.find((c) => c.reasons.some((r) => r.check === "duplicate_photo"))!;
    const named = repost.reasons.find((r) => r.check === "duplicate_photo")!.text.match(/RM-\d{4}/)![0];
    expect(duplicateFor(repost, claims.map(summarize))).toEqual({ photo: 1, id: named, theirs: 1, of: claims.find((c) => c.id === named)!.photos.length, src: null });
  });

  it("names the same earlier claim in the queue's line and the panel when two demo rounds repost the genuine photo", () => {
    const photo = [{ key: "x/1.jpg", hash: "0123456789abcdef" }];
    const demo = (id: string, round: string, sample: string, at: string, decision: "paid" | "blocked") =>
      sampleClaim({
        id,
        demo: true,
        demoRound: round,
        payerId: "SHAREDJUDGE1",
        decision,
        createdAt: at,
        photos: photo,
        events: [{ at, type: "demo_sample", detail: sample }],
        reasons: decision === "blocked" ? [{ check: "duplicate_photo", outcome: "reject", text: "Photo 1 was already used in another claim" }] : [],
      });
    const claims = [
      demo("RM-0001", "round-a", "genuine", "2026-11-08T16:41:00.000Z", "paid"),
      demo("RM-0002", "round-a", "repost", "2026-11-08T16:44:00.000Z", "blocked"),
      demo("RM-0003", "round-b", "genuine", "2026-11-09T01:05:00.000Z", "paid"),
      demo("RM-0004", "round-b", "repost", "2026-11-09T01:08:00.000Z", "blocked"),
    ];
    const rows = claims.map(summarize);
    for (const [repost, earlier] of [
      ["RM-0002", "RM-0001"],
      ["RM-0004", "RM-0003"],
    ]) {
      const claim = claims.find((c) => c.id === repost)!;
      expect(copiedFrom(rows.find((r) => r.id === repost)!, rows)).toBe(earlier);
      expect(duplicateFor(claim, rows)?.id).toBe(earlier);
    }
  });

  it("lists the five checks the owner saw, by the owner's names, with a demo claim's account check skipped", () => {
    const at = "2026-11-09T01:05:00.000Z";
    const claim = sampleClaim({
      demo: true,
      code: "K7P",
      decision: "rejected",
      events: [{ at, type: "demo_sample", detail: "wrong-code" }],
      reasons: [
        { check: "label", outcome: "pass", text: "The tag reads X-VESOLJE" },
        { check: "code", outcome: "reject", text: "The tag reads K7Q; this claim's code is K7P" },
        ...DEMO_SPEC.proof_steps.map((_, i) => ({ check: `step_${i + 1}`, outcome: "pass" as const, text: "Done" })),
        { check: "screen", outcome: "pass", text: "A real photo" },
      ],
      verdict: {
        label: { text_seen: "X-VESOLJE K7Q", matches_recalled_product: "yes", evidence: "Tag reads X-VESOLJE" },
        steps: DEMO_SPEC.proof_steps.map((step) => ({ step, status: "done" as const, evidence: "Cut through" })),
        challenge_code: { text_seen: "K7Q", matches: "no", evidence: "Reads K7Q" },
        same_item_in_all_photos: "yes",
        looks_like_photo_of_screen_or_print: "no",
        summary: "However, the handwritten one-time code does not match, so the proof does not satisfy all requirements.",
      },
    });
    const d = toDrawerClaim(claim, demoRecall(new Date("2026-11-04T12:00:00Z")));
    expect(d.fiveRows.map((r) => [r.name, r.state])).toEqual([
      ["Taken in Remedy's camera", "pass"],
      ["Photo not used before", "pass"],
      ["One claim per PayPal account", "skipped"],
      ["Tag shows X-VESOLJE and K7P", "reject"],
      ["Pillow cut in half", "pass"],
    ]);
    expect(d.fiveRows[2].note).toBe("Counted once, on the genuine claim.");
    expect(d.five).toBe("3 of 5 checks passed · 1 failed · 1 not run");
    // The photo's name is built from what the checks read, never the photo check's prose.
    expect(d.photoAlt).toBe("Claim photo: pillow cut in half, tag reads X-VESOLJE K7Q");
  });
});
