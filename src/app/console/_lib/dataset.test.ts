import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleClaim } from "@/lib/__fixtures__/claim";
import { countingStore } from "@/lib/__fixtures__/counting";
import { DEMO_CLAIMS } from "@/lib/demo/claims";
import { demoDataset } from "@/lib/demo/dataset";
import { withDemoRecall } from "@/lib/demo";
import { localStore } from "@/lib/store/local";
import { withDataset } from "./dataset";
import { approveClaim, rejectClaim } from "./review";
import { decideStarterRow } from "./starter";

vi.mock("server-only", () => ({}));

// The console reads the demo recall and its seven claims from memory, on any store: an empty one, or one an earlier
// seed wrote. Reading writes nothing, and a company's decision on the held claim is still its own (starter.ts).

let dir: string;
let counter: ReturnType<typeof countingStore>;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "remedy-dataset-"));
  counter = countingStore(localStore(dir));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const ids = DEMO_CLAIMS.map((d) => d.id);

describe("the console's store", () => {
  it("opens the demo recall, its seven claims and their photos on an empty store, writing nothing", async () => {
    const store = withDataset(withDemoRecall(counter.store));
    expect((await store.listRecalls()).map((r) => r.id)).toEqual(["27-071"]);
    expect(await store.getRecall("27-071")).toEqual(demoDataset().recall);
    expect((await store.listClaims()).map((r) => r.id)).toEqual(ids);
    for (const id of ids) expect((await store.getClaim(id))?.id).toBe(id);
    const photo = await store.getPhoto("seed/c02-1.jpg");
    expect(photo?.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    // A key outside the dataset's photos never reaches public/: it goes to the store, which refuses a path.
    expect(await store.getPhoto("seed/not-a-demo-photo.jpg")).toBeNull();
    await expect(store.getPhoto("seed/../../package.json")).rejects.toThrow();
    expect(counter.counts.writes).toBe(0);
  });

  it("leaves out and never opens an earlier seed's claims, and the dataset wins an id a stored claim holds", async () => {
    await counter.store.putClaim(sampleClaim({ id: "RM-7001", seeded: true }));
    await counter.store.putClaim(sampleClaim({ id: "RM-0442", code: "ZZZ" }));
    counter.reset();
    const store = withDataset(counter.store);
    expect((await store.listClaims()).map((r) => r.id)).toEqual(ids);
    expect(await store.getClaim("RM-7001")).toBeNull();
    expect((await store.getClaim("RM-0442"))?.code).toBe("M4T");
    await expect(store.updateClaim("RM-0442", (c) => c)).rejects.toThrow();
    expect(counter.counts.writes).toBe(0);
  });

  it("keeps a company's approve or reject on the held claim in its browser, never the store", async () => {
    const store = withDataset(withDemoRecall(counter.store));
    const recall = (await store.getRecall("27-071"))!;
    const held = (await store.getClaim("RM-9629"))!;
    expect(held.decision).toBe("held");

    const approved = await approveClaim({ store, claim: held, recall, by: "Kikea Store", pay: vi.fn() });
    expect(approved).toMatchObject({ ok: true, starter: { k: "approve" }, claim: { decision: "paid", payout: null } });
    const rejected = await rejectClaim({ store, claim: held, recall, by: "Kikea Store", reason: "The tag is not on the cut pillow" });
    expect(rejected).toMatchObject({ ok: true, starter: { k: "reject" }, claim: { decision: "rejected" } });
    expect(counter.counts.writes).toBe(0);

    // The row as this company decided it: Approved (nothing sent), never Paid.
    const row = (await store.listClaims()).find((r) => r.id === "RM-9629")!;
    const decided = decideStarterRow(row, approved.ok ? approved.starter : undefined, recall);
    expect(decided).toMatchObject({ decision: "paid", payoutStatus: null });
  });
});
