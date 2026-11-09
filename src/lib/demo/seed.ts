import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CAPTURE_SESSION_MINUTES } from "../ids";
import { dHash } from "../fingerprint";
import { decide, preCheck, type OtherClaim } from "../rule";
import type { Store } from "../store";
import { Verdict, type Claim, type Decision, type Reason, type Recall } from "../types";
import { DEMO_CLAIMS, type DemoClaim } from "./claims";
import { DEMO_RECALL_ID, demoRecall } from "./kikea";
import storedVerdicts from "./verdicts.json";

// The demo recall's claims (claims.ts, DEMO_CLAIMS), built as stored claims so a new console isn't empty. Every model
// answer is a real stored one from the eval (verdicts.json, from eval/out/runs); the decision and reasons come from the
// app's own rule. Seeded claims are marked seeded: true and use generated payer ids. Only RM-0442 carries a PayPal
// payout (the genuine claim, paid 15 s after its photo); the other approved claim has none sent.
// A decided claim keeps its eval case's code (K7Q or R8D), from before the issued alphabet dropped Q and 8
// (src/lib/codes.ts): the code is hand-written in the photos, so a new one would change the decision.

export const SEED_PHOTO_PREFIX = "seed/";

interface StoredVerdict {
  case: string;
  source: string;
  model: string;
  code: string;
  photos: string[];
  seconds: number;
  verdict: unknown;
}

const VERDICTS = (storedVerdicts as StoredVerdict[]).map((v) => ({ ...v, verdict: Verdict.parse(v.verdict) }));

/** The stored answer a demo claim was checked with. */
const answerOf = (d: DemoClaim) => {
  const v = VERDICTS.find((x) => x.case === d.answer?.case && x.source === d.answer?.source);
  if (!v) throw new Error(`No stored answer for ${d.id} (${d.answer?.case}, ${d.answer?.source})`);
  return v;
};

// The photos the seeded claims use, one set per claim.
export const SEED_PHOTOS = [...new Set(DEMO_CLAIMS.flatMap((c) => c.photos))].sort();

// Deterministic, so a reseed rewrites the same claims.
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeedInput {
  recall: Recall;
  // dHash of each seed photo, by file name.
  hashes: Record<string, string>;
  // Claim ids already used by real claims: a demo claim with one of them is left out, never written over the real one.
  taken?: ReadonlySet<string>;
}

// Pure: builds the seeded claims from DEMO_CLAIMS. ensureDemoData writes them.
export function buildSeedClaims({ recall, hashes, taken = new Set() }: SeedInput): Claim[] {
  const rand = prng(27071);
  const int = (n: number) => Math.floor(rand() * n);
  const pick = (chars: string, n: number) => Array.from({ length: n }, () => chars[int(chars.length)]).join("");
  const at = (ms: number) => new Date(ms).toISOString();
  const payerId = () => pick("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 13);
  const uuid = () => {
    const h = pick("0123456789abcdef", 32).split("");
    h[12] = "4";
    h[16] = "89ab"[int(4)];
    const s = h.join("");
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  };

  const refund = `$${recall.refund.value}`;
  const photosOf = (names: readonly string[]) => names.map((p) => ({ key: `${SEED_PHOTO_PREFIX}${p}`, hash: hashes[p] }));
  const summary = (c: Claim): OtherClaim => ({ id: c.id, recallId: c.recallId, payerId: c.payerId, decision: c.decision, photoHashes: c.photos.map((p) => p.hash) });

  const claims: Claim[] = [];
  // Oldest first, so the repost can point back at the claim it copied.
  for (const d of [...DEMO_CLAIMS].reverse()) {
    const t = Date.parse(d.filed);
    const session = { id: `cs_${pick("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", 22)}`, expiresAt: at(t + 15_000 + CAPTURE_SESSION_MINUTES * 60_000) };
    const claim: Claim = {
      id: d.id,
      recallId: recall.id,
      payerId: payerId(),
      payerVerified: d.block !== "unverified",
      payoutKey: uuid(),
      code: d.code,
      captureSession: session,
      photos: photosOf(d.photos),
      verdict: null,
      decision: "pending",
      reasons: [],
      payout: null,
      events: [
        { at: at(t), type: "created", detail: `Logged in with PayPal (${d.block === "unverified" ? "unverified" : "verified"} account)` },
        { at: at(t + 15_000), type: "code_issued", detail: `Code ${d.code} issued; camera session open for ${CAPTURE_SESSION_MINUTES} minutes` },
      ],
      createdAt: at(t),
      seeded: true,
    };
    const photosAt = t + d.shoot * 1000;
    claim.events.push({ at: at(photosAt), type: "photos_received", detail: `${d.photos.length} ${d.photos.length === 1 ? "photo" : "photos"} received` });

    if (d.outcome === "blocked") {
      const copied = d.copies ? claims.find((c) => c.id === d.copies) : undefined;
      if (d.copies && !copied) throw new Error(`${d.id} copies ${d.copies}, which must be older`);
      // The repost's photos are the copied claim's own; a photo from outside the camera arrives on no session.
      const sessionId = d.block === "session" ? "" : session.id;
      claim.reasons = preCheck({ claim, sessionId, photoHashes: claim.photos.map((p) => p.hash), others: copied ? [summary(copied)] : [], now: new Date(photosAt) });
      // The repost names the claim it copied, so the console can open it beside this one.
      if (copied) claim.reasons = claim.reasons.map((r) => (r.check === "duplicate_photo" ? { ...r, text: `${r.text}, ${copied.id}` } : r));
      claim.decision = "blocked";
      claim.events.push({ at: at(photosAt + 400), type: "blocked", detail: `Blocked before the photo check: ${claim.reasons.map((r) => r.text).join("; ")}` });
      if (!taken.has(d.id)) claims.push(claim);
      continue;
    }

    const sample = answerOf(d);
    claim.verdict = sample.verdict;
    const checkedAt = photosAt + Math.round(sample.seconds * 1000);
    const { outcome, reasons } = decide(sample.verdict, { spec: recall.spec, code: d.code, photos: d.photos.length });
    const expected = { paid: "pass", approved: "pass", held: "hold", rejected: "reject" }[d.outcome];
    if (outcome !== expected) throw new Error(`Seed verdict ${sample.case} (${sample.source}) decides ${outcome}, expected ${expected}`);
    const decision: Decision = outcome === "pass" ? "paid" : outcome === "hold" ? "held" : "rejected";
    claim.reasons = reasons;
    claim.decision = decision;
    claim.events.push({ at: at(photosAt + 300), type: "prechecked", detail: "Account checks passed" });
    claim.events.push({ at: at(checkedAt), type: "checked", detail: `Photo check answered in ${sample.seconds.toFixed(1)} s` });
    const first = (o: Reason["outcome"]) => reasons.find((r) => r.outcome === o)?.text ?? "";
    const said = d.outcome === "approved" ? "Every check passed; refund approved, nothing sent yet" : outcome === "pass" ? "Every check passed" : outcome === "hold" ? `Held for a person: ${first("hold")}` : `Rejected: ${first("reject")}`;
    claim.events.push({ at: at(checkedAt + 50), type: "decided", detail: said });

    if (d.outcome === "paid") {
      // Paid: PayPal took the payout d.toPayout seconds after the photos and confirmed it.
      const sentAt = photosAt + (d.toPayout ?? 0) * 1000;
      claim.payout = { batchId: `SEED${pick("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 9)}`, itemId: `SEED${pick("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 9)}`, status: "SUCCESS", updatedAt: at(sentAt + 40_000) };
      claim.events.push({ at: at(sentAt), type: "payout_sent", detail: `Payout of ${refund} sent through PayPal` });
      claim.events.push({ at: at(sentAt + 40_000), type: "payout_updated", detail: "PayPal: SUCCESS" });
    }
    if (!taken.has(d.id)) claims.push(claim);
  }
  // Newest first.
  return claims.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface EnsureOptions {
  now?: Date;
  // Rewrite the seeded claims (DEMO_CLAIMS, same ids and times).
  reset?: boolean;
}

export interface EnsureResult {
  recall: "created" | "kept";
  claims: "created" | "kept";
  count: number;
}

// Idempotent: creates the Kikea recall if missing (never overwrites a company's edits to it) and the seeded claims
// if none exist yet, or always with reset.
export async function ensureDemoData(store: Store, { now = new Date(), reset = false }: EnsureOptions = {}): Promise<EnsureResult> {
  let recall = await store.getRecall(DEMO_RECALL_ID);
  const recallState = recall ? "kept" : "created";
  if (!recall) {
    recall = demoRecall(new Date(now.getTime() - 3 * 24 * 3_600_000));
    await store.putRecall(recall);
  }

  const rows = await store.listClaims();
  const seeded = rows.filter((r) => r.seeded);
  if (seeded.length && !reset) return { recall: recallState, claims: "kept", count: seeded.length };

  const hashes: Record<string, string> = {};
  for (const name of SEED_PHOTOS) {
    // A path rooted in public/demo, so the build traces only the sample photos, not the whole project.
    const jpeg = await readFile(join(process.cwd(), "public", "demo", name));
    await store.putPhoto(`${SEED_PHOTO_PREFIX}${name}`, jpeg);
    hashes[name] = await dHash(jpeg);
  }

  const taken = new Set(rows.filter((r) => !r.seeded).map((r) => r.id));
  const claims = buildSeedClaims({ recall, hashes, taken });
  // One at a time: the blob store's index write retries on contention, and 40 at once would exhaust it.
  for (const claim of claims) await store.putClaim(claim);
  return { recall: recallState, claims: "created", count: claims.length };
}
