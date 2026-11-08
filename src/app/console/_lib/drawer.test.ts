import { describe, expect, it } from "vitest";
import { buildSeedClaims, SEED_PHOTOS } from "@/lib/demo/seed";
import { demoRecall } from "@/lib/demo/kikea";
import { summarize } from "@/lib/store/store";
import { duplicateFor } from "./drawer";

describe("duplicateFor", () => {
  it("opens the claim a seeded repost names, with the photo it copied", () => {
    const hashes = Object.fromEntries(SEED_PHOTOS.map((p, i) => [p, (i + 1).toString(16).padStart(16, "0")]));
    const claims = buildSeedClaims({ recall: demoRecall(new Date("2026-11-04T12:00:00Z")), now: new Date("2026-11-07T12:00:00Z"), hashes });
    const repost = claims.find((c) => c.reasons.some((r) => r.check === "duplicate_photo"))!;
    const named = repost.reasons.find((r) => r.check === "duplicate_photo")!.text.match(/RM-\d{4}/)![0];
    expect(duplicateFor(repost, claims.map(summarize))).toEqual({ photo: 1, id: named, theirs: 1, of: claims.find((c) => c.id === named)!.photos.length, src: null });
  });
});
