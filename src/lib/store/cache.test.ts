import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sampleClaim, sampleRecall } from "../__fixtures__/claim";
import { countingStore } from "../__fixtures__/counting";
import { withRecallCache } from "./cache";
import { localStore } from "./local";

let dir: string;
let clock: number;
let counter: ReturnType<typeof countingStore>;
const cached = () => withRecallCache(counter.store, { ttlMs: 60_000, now: () => clock });

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "remedy-cache-"));
  clock = 0;
  counter = countingStore(localStore(dir));
  await counter.store.putRecall(sampleRecall());
  counter.reset();
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("withRecallCache", () => {
  it("reads recalls once per TTL, and again after it", async () => {
    const store = cached();
    await store.listRecalls();
    await store.getRecall("27-071");
    clock = 59_999;
    await store.listRecalls();
    await store.getRecall("27-071");
    expect(counter.counts.reads).toBe(2);
    clock = 60_000;
    await store.getRecall("27-071");
    expect(counter.counts.reads).toBe(3);
  });

  it("reads fresh when asked, and keeps what it read", async () => {
    const store = cached();
    await store.getRecall("27-071");
    await counter.store.putRecall({ ...sampleRecall(), autoPay: false });
    expect((await store.getRecall("27-071"))?.autoPay).toBe(true);
    expect((await store.getRecall("27-071", { fresh: true }))?.autoPay).toBe(false);
    expect((await store.getRecall("27-071"))?.autoPay).toBe(false);
  });

  it("forgets a recall this instance saves", async () => {
    const store = cached();
    await store.listRecalls();
    await store.getRecall("27-071");
    await store.putRecall({ ...sampleRecall(), autoPay: false, title: "Renamed" });
    expect((await store.getRecall("27-071"))?.autoPay).toBe(false);
    expect((await store.listRecalls())[0].title).toBe("Renamed");
  });

  it("never keeps a missing recall, nor hands out the cached copy itself", async () => {
    const store = cached();
    expect(await store.getRecall("27-100")).toBeNull();
    await counter.store.putRecall({ ...sampleRecall(), id: "27-100", slug: "other" });
    expect(await store.getRecall("27-100")).not.toBeNull();
    const first = (await store.getRecall("27-071"))!;
    first.refund = { value: "1.00", currency: "USD" };
    expect((await store.getRecall("27-071"))?.refund.value).toBe("29.99");
  });

  it("passes claims straight through", async () => {
    const store = cached();
    await store.putClaim(sampleClaim());
    counter.reset();
    await store.getClaim("RM-0412");
    await store.getClaim("RM-0412");
    await store.listClaims();
    expect(counter.counts.calls).toEqual({ getClaim: 2, listClaims: 1 });
  });
});
