import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleClaim, sampleRecall } from "@/lib/__fixtures__/claim";
import { countingStore } from "@/lib/__fixtures__/counting";
import { getRecallBySlug, type Store } from "@/lib/store";
import { withRecallCache } from "@/lib/store/cache";
import { localStore } from "@/lib/store/local";
import { summarize } from "@/lib/store/store";
import type { Session } from "@/lib/session";
import type { Claim, Decision, Recall, Verdict } from "@/lib/types";
import type { PipelineDeps } from "./api/claims/_lib/pipeline";

// The Vercel Blob plan caps reads at 10,000 a month (docs/PRODUCT.md, "Blob budget"). These pin how many store reads
// each hot action costs, a write's own reads included (countingStore), so a change that reads every claim again
// fails here first.

vi.mock("server-only", () => ({}));
let app: Store;
vi.mock("@/lib/demo", async (original) => ({ ...(await original<typeof import("@/lib/demo")>()), getAppStore: async () => app }));
const owner: Session = { role: "owner", payerId: "47KT8H23PUJ3Q", verified: true, name: null, email: null, iat: 0 };
const company: Session = { role: "company", payerId: "COMPANY00001", verified: true, name: null, email: null, iat: 0 };
vi.mock("@/lib/session", async (original) => {
  const session = (role: string) => (role === "owner" ? owner : company);
  return {
    ...(await original<typeof import("@/lib/session")>()),
    getSession: async (role: string) => session(role),
    requireSession: async (role: string) => session(role),
    getDemoRound: async () => "dr_0123456789abcdef0123456789abcdef",
  };
});
// PayPal still says PENDING for an unsettled payout: no network, and nothing to save.
const getPayoutStatus = vi.hoisted(() => vi.fn(async (batchId: string) => ({ batchId, batchStatus: "PENDING", itemStatus: "PENDING" })));
vi.mock("@/lib/paypal/payouts", () => ({ getPayoutStatus, sendPayout: vi.fn() }));
// Work after the response runs at once, and is awaited before counting.
const later = vi.hoisted(() => [] as Promise<unknown>[]);
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: (fn: () => unknown) => void later.push(Promise.resolve().then(fn)) }));
// The model passes every photo and PayPal takes every payout, without the network.
let deps: PipelineDeps;
vi.mock("./api/claims/_lib/deps", async (original) => ({ ...(await original<typeof import("./api/claims/_lib/deps")>()), liveDeps: async () => deps }));
// Next's data cache (unstable_cache), in memory: what it keeps, it serves without the store. A throw isn't kept.
vi.mock("next/cache", () => ({
  unstable_cache: <A extends unknown[], R>(fn: (...args: A) => Promise<R>) => {
    const kept = new Map<string, R>();
    return async (...args: A) => {
      const key = JSON.stringify(args);
      if (!kept.has(key)) kept.set(key, await fn(...args));
      return structuredClone(kept.get(key)!);
    };
  },
}));

const { loadClaimFor, loadClaims, loadWorkspace, pickRecall } = await import("./console/_lib/workspace");
const { GET: pollStatus } = await import("./api/claims/[id]/status/route");
const { GET: pollClaim } = await import("./api/claims/[id]/route");
const { GET: getPhoto } = await import("./api/claims/[id]/photos/[n]/route");
const { POST: sendPhotos } = await import("./api/claims/[id]/photos/route");
const { POST: startDemo } = await import("./api/claims/route");
const { ClaimScreen } = await import("@/components/claim/ClaimScreen");
const { default: SamplesPage } = await import("./r/[recall]/try/samples/page");
const { GET: pollQueue } = await import("./api/console/claims/route");
const { GET: consolePhoto } = await import("./api/console/claims/[id]/photos/[n]/route");
const { GET: openEvidence } = await import("./api/console/claims/[id]/route");
const { sealedPhotoUrl } = await import("./console/_lib/photoToken");

function pass(recall: Recall, code: string): Verdict {
  return {
    label: { text_seen: "X-VESOLJE", matches_recalled_product: "yes", evidence: "Tag reads X-VESOLJE" },
    steps: recall.spec.proof_steps.map((step) => ({ step, status: "done" as const, evidence: "Done" })),
    challenge_code: { text_seen: code, matches: "yes", evidence: `Tag reads ${code}` },
    same_item_in_all_photos: "yes",
    looks_like_photo_of_screen_or_print: "no",
    summary: "A cut pillow with a tag",
  };
}

let dir: string;
let inner: Store;
let counter: ReturnType<typeof countingStore>;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "remedy-budget-"));
  inner = localStore(dir);
  counter = countingStore(inner);
  app = withRecallCache(counter.store);
  await inner.putRecall(sampleRecall());
  later.length = 0;
  getPayoutStatus.mockClear();
  // env() wants them set; nothing here calls PayPal or OpenAI.
  for (const k of ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "OPENAI_API_KEY"]) vi.stubEnv(k, "unused");
  deps = {
    store: app,
    vision: async ({ spec, code }) => ({ verdict: pass({ ...sampleRecall(), spec }, code ?? ""), seconds: 12.3, model: "gpt-test" }),
    pay: async () => ({ batchId: "LIVEBATCH1", batchStatus: "PENDING" }),
    hash: async (b) => createHash("sha256").update(b).digest("hex").slice(0, 16),
    now: () => new Date(),
    limits: { vision: 100, draft: 20, claimsPerDay: 60, claimsPerMonth: 150, accountClaimsPerDay: 5, accountDemosPerDay: 12 },
  };
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const DECISIONS: Decision[] = ["paid", "held", "rejected", "blocked", "pending"];

// n claims on the demo recall that the company may see: seeded samples, demo claims and its own. Exactly one has a
// payout PayPal hasn't settled. The pending ones are still waiting for their photos.
function claimsFor(n: number): Claim[] {
  return Array.from({ length: n }, (_, i) => {
    const decision = DECISIONS[i % DECISIONS.length];
    const paid = decision === "paid";
    return sampleClaim({
      id: `RM-${String(i + 1).padStart(4, "0")}`,
      payerId: i % 3 === 0 ? company.payerId : `PAYER${String(i).padStart(8, "0")}`,
      decision,
      ...(decision === "pending" ? { photos: [] } : {}),
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
  // Distinct per case: the recheck is throttled per claim id, per instance.
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

describe("the console for a company with recalls of its own", () => {
  it("reads only the recall it shows past the cache", async () => {
    for (const i of [1, 2, 3]) await inner.putRecall({ ...sampleRecall(), id: `27-10${i}`, slug: `own-${i}`, owner: company.payerId, createdAt: `2026-11-07T0${i}:00:00.000Z` });
    await loadWorkspace(company);
    counter.reset();

    // Warm: the demo recall from the cache; an own recall, fresh.
    const demo = await loadWorkspace(company);
    expect(demo.recalls).toHaveLength(4);
    expect(counter.counts.reads).toBe(0);
    await loadWorkspace(company, "27-102");
    expect(counter.counts.calls).toEqual({ getRecall: 1 });
  });
});

describe("index rows that disagree with their claim", () => {
  const now = Date.parse("2026-11-09T00:00:00.000Z");
  // The claim file is saved, then its index row's write fails: the file moves on, the row stays.
  async function drift(row: Claim, file: Claim) {
    await inner.putClaim(row);
    await writeFile(join(dir, "claims", `${file.id}.json`), JSON.stringify(file));
    counter.reset();
  }
  const paid = (status: string): Partial<Claim> => ({ decision: "paid", payout: { batchId: "LIVEBATCH1", status, updatedAt: "2026-11-07T10:01:00.000Z" } });
  const index = async () => JSON.parse(await readFile(join(dir, "index.json"), "utf8")).claims[0];

  it("writes a settled payout's row again, once", async () => {
    const pending = sampleClaim({ id: "RM-0901", payerId: company.payerId, ...paid("PENDING") });
    const settled = { ...pending, ...paid("SUCCESS"), events: [...pending.events, { at: "2026-11-07T10:01:00.000Z", type: "payout_updated", detail: "PayPal: SUCCESS" }] };
    await drift(pending, settled);
    const recall = sampleRecall();

    expect((await loadClaims(app, recall, company, now))[0].payoutStatus).toBe("SUCCESS");
    expect(getPayoutStatus).not.toHaveBeenCalled();
    expect(counter.counts.calls).toEqual({ listClaims: 1, getClaim: 1, reindexClaim: 1 });
    expect((await index()).payoutStatus).toBe("SUCCESS");

    // A minute on, the row is settled: index.json alone.
    counter.reset();
    expect((await loadClaims(app, recall, company, now + 60_000))[0].payoutStatus).toBe("SUCCESS");
    expect(counter.counts.calls).toEqual({ listClaims: 1 });
  });

  it("writes a paid claim's row that still says it's checking", async () => {
    const checking = sampleClaim({ id: "RM-0902", payerId: company.payerId });
    const decided = { ...checking, ...paid("SUCCESS"), events: [...checking.events, { at: "2026-11-07T10:01:00.000Z", type: "decided", detail: "Every check passed" }] };
    await drift(checking, decided);

    expect((await loadClaims(app, sampleRecall(), company, now))[0]).toMatchObject({ decision: "paid", payoutStatus: "SUCCESS" });
    expect((await index()).decision).toBe("paid");
  });

  it("holds a claim whose check died, as its own page would", async () => {
    await inner.putClaim(sampleClaim({ id: "RM-0903", payerId: company.payerId, events: [{ at: "2026-11-07T10:00:00.000Z", type: "photos_received", detail: "1 photo" }] }));
    counter.reset();

    expect((await loadClaims(app, sampleRecall(), company, now))[0].decision).toBe("held");
    expect((await index()).decision).toBe("held");
  });

  it("leaves a claim still inside its session alone", async () => {
    await inner.putClaim(sampleClaim({ id: "RM-0904", payerId: company.payerId, createdAt: new Date(now - 60_000).toISOString() }));
    counter.reset();
    expect((await loadClaims(app, sampleRecall(), company, now))[0].decision).toBe("pending");
    expect(counter.counts.calls).toEqual({ listClaims: 1 });
  });
});

describe("the evidence drawer", () => {
  it("reads one claim and its recall, fresh", async () => {
    await seed(50);
    expect(await loadClaimFor(company, "RM-0002", { fresh: true })).not.toBeNull();
    expect(counter.counts.calls).toEqual({ getClaim: 1, getRecall: 1 });
  });
});

describe("the claims grid (P4)", () => {
  const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) });

  it("polls index.json alone: 3 reads cold, 1 warm, whatever the number of claims", async () => {
    await seed(200);
    const res = await pollQueue(new NextRequest("http://127.0.0.1:3000/api/console/claims?recall=27-071"));
    expect((await res.json()).rows).toHaveLength(200);
    expect(counter.counts.reads).toBeLessThanOrEqual(3);
    expect(counter.counts.calls.getClaim).toBeUndefined();

    counter.reset();
    await pollQueue(new NextRequest("http://127.0.0.1:3000/api/console/claims?recall=27-071"));
    expect(counter.counts.calls).toEqual({ listClaims: 1 });
  });

  it("serves a thumbnail without opening its claim: 1 read per photo and width, ever", async () => {
    const sharp = (await import("sharp")).default;
    const jpeg = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#7a8" } }).jpeg().toBuffer();
    const key = "budget-thumb/1.jpg";
    await inner.putPhoto(key, jpeg);
    await inner.putClaim(sampleClaim({ id: "RM-0777", payerId: company.payerId, photos: [{ key, hash: "0123456789abcdef" }] }));
    counter.reset();

    const url = `http://127.0.0.1:3000${sealedPhotoUrl("RM-0777", 0, key, company.payerId)}&w=96`;
    const thumb = () => consolePhoto(new NextRequest(url), params({ id: "RM-0777", n: "0" }));
    const res = await thumb();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, max-age=86400, immutable");
    expect((await sharp(Buffer.from(await res.arrayBuffer())).metadata()).width).toBe(96);
    expect(counter.counts.calls).toEqual({ getPhoto: 1 });

    counter.reset();
    await thumb();
    await thumb();
    expect(counter.counts.reads).toBe(0);

    // A ticket for another photo, or a width the console never asks for, is refused before any read.
    expect((await consolePhoto(new NextRequest(url), params({ id: "RM-0777", n: "1" }))).status).toBe(404);
    expect((await consolePhoto(new NextRequest(url.replace("w=96", "w=500")), params({ id: "RM-0777", n: "0" }))).status).toBe(400);
    expect(counter.counts.reads).toBe(0);
  });

  it("opens the evidence panel at a row's version: the claim once, then only its recall", async () => {
    await seed(50);
    const open = () => openEvidence(new NextRequest("http://127.0.0.1:3000/api/console/claims/RM-0002?v=1"), params({ id: "RM-0002" }));
    const first = await (await open()).json();
    expect(first.photos[0]).toMatch(/^\/api\/console\/claims\/RM-0002\/photos\/0\?t=[\w-]+$/);
    expect(counter.counts.calls).toEqual({ getClaim: 1, getRecall: 1 });

    counter.reset();
    expect((await (await open()).json()).id).toBe("RM-0002");
    expect(counter.counts.calls).toEqual({ getRecall: 1 });
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

  it("look an unknown slug up fresh at most once per 10 s, and an invalid one never", async () => {
    const t = Date.parse("2026-11-08T00:00:00.000Z");
    expect(await getRecallBySlug("no-such-recall", app, t)).toBeNull();
    expect(counter.counts.calls).toEqual({ listRecalls: 2 });
    counter.reset();
    expect(await getRecallBySlug("no-such-recall", app, t + 9_999)).toBeNull();
    expect(await getRecallBySlug("another-one", app, t + 9_999)).toBeNull();
    expect(await getRecallBySlug("../../etc", app, t + 60_000)).toBeNull();
    expect(counter.counts.reads).toBe(0);
    await getRecallBySlug("no-such-recall", app, t + 10_000);
    expect(counter.counts.calls).toEqual({ listRecalls: 1 });
  });
});

// One judge's demo run on a warm instance (the recall cached), from the picker to the result.
describe("a demo run", () => {
  const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) });
  const slug = "kikea-x-vesolje";

  it("costs what docs/PRODUCT.md says, action by action", async () => {
    await seed(50);
    await getRecallBySlug(slug, app);
    const reads: Record<string, number> = {};
    const step = async (name: string, run: () => Promise<unknown>) => {
      counter.reset();
      await run();
      await Promise.all(later);
      later.length = 0;
      reads[name] = counter.counts.reads;
    };

    await step("samples page", () => SamplesPage({ params: Promise.resolve({ recall: slug }), searchParams: Promise.resolve({}) } as never));
    let res!: Response;
    await step("start", async () => {
      const form = new FormData();
      form.set("recall", slug);
      form.set("sample", "genuine");
      res = await startDemo(new NextRequest("http://127.0.0.1:3000/api/claims", { method: "POST", body: form }));
    });
    const id = res.headers.get("location")!.split("/").pop()!;
    await step("claim page, open", () => ClaimScreen({ slug, id, demo: true }));
    await step("photos and check", () => sendPhotos(new NextRequest(`http://127.0.0.1:3000/api/claims/${id}/photos`, { method: "POST", body: new FormData() }), params({ id })));
    await step("checking poll", () => pollClaim(new NextRequest(`http://127.0.0.1:3000/api/claims/${id}`), params({ id })));
    await step("claim page, paid", () => ClaimScreen({ slug, id, demo: true }));
    await step("result photo", () => getPhoto(new NextRequest(`http://127.0.0.1:3000/api/claims/${id}/photos/1`), params({ id, n: "1" })));

    expect((await inner.getClaim(id))?.payout?.status).toBe("PENDING");
    expect(reads).toEqual({
      "samples page": 1,
      // index.json for the limits, the day's usage, then addClaim's conditional index write.
      start: 3,
      "claim page, open": 1,
      // The route's claim and photo reads, the pre-checks and the check: see checkClaim.
      "photos and check": 14,
      "checking poll": 1,
      // PayPal still says PENDING: nothing to save, so no second read of the claim.
      "claim page, paid": 1,
      // The claim, to check whose photo it is, then the photo itself (a CDN read after the first).
      "result photo": 2,
    });
  });

  it("doesn't ask PayPal about a settled payout on the result page", async () => {
    await inner.putClaim(sampleClaim({ decision: "paid", demo: true, payout: { batchId: "LIVEBATCH1", status: "SUCCESS", updatedAt: "2026-11-07T10:01:00.000Z" }, events: [{ at: "2026-11-07T10:00:00.000Z", type: "demo_sample", detail: "genuine" }] }));
    await getRecallBySlug(slug, app);
    counter.reset();
    await ClaimScreen({ slug, id: "RM-0412", demo: true });
    await Promise.all(later);
    expect(getPayoutStatus).not.toHaveBeenCalled();
    expect(counter.counts.calls).toEqual({ getClaim: 1 });
  });
});
