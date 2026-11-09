import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_ROUND_COOKIE, DEMO_SAMPLES, DEMO_SPEC, demoRecall, parseDemoRound, type DemoSample } from "@/lib/demo";
import { dHash } from "@/lib/fingerprint";
import type { Session } from "@/lib/session";
import type { Store } from "@/lib/store";
import { localStore } from "@/lib/store/local";
import type { Verdict } from "@/lib/types";
import type { PipelineDeps } from "./_lib/pipeline";

// Many judges share one sandbox login (the Devpost notes give one). Each browser's round must still reach the four
// outcomes the picker promises, through the real routes, the real sample photos and their fingerprints. Only the model
// and PayPal are stand-ins.

vi.mock("server-only", () => ({}));
let store: Store;
vi.mock("@/lib/demo", async (original) => ({ ...(await original<typeof import("@/lib/demo")>()), getAppStore: async () => store }));
const judge: Session = { role: "owner", payerId: "SHAREDJUDGE1", verified: true, name: null, email: null, iat: 0 };
vi.mock("@/lib/session", async (original) => ({ ...(await original<typeof import("@/lib/session")>()), getSession: async () => judge }));
const later = vi.hoisted(() => [] as Promise<unknown>[]);
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: (fn: () => unknown) => void later.push(Promise.resolve().then(fn)) }));
let deps: PipelineDeps;
vi.mock("./_lib/deps", async (original) => ({ ...(await original<typeof import("./_lib/deps")>()), liveDeps: async () => deps }));

const { POST: fileDemo } = await import("./route");
const { POST: newRound } = await import("./round/route");
const { POST: sendPhotos } = await import("./[id]/photos/route");

const SLUG = "kikea-x-vesolje";
const ORIGIN = "http://127.0.0.1:3000";

// What the model reads on each sample photo's tag.
const TAGS: Record<string, string> = { "k01-1.jpg": "M4T", "k02-1.jpg": "K7Q", "web-1.jpg": "H6N" };
let photoTags: [Buffer, string][];

function verdictFor(tag: string): Verdict {
  return {
    label: { text_seen: "X-VESOLJE", matches_recalled_product: "yes", evidence: "Tag reads X-VESOLJE" },
    steps: DEMO_SPEC.proof_steps.map((step) => ({ step, status: "done" as const, evidence: "Done" })),
    challenge_code: { text_seen: tag, matches: "yes", evidence: `Tag reads ${tag}` },
    same_item_in_all_photos: "yes",
    looks_like_photo_of_screen_or_print: "no",
    summary: "A cut pillow with a tag",
  };
}

let dir: string;
let pay: ReturnType<typeof vi.fn<PipelineDeps["pay"]>>;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "remedy-rounds-"));
  store = localStore(dir);
  await store.putRecall(demoRecall(new Date("2026-11-04T00:00:00Z")));
  vi.stubEnv("PAYPAL_API_BASE", "https://api-m.sandbox.paypal.com");
  photoTags = await Promise.all(Object.entries(TAGS).map(async ([name, tag]) => [await readFile(join(process.cwd(), "public/demo", name)), tag] as [Buffer, string]));
  pay = vi.fn<PipelineDeps["pay"]>(async () => ({ batchId: "SANDBOXBATCH", batchStatus: "PENDING" }));
  later.length = 0;
  deps = {
    store,
    vision: async ({ images }) => ({ verdict: verdictFor(photoTags.find(([b]) => b.equals(images[0]))?.[1] ?? "???"), seconds: 1, model: "gpt-test" }),
    pay,
    hash: dHash,
    now: () => new Date(),
    limits: { vision: 100, draft: 20, claimsPerDay: 200, claimsPerMonth: 500, accountClaimsPerDay: 5, accountDemosPerDay: 60, demosPerDay: 1000, demosPerMonth: 1000 },
  };
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const withRound = (round: string | null) => (round ? { cookie: `${DEMO_ROUND_COOKIE}=${round}` } : undefined);
const roundOf = (res: Response) => parseDemoRound(res.headers.get("set-cookie")?.match(new RegExp(`${DEMO_ROUND_COOKIE}=([^;]+)`))?.[1]);

// The picker's form, then the sample's photos, then the check after the response, as a browser runs them.
async function runSample(sample: DemoSample, round: string | null) {
  const form = new FormData();
  form.set("recall", SLUG);
  form.set("sample", sample.id);
  const filed = await fileDemo(new NextRequest(`${ORIGIN}/api/claims`, { method: "POST", body: form, headers: withRound(round) }));
  if (filed.status !== 303) return { status: filed.status, round: null, claim: null };
  const id = filed.headers.get("location")!.split("/").pop()!;
  await sendPhotos(new NextRequest(`${ORIGIN}/api/claims/${id}/photos`, { method: "POST", body: new FormData() }), { params: Promise.resolve({ id }) });
  await Promise.all(later);
  later.length = 0;
  return { status: filed.status, round: roundOf(filed), claim: await store.getClaim(id) };
}

async function runRound(round: string | null) {
  const outcomes: Record<string, string> = {};
  for (const sample of DEMO_SAMPLES) {
    const { status, round: set, claim } = await runSample(sample, round);
    expect(status).toBe(303);
    // A browser without a round gets one with its first claim, and keeps it.
    if (round) expect(set).toBe(round);
    round = set;
    const decidedBy = claim!.reasons.find((r) => r.outcome !== "pass")?.check ?? "all";
    outcomes[sample.id] = `${claim!.decision} by ${decidedBy}`;
    expect(claim!.demoRound).toBe(round);
  }
  return { round: round!, outcomes };
}

const EXPECTED = Object.fromEntries(DEMO_SAMPLES.map((s) => [s.id, `${s.expect} by ${s.decidedBy}`]));

describe("demo rounds on one shared PayPal account", () => {
  it("reach all four expected outcomes in every round, paying the genuine sample once per round", async () => {
    expect(EXPECTED).toEqual({ genuine: "paid by all", "wrong-code": "rejected by code", "ai-no-session": "blocked by session", reposted: "blocked by duplicate_photo" });

    const first = await runRound(null);
    expect(first.outcomes).toEqual(EXPECTED);

    // "Start over": a new round for this browser, back on the picker, which says the four were cleared.
    const form = new FormData();
    form.set("recall", SLUG);
    const again = await newRound(new NextRequest(`${ORIGIN}/api/claims/round`, { method: "POST", body: form, headers: withRound(first.round) }));
    expect(again.status).toBe(303);
    expect(again.headers.get("location")).toBe(`/r/${SLUG}/try/samples?cleared=1`);
    const second = roundOf(again);
    expect(second).not.toBeNull();
    expect(second).not.toBe(first.round);

    expect((await runRound(second)).outcomes).toEqual(EXPECTED);
    // Another judge's browser, on the same account, at the same time.
    expect((await runRound("dr_0123456789abcdef0123456789abcdef")).outcomes).toEqual(EXPECTED);

    expect(pay).toHaveBeenCalledTimes(3);
    expect(new Set(pay.mock.calls.map(([p]) => p.payerId))).toEqual(new Set([judge.payerId]));
  });

  it("refuses the repost until this round's genuine photo is sent, whatever earlier rounds did", async () => {
    const { round } = await runRound(null);
    const repost = DEMO_SAMPLES.find((s) => s.after)!;
    const fresh = "dr_ffffffffffffffffffffffffffffffff";
    expect((await runSample(repost, fresh)).status).toBe(409);
    // The finished round can still repost: its genuine photo was sent.
    expect((await runSample(repost, round)).claim?.decision).toBe("blocked");
  });

  it("runs a sample again after the model didn't answer, reaching the expected outcome", async () => {
    const answer = deps.vision;
    deps.vision = async () => {
      throw new Error("model timed out");
    };
    const outage = await runSample(DEMO_SAMPLES[0], null);
    expect(outage.claim).toMatchObject({ decision: "held", reasons: [{ check: "model" }] });
    const wrong = await runSample(DEMO_SAMPLES[1], outage.round);
    expect(wrong.claim?.decision).toBe("held");

    deps.vision = answer;
    expect((await runSample(DEMO_SAMPLES[0], outage.round)).claim?.decision).toBe("paid");
    expect((await runSample(DEMO_SAMPLES[1], outage.round)).claim?.reasons.find((r) => r.outcome !== "pass")?.check).toBe("code");
    // The repost still meets the unanswered genuine run's photo.
    expect((await runSample(DEMO_SAMPLES[3], outage.round)).claim?.reasons[0]?.check).toBe("duplicate_photo");
  });

  it("never lets an old demo claim without a round block a new round", async () => {
    // A genuine claim paid before rounds existed, on the same account.
    const legacy = await runSample(DEMO_SAMPLES[0], null);
    const claim = legacy.claim!;
    delete claim.demoRound;
    await store.putClaim(claim);
    expect((await store.listClaims()).find((r) => r.id === claim.id)?.demoRound).toBeUndefined();

    expect((await runRound("dr_0123456789abcdef0123456789abcdef")).outcomes).toEqual(EXPECTED);
  });
});
