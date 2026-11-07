import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleClaim, sampleRecall } from "@/lib/__fixtures__/claim";
import { countingStore } from "@/lib/__fixtures__/counting";
import { getRecallBySlug, type Store } from "@/lib/store";
import { withRecallCache } from "@/lib/store/cache";
import { localStore } from "@/lib/store/local";
import { summarize } from "@/lib/store/store";
import type { Session } from "@/lib/session";
import type { Claim, Decision } from "@/lib/types";

// The Vercel Blob plan caps reads at 10,000 a month (docs/PRODUCT.md, "Blob budget"). These pin how many store reads
// each hot action costs, so a change that reads every claim again fails here first.

vi.mock("server-only", () => ({}));
let app: Store;
vi.mock("@/lib/demo", async (original) => ({ ...(await original<typeof import("@/lib/demo")>()), getAppStore: async () => app }));
const owner: Session = { role: "owner", payerId: "47KT8H23PUJ3Q", verified: true, name: null, email: null, iat: 0 };
const company: Session = { role: "company", payerId: "COMPANY00001", verified: true, name: null, email: null, iat: 0 };
vi.mock("@/lib/session", () => ({ getSession: async (role: string) => (role === "owner" ? owner : company) }));
// PayPal still says PENDING for the one unsettled payout: no network, and nothing to save.
vi.mock("@/lib/paypal/payouts", () => ({ getPayoutStatus: async (batchId: string) => ({ batchId, batchStatus: "PENDING", itemStatus: "PENDING" }), sendPayout: vi.fn() }));

const { loadClaimFor, loadClaims, loadWorkspace, pickRecall } = await import("./console/_lib/workspace");
const { GET: pollStatus } = await import("./api/claims/[id]/status/route");

let dir: string;
let inner: Store;
let counter: ReturnType<typeof countingStore>;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "remedy-budget-"));
  inner = localStore(dir);
  counter = countingStore(inner);
  app = withRecallCache(counter.store);
  await inner.putRecall(sampleRecall());
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const DECISIONS: Decision[] = ["paid", "held", "rejected", "blocked", "pending"];

// n claims on the demo recall that the company may see: seeded samples, demo claims and its own. Exactly one has a
// payout PayPal hasn't settled.
function claimsFor(n: number): Claim[] {
  return Array.from({ length: n }, (_, i) => {
    const decision = DECISIONS[i % DECISIONS.length];
    const paid = decision === "paid";
    return sampleClaim({
      id: `RM-${String(i + 1).padStart(4, "0")}`,
      payerId: i % 3 === 0 ? company.payerId : `PAYER${String(i).padStart(8, "0")}`,
      decision,
      reasons: decision === "rejected" || decision === "blocked" ? [{ check: "code", outcome: "reject", text: "Written code reads K7O" }] : [],
      payout: paid ? { batchId: i === 0 ? "LIVEBATCH1" : `SEED${i}`, status: i === 0 ? "PENDING" : "SUCCESS", updatedAt: "2026-11-07T10:00:00.000Z" } : null,
      createdAt: new Date(Date.parse("2026-11-07T10:00:00.000Z") + i * 60_000).toISOString(),
      ...(i % 3 === 1 ? { seeded: true } : i % 3 === 2 ? { demo: true } : {}),
    });
  });
}

async function seed(n: number) {
  const claims = claimsFor(n);
  for (const c of claims) await inner.putClaim(c);
  counter.reset();
  return claims;
}

describe.each([50, 200])("the console with %i claims", (n) => {
  // Distinct per case: the payout recheck is throttled per claim id, per instance.
  const now = Date.parse("2026-11-08T00:00:00.000Z") + n * 3_600_000;

  it("renders the grid from index.json: at most 4 reads cold, 1 warm", async () => {
    const claims = await seed(n);
    const { recalls } = await loadWorkspace(company);
    const recall = pickRecall(recalls, undefined)!;
    const rows = await loadClaims(app, recall, company, now);

    // recalls.json, the demo recall, index.json, and the one unsettled payout's claim.
    expect(counter.counts.reads).toBeLessThanOrEqual(4);
    expect(counter.counts.calls.getClaim).toBe(1);
    expect(counter.counts.writes).toBe(0);
    expect(rows).toEqual(claims.map(summarize).reverse());

    // router.refresh() after a drawer action, within the minute: the recalls are cached, the payout just checked.
    counter.reset();
    await loadClaims(app, (await loadWorkspace(company)).recalls[0], company, now + 5_000);
    expect(counter.counts.reads).toBe(1);
  });
});

describe("the evidence drawer", () => {
  it("reads one claim and its recall, fresh", async () => {
    await seed(50);
    expect(await loadClaimFor(company, "RM-0002", { fresh: true })).not.toBeNull();
    expect(counter.counts.calls).toEqual({ getClaim: 1, getRecall: 1 });
  });
});

describe("the owner's camera step", () => {
  it("polls the claim's status in one read, never the recall", async () => {
    await inner.putClaim(sampleClaim({ photos: [] }));
    counter.reset();
    const res = await pollStatus(new Request("http://127.0.0.1:3000/api/claims/RM-0412/status") as never, { params: Promise.resolve({ id: "RM-0412" }) });
    expect(await res.json()).toEqual({ decision: "pending", photos: 0 });
    expect(counter.counts.reads).toBe(1);
    expect(counter.counts.calls).toEqual({ getClaim: 1 });
  });
});

describe("recall reads", () => {
  it("hit the cache on the second call", async () => {
    expect(await getRecallBySlug("kikea-x-vesolje", app)).not.toBeNull();
    expect(counter.counts.reads).toBe(2);
    counter.reset();
    expect((await getRecallBySlug("kikea-x-vesolje", app))?.id).toBe("27-071");
    expect(await app.getRecall("27-071")).not.toBeNull();
    expect(await app.listRecalls()).toHaveLength(1);
    expect(counter.counts.reads).toBe(0);
  });
});
