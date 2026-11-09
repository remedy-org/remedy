import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleClaim, sampleRecall } from "@/lib/__fixtures__/claim";
import { abandonedDemo } from "@/lib/limits";
import { countingStore } from "@/lib/__fixtures__/counting";
import { getRecallBySlug, type Store } from "@/lib/store";
import { withRecallCache } from "@/lib/store/cache";
import { localStore } from "@/lib/store/local";
import { summarize } from "@/lib/store/store";
import type { Session } from "@/lib/session";
import type { Claim, Decision, Recall, Verdict } from "@/lib/types";
import type { PipelineDeps } from "./api/claims/_lib/pipeline";
import { DEMO_CLAIMS } from "@/lib/demo/claims";

// The Vercel Blob plan caps reads at 10,000 a month (docs/PRODUCT.md, "Blob budget"). These pin how many store reads
// each hot action costs, a write's own reads included (countingStore), so a change that reads every claim again
// fails here first.

vi.mock("server-only", () => ({}));
let app: Store;
vi.mock("@/lib/demo", async (original) => ({ ...(await original<typeof import("@/lib/demo")>()), getAppStore: async () => app }));
const owner: Session = { role: "owner", payerId: "47KT8H23PUJ3Q", verified: true, name: null, email: null, iat: 0 };
const company: Session = { role: "company", payerId: "COMPANY00001", verified: true, name: null, email: null, iat: 0 };
// This browser's demo round: the console lists the demo claims it made (and the dataset's seven), no other browser's.
const ROUND = "dr_0123456789abcdef0123456789abcdef";
const viewer = { ...company, round: ROUND };
const withRound = (url: string) => new NextRequest(url, { headers: { cookie: `remedy_demo_round=${ROUND}` } });
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
const { withDatasetRows } = await import("./console/_lib/dataset");
const { GET: pollStatus } = await import("./api/claims/[id]/status/route");
const { GET: pollClaim } = await import("./api/claims/[id]/route");
const { GET: getPhoto } = await import("./api/claims/[id]/photos/[n]/route");
const { POST: sendPhotos } = await import("./api/claims/[id]/photos/route");
const { POST: startDemo } = await import("./api/claims/route");
const { ClaimScreen } = await import("@/components/claim/ClaimScreen");
const model = await import("@/components/claim/model");
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

// n claims on the demo recall: an earlier seed's claims (never listed), this browser's demo claims and the company's own. Exactly one has a
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
      ...(i % 3 === 1 ? { seeded: true } : i % 3 === 2 ? { demo: true, demoRound: ROUND } : {}),
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
    const { store, recalls } = await loadWorkspace(viewer);
    const recall = pickRecall(recalls, undefined)!;
    const rows = await loadClaims(store, recall, viewer, now);

    // recalls.json, the demo recall, index.json, and the one unsettled payout's claim.
    expect(counter.counts.reads).toBeLessThanOrEqual(4);
    expect(counter.counts.calls.getClaim).toBe(1);
    expect(counter.counts.writes).toBe(0);
    // Judges' demo starts left before a photo was sent are left out (abandonedDemo), and an earlier seed's claims; the
    // dataset's seven are listed from memory, with everything else.
    const listed = withDatasetRows(claims.map(summarize)).filter((r) => !abandonedDemo(r, new Date(now)));
    expect(listed.length).toBeLessThan(n);
    expect(rows).toEqual(listed);
    expect(rows.filter((r) => r.seeded).map((r) => r.id).sort()).toEqual(DEMO_CLAIMS.map((d) => d.id).sort());

    // router.refresh() after a drawer action, within the minute: the recalls are cached, the payout just checked.
    counter.reset();
    const warm = await loadWorkspace(viewer);
    await loadClaims(warm.store, warm.recalls[0], viewer, now + 5_000);
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
    expect(await loadClaimFor(company, "RM-0004", { fresh: true })).not.toBeNull();
    expect(counter.counts.calls).toEqual({ getClaim: 1, getRecall: 1 });
  });
});

describe("the claims grid (P4)", () => {
  const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) });

  it("polls index.json alone: 3 reads cold, 1 warm, whatever the number of claims", async () => {
    const claims = await seed(200);
    const res = await pollQueue(withRound("http://127.0.0.1:3000/api/console/claims?recall=27-071"));
    expect((await res.json()).rows).toHaveLength(withDatasetRows(claims.map(summarize)).filter((r) => !abandonedDemo(r, new Date())).length);
    expect(counter.counts.reads).toBeLessThanOrEqual(3);
    expect(counter.counts.calls.getClaim).toBeUndefined();

    counter.reset();
    await pollQueue(withRound("http://127.0.0.1:3000/api/console/claims?recall=27-071"));
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

  it("opens the evidence panel at a row's version: the claim once, its recall from the cache", async () => {
    const claims = await seed(50);
    const open = (id = "RM-0001") => openEvidence(withRound(`http://127.0.0.1:3000/api/console/claims/${id}?v=1`), params({ id }));
    const first = await (await open()).json();
    expect(first.photos[0]).toMatch(/^\/api\/console\/claims\/RM-0001\/photos\/0\?t=[\w-]+$/);
    expect(counter.counts.calls).toEqual({ getClaim: 1, getRecall: 1 });

    counter.reset();
    expect((await (await open()).json()).id).toBe("RM-0001");
    expect(counter.counts.reads).toBe(0);

    // Walking 10 rows with ↓: 1 read for each new claim, then none on the way back up.
    const ids = ["RM-0003", "RM-0004", "RM-0006", "RM-0007", "RM-0009", "RM-0010", "RM-0012", "RM-0013", "RM-0015", "RM-0016"];
    // A held claim a person can pay reads index.json too, each time: what approve's checks would stop now.
    const held = claims.filter((c) => ids.includes(c.id) && c.decision === "held" && !c.seeded).length;
    expect(held).toBeGreaterThan(0);
    counter.reset();
    for (const id of ids) await open(id);
    expect(counter.counts.calls).toEqual({ getClaim: ids.length, listClaims: held });
    counter.reset();
    for (const id of ids.toReversed()) await open(id);
    expect(counter.counts.reads).toBe(held);
  });

  it("stops polling for an abandoned claim or a payout parked at UNCLAIMED: 0 polls", async () => {
    const { isLive, PENDING_LIVE_MS } = await import("./console/_lib/view");
    const { STALE_AFTER_MS } = await import("./api/claims/_lib/pipeline");
    const { CAPTURE_SESSION_MINUTES } = await import("@/lib/ids");
    expect(PENDING_LIVE_MS).toBe(CAPTURE_SESSION_MINUTES * 60_000 + STALE_AFTER_MS);
    await inner.putClaim(sampleClaim({ id: "RM-0901", payerId: company.payerId, photos: [], createdAt: "2026-11-06T22:49:00.000Z" }));
    await inner.putClaim(sampleClaim({ id: "RM-0902", payerId: company.payerId, decision: "paid", payout: { batchId: "LIVE0902", status: "UNCLAIMED", updatedAt: "2026-11-07T10:00:00.000Z" } }));
    const res = await pollQueue(withRound("http://127.0.0.1:3000/api/console/claims?recall=27-071"));
    const { rows } = await res.json();
    expect(rows).toHaveLength(2 + DEMO_CLAIMS.length);
    expect(isLive(rows, Date.parse("2026-11-07T10:05:00.000Z"))).toBe(false);
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

// The paid receipt polls the same route (ReceiptLive): every 5 s for 30 s, then every 15 s, for 2 minutes at most, and
// only for a payout sent in the last 10 minutes that hasn't settled. One read a poll; PayPal at most once a minute.
describe("the paid receipt's live status", () => {
  const poll = async (id: string) => {
    const res = await pollStatus(new Request(`http://127.0.0.1:3000/api/claims/${id}/status`) as never, { params: Promise.resolve({ id }) });
    await Promise.all(later);
    return res;
  };
  const paidClaim = (id: string, status: string) =>
    sampleClaim({ id, decision: "paid", payout: { batchId: `LIVE${id.slice(3)}`, status, updatedAt: "2026-11-07T10:01:00.000Z" }, events: [{ at: "2026-11-07T10:01:00.000Z", type: "payout_sent", detail: "sent" }] });

  it("polls at most 12 times, and never past 2 minutes", () => {
    const { receiptPollDelay } = model;
    let at = 0;
    let polls = 0;
    for (let d = receiptPollDelay(at); d !== null; d = receiptPollDelay(at)) {
      at += d;
      polls++;
    }
    expect(polls).toBe(12);
    expect(at).toBeLessThanOrEqual(120_000);
  });

  it("reads the claim once a poll, and asks PayPal at most once a minute", async () => {
    await inner.putClaim(paidClaim("RM-0601", "PENDING"));
    counter.reset();

    const first = await poll("RM-0601");
    expect(first.headers.get("Cache-Control")).toBe("no-store");
    expect(await first.json()).toEqual({ decision: "paid", photos: 1, payout: "PENDING" });
    // PayPal still says PENDING: nothing saved, so only the poll's own read.
    expect(getPayoutStatus).toHaveBeenCalledTimes(1);
    expect(counter.counts.calls).toEqual({ getClaim: 1 });

    // The next poll, seconds later: the claim alone, no PayPal.
    counter.reset();
    expect(await (await poll("RM-0601")).json()).toMatchObject({ payout: "PENDING" });
    expect(getPayoutStatus).toHaveBeenCalledTimes(1);
    expect(counter.counts.calls).toEqual({ getClaim: 1 });
  });

  it("saves PayPal's new status when it moves, so the console shows it too", async () => {
    await inner.putClaim(paidClaim("RM-0602", "PENDING"));
    counter.reset();
    getPayoutStatus.mockResolvedValueOnce({ batchId: "LIVE0602", batchStatus: "SUCCESS", itemStatus: "SUCCESS" });

    expect(await (await poll("RM-0602")).json()).toMatchObject({ payout: "SUCCESS" });
    expect(counter.counts.calls).toEqual({ getClaim: 1, updateClaim: 1 });
    expect(counter.counts.reads).toBe(3);
    expect((await inner.getClaim("RM-0602"))?.payout?.status).toBe("SUCCESS");
  });

  it("never asks PayPal about a settled payout", async () => {
    await inner.putClaim(paidClaim("RM-0603", "SUCCESS"));
    counter.reset();
    expect(await (await poll("RM-0603")).json()).toMatchObject({ payout: "SUCCESS" });
    expect(getPayoutStatus).not.toHaveBeenCalled();
    expect(counter.counts.reads).toBe(1);
  });

  it("shows another owner's claim to no one", async () => {
    await inner.putClaim(paidClaim("RM-0604", "PENDING"));
    await inner.putClaim({ ...paidClaim("RM-0605", "PENDING"), payerId: "SOMEONEELSE1" });
    const res = await poll("RM-0605");
    expect(res.status).toBe(404);
    expect(JSON.stringify(await res.json())).not.toContain("PENDING");
    expect(getPayoutStatus).not.toHaveBeenCalled();
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
    await step("receipt poll", () => pollStatus(new NextRequest(`http://127.0.0.1:3000/api/claims/${id}/status`), params({ id })));
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
      // PayPal still says PENDING: nothing to save, so no second read of the claim. A demo result also reads
      // index.json once, for this round's scoreboard and "Next sample".
      "claim page, paid": 2,
      // The receipt's live status: the claim alone; PayPal was asked a moment ago, by the page.
      "receipt poll": 1,
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
    // The claim, and index.json for the round's scoreboard.
    expect(counter.counts.calls).toEqual({ getClaim: 1, listClaims: 1 });
  });
});
