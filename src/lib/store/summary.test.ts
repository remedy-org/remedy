import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sampleClaim } from "../__fixtures__/claim";
import { localStore } from "./local";
import { summarize } from "./store";

// The index row carries what the console's evidence cells need (code, checks, times, photo keys), so the grid never
// opens a claim file per row.

const paid = sampleClaim({
  id: "RM-0442",
  code: "M4T",
  decision: "paid",
  photos: [
    { key: "uuid-1/1.jpg", hash: "0123456789abcdef" },
    { key: "uuid-1/2.jpg", hash: "fedcba9876543210" },
  ],
  reasons: [
    { check: "label", outcome: "pass", text: "Label matches" },
    { check: "code", outcome: "pass", text: "Written code reads M4T" },
    { check: "state", outcome: "hold", text: "This claim is already paid" },
  ],
  payout: { batchId: "B1", status: "SUCCESS", updatedAt: "2026-11-07T10:00:41.000Z" },
  events: [
    { at: "2026-11-07T10:00:00.000Z", type: "created", detail: "Logged in" },
    { at: "2026-11-07T10:00:20.000Z", type: "photos_received", detail: "2 photos" },
    { at: "2026-11-07T10:00:33.000Z", type: "checked", detail: "Photo check answered" },
    { at: "2026-11-07T10:00:34.000Z", type: "decided", detail: "Every check passed" },
    { at: "2026-11-07T10:00:35.000Z", type: "payout_sent", detail: "Payout sent" },
    { at: "2026-11-07T10:00:41.000Z", type: "payout_updated", detail: "PayPal: PENDING" },
    { at: "2026-11-07T10:01:02.000Z", type: "payout_updated", detail: "PayPal: SUCCESS" },
  ],
});

describe("summarize", () => {
  it("carries the code, each check's outcome, the money's times and the photo keys", () => {
    expect(summarize(paid)).toMatchObject({
      code: "M4T",
      // "state" isn't a check of the claim: it says the claim was already decided.
      checks: [
        { check: "label", outcome: "pass" },
        { check: "code", outcome: "pass" },
      ],
      times: {
        photos: "2026-11-07T10:00:20.000Z",
        answered: "2026-11-07T10:00:33.000Z",
        decided: "2026-11-07T10:00:34.000Z",
        sent: "2026-11-07T10:00:35.000Z",
        // The SUCCESS, not the first status update.
        settled: "2026-11-07T10:01:02.000Z",
      },
      photoKeys: ["uuid-1/1.jpg", "uuid-1/2.jpg"],
    });
  });

  it("leaves out steps that haven't happened", () => {
    expect(summarize(sampleClaim({ photos: [] }))).toMatchObject({ checks: [], times: {}, photoKeys: [] });
    const blocked = summarize(sampleClaim({ decision: "blocked", events: [{ at: "2026-11-07T10:00:05.000Z", type: "photos_received", detail: "" }, { at: "2026-11-07T10:00:05.400Z", type: "blocked", detail: "" }] }));
    expect(blocked.times).toEqual({ photos: "2026-11-07T10:00:05.000Z", decided: "2026-11-07T10:00:05.400Z" });
  });
});

describe("rows written before the evidence fields", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "remedy-summary-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("are filled from their claim files once and saved back", async () => {
    const inner = localStore(dir);
    await inner.putClaim(paid);
    await inner.putClaim(sampleClaim({ id: "RM-0999" }));
    // Strip the new fields, as an index written by the build before them would have it; RM-0999's file is gone.
    const file = join(dir, "index.json");
    const index = JSON.parse(await readFile(file, "utf8"));
    for (const row of index.claims) for (const k of ["code", "checks", "times", "photoKeys"]) delete row[k];
    await writeFile(file, JSON.stringify(index));
    await rm(join(dir, "claims", "RM-0999.json"));

    const rows = await inner.listClaims();
    expect(rows.find((r) => r.id === "RM-0442")).toMatchObject({ code: "M4T", photoKeys: ["uuid-1/1.jpg", "uuid-1/2.jpg"] });
    // A row whose file is gone keeps what it had, with empty evidence, and isn't read again.
    expect(rows.find((r) => r.id === "RM-0999")).toMatchObject({ checks: [], times: {}, photoKeys: [] });
    // Saved back in one index write, so the next listing reads index.json alone.
    const saved = JSON.parse(await readFile(file, "utf8")).claims;
    expect(saved.every((r: Record<string, unknown>) => Array.isArray(r.checks))).toBe(true);
  });
});
