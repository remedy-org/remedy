import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CAPTURE_SESSION_MINUTES } from "../ids";
import { dHash } from "../fingerprint";
import { decide, preCheck, type OtherClaim } from "../rule";
import type { Store } from "../store";
import { Verdict, type Claim, type Decision, type Reason, type Recall } from "../types";
import { DEMO_RECALL_ID, demoRecall } from "./kikea";
import storedVerdicts from "./verdicts.json";

// ~40 sample claims for the Kikea demo recall, spread over the last 3 days, so a new console isn't empty.
// Every model answer is a real stored one from the eval (verdicts.json, from eval/out/runs); the decision and reasons
// come from the app's own rule. Seeded claims are marked seeded: true, use fake payer ids, and were never paid:
// their payout batch ids start with SEED.

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
type Sample = (typeof VERDICTS)[number];

const isCase = (prefix: string) => (v: Sample) => v.case.startsWith(prefix);
const POOLS = {
  pass: VERDICTS.filter((v) => v.model === "gpt-6.1-sol" && ["c01", "c03", "c05"].some((c) => isCase(c)(v))),
  reject: VERDICTS.filter((v) => v.model === "gpt-6.1-sol" && ["c09", "c10"].some((c) => isCase(c)(v))),
  hold: VERDICTS.filter((v) => v.model === "gpt-6.1-terra"),
};

// The photos the seeded claims use (c02, c08 and c11 are kept for the judges' demo samples).
export const SEED_PHOTOS = [...new Set(VERDICTS.flatMap((v) => v.photos))].sort();

type Kind = "paid" | "held" | "rejected" | "blocked" | "pending";
// 26 paid, 3 held, 6 rejected, 3 blocked, 2 pending (newest).
const MIX: Kind[] = [...Array<Kind>(26).fill("paid"), ...Array<Kind>(3).fill("held"), ...Array<Kind>(6).fill("rejected"), ...Array<Kind>(3).fill("blocked")];

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
  now: Date;
  // dHash of each seed photo, by file name.
  hashes: Record<string, string>;
  // Claim ids already used by real claims.
  taken?: ReadonlySet<string>;
  // Ids of an earlier seed, used first so a reseed overwrites it instead of adding to it.
  reuse?: readonly string[];
}

// Pure: builds the seeded claims. ensureDemoData writes them.
export function buildSeedClaims({ recall, now, hashes, taken = new Set(), reuse = [] }: SeedInput): Claim[] {
  const rand = prng(27071);
  const int = (n: number) => Math.floor(rand() * n);
  const pick = (chars: string, n: number) => Array.from({ length: n }, () => chars[int(chars.length)]).join("");
  const at = (ms: number) => new Date(ms).toISOString();
  const used = new Set([...taken, ...reuse]);
  const reusable = [...reuse];

  const claimId = () => {
    const again = reusable.shift();
    if (again) return again;
    for (;;) {
      const id = `RM-${String(int(10_000)).padStart(4, "0")}`;
      if (!used.has(id)) return used.add(id), id;
    }
  };
  const payerId = () => pick("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 13);
  const uuid = () => {
    const h = pick("0123456789abcdef", 32).split("");
    h[12] = "4";
    h[16] = "89ab"[int(4)];
    const s = h.join("");
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  };

  // Fisher-Yates over the mix, then newest-first times: pending claims are the two newest.
  const kinds = [...MIX];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = int(i + 1);
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const HOUR = 3_600_000;
  const times = Array.from({ length: kinds.length }, () => now.getTime() - (0.25 + rand() * 71.5) * HOUR).sort((a, b) => b - a);
  const plan: { kind: Kind; t: number }[] = [
    { kind: "pending", t: now.getTime() - 2 * 60_000 },
    { kind: "pending", t: now.getTime() - 7 * 60_000 },
    ...kinds.map((kind, i) => ({ kind, t: Math.floor(times[i] / 1000) * 1000 })),
  ];

  const refund = `$${recall.refund.value}`;
  const cursor: Record<keyof typeof POOLS, number> = { pass: 0, reject: 0, hold: 0 };
  const next = (pool: keyof typeof POOLS) => POOLS[pool][cursor[pool]++ % POOLS[pool].length];
  // The newest paid claim is still settling at PayPal; the rest have landed.
  const settlingAt = plan.find((p) => p.kind === "paid")?.t;
  const photosOf = (s: Sample) => s.photos.map((p) => ({ key: `${SEED_PHOTO_PREFIX}${p}`, hash: hashes[p] }));
  const summary = (c: Claim): OtherClaim => ({ id: c.id, recallId: c.recallId, payerId: c.payerId, decision: c.decision, photoHashes: c.photos.map((p) => p.hash) });

  const claims: Claim[] = [];
  const passed: Claim[] = [];
  let blocked = 0;
  // Oldest first, so blocked claims can point back at an earlier paid one.
  for (const { kind, t } of [...plan].reverse()) {
    const sample = kind === "paid" ? next("pass") : kind === "held" ? next("hold") : kind === "rejected" ? next("reject") : POOLS.pass[int(POOLS.pass.length)];
    const code = kind === "pending" ? pick("ACDEFGHJKMNPRTUVWXY", 1) + pick("34679", 1) + pick("ACDEFGHJKMNPRTUVWXY", 1) : sample.code;
    const session = { id: `cs_${pick("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", 22)}`, expiresAt: at(t + 15_000 + CAPTURE_SESSION_MINUTES * 60_000) };
    const claim: Claim = {
      id: claimId(),
      recallId: recall.id,
      payerId: payerId(),
      payerVerified: true,
      payoutKey: uuid(),
      code,
      captureSession: session,
      photos: [],
      verdict: null,
      decision: "pending",
      reasons: [],
      payout: null,
      events: [
        { at: at(t), type: "created", detail: "Logged in with PayPal (verified account)" },
        { at: at(t + 15_000), type: "code_issued", detail: `Code ${code} issued; camera session open for ${CAPTURE_SESSION_MINUTES} minutes` },
      ],
      createdAt: at(t),
      seeded: true,
    };
    if (kind === "pending") {
      claims.push(claim);
      continue;
    }

    const photosAt = t + (120 + int(300)) * 1000;
    const n = sample.photos.length;
    claim.events.push({ at: at(photosAt), type: "photos_received", detail: `${n} ${n === 1 ? "photo" : "photos"} from the live camera` });

    if (kind === "blocked") {
      const other = passed[int(passed.length)];
      // The first two need an earlier paid claim to clash with.
      const variant = other ? blocked++ % 3 : 2;
      let others: OtherClaim[] = [];
      if (variant === 0) {
        // The same photo as an earlier paid claim, from another account.
        claim.photos = other.photos;
        others = [summary(other)];
      } else if (variant === 1) {
        // A second claim from an account that was already paid, with different photos.
        claim.payerId = other.payerId;
        claim.photos = photosOf(POOLS.pass.find((s) => s.photos[0] !== other.photos[0].key.slice(SEED_PHOTO_PREFIX.length)) ?? sample);
        others = [summary(other)];
      } else {
        claim.payerVerified = false;
        claim.events[0].detail = "Logged in with PayPal (unverified account)";
        claim.photos = photosOf(sample);
      }
      claim.reasons = preCheck({ claim, sessionId: session.id, photoHashes: claim.photos.map((p) => p.hash), others, now: new Date(photosAt) });
      claim.decision = "blocked";
      claim.events.push({ at: at(photosAt + 400), type: "blocked", detail: `Blocked before the photo check: ${claim.reasons.map((r) => r.text).join("; ")}` });
      claims.push(claim);
      continue;
    }

    claim.photos = photosOf(sample);
    claim.verdict = sample.verdict;
    const checkedAt = photosAt + Math.round(sample.seconds * 1000);
    const { outcome, reasons } = decide(sample.verdict, { spec: recall.spec, code, photos: n });
    const decision: Decision = outcome === "pass" ? (recall.autoPay ? "paid" : "held") : outcome === "hold" ? "held" : "rejected";
    const expected = { paid: "pass", held: "hold", rejected: "reject" }[kind];
    if (outcome !== expected) throw new Error(`Seed verdict ${sample.case} (${sample.source}) decides ${outcome}, expected ${expected}`);
    claim.reasons = reasons;
    claim.decision = decision;
    claim.events.push({ at: at(photosAt + 300), type: "prechecked", detail: "Live session, new photos, first claim for this account" });
    claim.events.push({ at: at(checkedAt), type: "checked", detail: `Photo check answered in ${sample.seconds.toFixed(1)} s` });
    const first = (o: Reason["outcome"]) => reasons.find((r) => r.outcome === o)?.text ?? "";
    const said =
      outcome === "pass"
        ? decision === "paid"
          ? "Every check passed"
          : "Every check passed; held for a person because auto-pay is off"
        : outcome === "hold"
          ? `Held for a person: ${first("hold")}`
          : `Rejected: ${first("reject")}`;
    claim.events.push({ at: at(checkedAt + 50), type: "decided", detail: said });
    if (outcome === "pass") passed.push(claim);

    if (decision === "paid") {
      const settling = t === settlingAt;
      const status = settling ? "PENDING" : "SUCCESS";
      const batchId = `SEED${pick("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 9)}`;
      claim.payout = { batchId, itemId: `SEED${pick("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 9)}`, status, updatedAt: at(checkedAt + (settling ? 1_000 : 41_000)) };
      claim.events.push({ at: at(checkedAt + 1_000), type: "payout_sent", detail: `Payout of ${refund} sent through PayPal` });
      if (!settling) claim.events.push({ at: at(checkedAt + 41_000), type: "payout_updated", detail: "PayPal: SUCCESS" });
    }
    claims.push(claim);
  }
  return claims.reverse();
}

export interface EnsureOptions {
  now?: Date;
  // Rewrite the seeded claims with fresh times (same ids).
  reset?: boolean;
  // Where the sample photos are read from.
  photoDir?: string;
}

export interface EnsureResult {
  recall: "created" | "kept";
  claims: "created" | "kept";
  count: number;
}

// Idempotent: creates the Kikea recall if missing (never overwrites a company's edits to it) and the seeded claims
// if none exist yet, or always with reset.
export async function ensureDemoData(store: Store, { now = new Date(), reset = false, photoDir = join(process.cwd(), "public/demo") }: EnsureOptions = {}): Promise<EnsureResult> {
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
    const jpeg = await readFile(join(photoDir, name));
    await store.putPhoto(`${SEED_PHOTO_PREFIX}${name}`, jpeg);
    hashes[name] = await dHash(jpeg);
  }

  const taken = new Set(rows.filter((r) => !r.seeded).map((r) => r.id));
  const claims = buildSeedClaims({ recall, now, hashes, taken, reuse: seeded.map((r) => r.id) });
  // One at a time: the blob store's index write retries on contention, and 40 at once would exhaust it.
  for (const claim of claims) await store.putClaim(claim);
  return { recall: recallState, claims: "created", count: claims.length };
}
