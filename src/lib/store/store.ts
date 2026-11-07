import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { APPEAL_CHECK } from "../appeal";
import { ClaimId, Decision, Money, Outcome, Reason, RecallId, RecallSlug, type Claim, type Recall } from "../types";

// One row per claim in index.json: enough for the console's grid, stats and report, the demo picker and the
// pre-checks without opening every claim. Each claim file read is a Blob operation, and those are capped.
export const ClaimSummary = z.object({
  id: ClaimId,
  recallId: RecallId,
  payerId: z.string(),
  payerVerified: z.boolean(),
  decision: Decision,
  createdAt: z.iso.datetime(),
  photoHashes: z.array(z.string()),
  payoutStatus: z.string().nullable(),
  // The amount fixed at pay time (Payout.amount), if any.
  payoutAmount: Money.nullable(),
  // The reason behind the decision (decidingReason).
  reason: Reason.nullable(),
  // A demo claim's sample id.
  sample: z.string().optional(),
  seeded: z.boolean().optional(),
  demo: z.boolean().optional(),
  // A demo claim's round, if it has one.
  demoRound: z.string().optional(),
  // The claim's event count. Every save adds an event, so a row with a higher count describes a newer claim.
  version: z.number().int().nonnegative().optional(),
  // The console's evidence cells read these, so the grid never opens a claim file per row. summarize always writes
  // them; rows written before them are filled once by completeRows.
  // The one-time code the owner wrote on the tag.
  code: z.string().optional(),
  // Every check the rule recorded, in order: pre-check failures, the model's answers, a person's review.
  checks: z.array(z.object({ check: z.string(), outcome: Outcome })).optional(),
  // When each money step first happened: photos in, model answered, rule decided, PayPal sent, PayPal settled.
  times: z.object({ photos: z.iso.datetime(), answered: z.iso.datetime(), decided: z.iso.datetime(), sent: z.iso.datetime(), settled: z.iso.datetime() }).partial().optional(),
  // The photos' store keys, for the console's thumbnails. Never sent to a browser (console/_lib/photoToken.ts seals them).
  photoKeys: z.array(z.string()).optional(),
  // A held claim's refused payout: when PayPal last didn't take it, or null. Only real and demo held rows carry it, and
  // older ones are filled once by completeRows, so the queue shows a failed approve without opening the claim.
  payoutFailedAt: z.iso.datetime().nullable().optional(),
});
export type ClaimSummary = z.infer<typeof ClaimSummary>;

// Rows written before the index carried payerVerified, payoutAmount and reason (or the evidence fields above). Writers
// pass them through as they are; listClaims fills them in from their claim files once (completeRows).
export const IndexRow = ClaimSummary.partial({ payerVerified: true, payoutAmount: true, reason: true });
export type IndexRow = z.infer<typeof IndexRow>;

export const ClaimIndex = z.object({ claims: z.array(IndexRow) });
export type ClaimIndex = z.infer<typeof ClaimIndex>;

// One row per recall in recalls.json: finds a recall by slug and lists a company's recalls without a blob listing.
export const RecallSummary = z.object({
  id: RecallId,
  slug: RecallSlug,
  owner: z.string().nullable(),
  title: z.string(),
  createdAt: z.iso.datetime(),
});
export type RecallSummary = z.infer<typeof RecallSummary>;

export const RecallIndex = z.object({ recalls: z.array(RecallSummary) });
export type RecallIndex = z.infer<typeof RecallIndex>;

// usage/<UTC day>.json: the model calls made that day, counted against the budgets in src/lib/limits.ts.
const Count = z.number().int().nonnegative().default(0);
export const Usage = z.object({ vision: Count, draft: Count });
export type Usage = z.infer<typeof Usage>;
export type UsageKind = keyof Usage;
export const NO_USAGE: Usage = { vision: 0, draft: 0 };
export const UtcDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// fresh: skip the recall cache (cache.ts) and read the store. The stores themselves always read the store.
export interface ReadOptions {
  fresh?: boolean;
}

export interface Store {
  getRecall(id: string, options?: ReadOptions): Promise<Recall | null>;
  // Writes the recall's file, then its row in recalls.json. Slugs must be unique: a clash throws.
  putRecall(recall: Recall): Promise<void>;
  listRecalls(options?: ReadOptions): Promise<RecallSummary[]>;
  getClaim(id: string): Promise<Claim | null>;
  // Writes the claim's file, then its row in index.json.
  putClaim(claim: Claim): Promise<void>;
  // Adds a new claim: its row in index.json, with the index's conditional write, then its file. refuse sees the index
  // as it is when written, so limits counted from it hold when starts race. A refusal writes nothing and is returned;
  // null means the claim was added. An id already in the index throws.
  addClaim<R>(claim: Claim, refuse: (rows: IndexRow[]) => R | null): Promise<R | null>;
  // Reads the claim and saves change's result only if the claim hasn't changed since; when it has, reads it again and
  // re-runs change. Returns the saved claim, or null when the claim is missing or change returns null.
  updateClaim(id: string, change: (claim: Claim) => Claim | null): Promise<Claim | null>;
  // Writes the claim's row in index.json from the claim as given, unless the index already has that row or a newer
  // one. Repairs a row whose write failed, or lost a race, after its claim's was saved. True if it wrote.
  reindexClaim(claim: Claim): Promise<boolean>;
  // Reads index.json only: listing the blob store on every page load costs quota. Old rows are completed once
  // (completeRows).
  listClaims(): Promise<ClaimSummary[]>;
  putPhoto(key: string, jpeg: Buffer): Promise<void>;
  getPhoto(key: string): Promise<Buffer | null>;
  // A day's model calls so far; zeros before the first.
  getUsage(day: string): Promise<Usage>;
  // Counts one call of this kind for the day, with the indexes' conditional write, if fewer than limit are counted.
  // At the limit it writes nothing and returns false.
  takeUsage(day: string, kind: UsageKind, limit: number): Promise<boolean>;
}

// The next count, or null at the limit (nothing to write).
export const bump = (usage: Usage, kind: UsageKind, limit: number): Usage | null => (usage[kind] < limit ? { ...usage, [kind]: usage[kind] + 1 } : null);

/** The reason behind a claim's decision: a person's review of a paid claim, the owner's ask for a review or else the
 * first hold of a held one, a person's review or else the first reject of a refused one. Null otherwise. */
export function decidingReason(c: Pick<Claim, "decision" | "reasons">): Reason | null {
  switch (c.decision) {
    case "paid":
      return c.reasons.find((r) => r.check === "review") ?? null;
    case "held":
      return c.reasons.find((r) => r.check === APPEAL_CHECK) ?? c.reasons.find((r) => r.outcome === "hold") ?? null;
    case "rejected":
    case "blocked":
      return c.reasons.find((r) => r.check === "review" && r.outcome === "reject") ?? c.reasons.find((r) => r.outcome === "reject") ?? null;
    case "pending":
      return null;
  }
}

// The first time each money step happened, from the claim's events. Settled means PayPal said SUCCESS.
function timesOf(c: Claim): NonNullable<ClaimSummary["times"]> {
  const at = (match: (e: Claim["events"][number]) => boolean) => c.events.find(match)?.at;
  const times = {
    photos: at((e) => e.type === "photos_received"),
    answered: at((e) => e.type === "checked"),
    decided: at((e) => e.type === "decided" || e.type === "blocked" || e.type === "rejected"),
    sent: at((e) => e.type === "payout_sent"),
    settled: at((e) => e.type === "payout_updated" && e.detail.endsWith("SUCCESS")),
  };
  return Object.fromEntries(Object.entries(times).filter(([, v]) => v !== undefined));
}

// When PayPal last refused this held claim's payout, if no payout went through after it.
function payoutFailedAt(c: Claim): string | null {
  const last = c.events.findLast((e) => e.type === "payout_failed" || e.type === "payout_sent");
  return last?.type === "payout_failed" ? last.at : null;
}

// The rows that carry payoutFailedAt (a seeded claim's approve never reaches PayPal).
const failable = (r: Pick<IndexRow, "decision" | "seeded">) => r.decision === "held" && !r.seeded;

export function summarize(c: Claim): ClaimSummary {
  const sample = c.demo ? c.events.find((e) => e.type === "demo_sample")?.detail : undefined;
  return {
    id: c.id,
    recallId: c.recallId,
    payerId: c.payerId,
    payerVerified: c.payerVerified,
    decision: c.decision,
    createdAt: c.createdAt,
    photoHashes: c.photos.map((p) => p.hash),
    payoutStatus: c.payout?.status ?? null,
    payoutAmount: c.payout?.amount ?? null,
    reason: decidingReason(c),
    ...(sample ? { sample } : {}),
    ...(c.seeded ? { seeded: true } : {}),
    ...(c.demo ? { demo: true } : {}),
    ...(c.demo && c.demoRound ? { demoRound: c.demoRound } : {}),
    version: c.events.length,
    code: c.code,
    checks: c.reasons.filter((r) => r.check !== "state").map((r) => ({ check: r.check, outcome: r.outcome })),
    times: timesOf(c),
    photoKeys: c.photos.map((p) => p.key),
    ...(failable(c) ? { payoutFailedAt: payoutFailedAt(c) } : {}),
  };
}

// checks stands for the evidence fields (code, checks, times, photoKeys), which summarize always writes together.
const isComplete = (r: IndexRow): r is ClaimSummary =>
  r.payerVerified !== undefined && r.payoutAmount !== undefined && r.reason !== undefined && r.checks !== undefined && (!failable(r) || r.payoutFailedAt !== undefined);
// What an old row can say without its claim file.
const asIs = (r: IndexRow): ClaimSummary => ({ payerVerified: false, payoutAmount: null, reason: null, checks: [], times: {}, photoKeys: [], ...(failable(r) ? { payoutFailedAt: null } : {}), ...r });

/** listClaims' rows, complete. Rows from before the index carried the grid's fields are read from their claim files
 * and saved back in one index write, so this happens once per store. A row whose file is gone is saved as it can be;
 * one whose file couldn't be read is left for the next call. */
export async function completeRows(
  rows: IndexRow[],
  getClaim: (id: string) => Promise<Claim | null>,
  updateIndex: (change: (index: ClaimIndex) => ClaimIndex | null) => Promise<boolean>,
): Promise<ClaimSummary[]> {
  const old = rows.filter((r) => !isComplete(r));
  if (!old.length) return rows.filter(isComplete);
  const read = await Promise.allSettled(old.map((r) => getClaim(r.id)));
  const filled = new Map<string, ClaimSummary>();
  read.forEach((res, i) => {
    if (res.status === "fulfilled") filled.set(old[i].id, res.value ? summarize(res.value) : asIs(old[i]));
  });
  // Only rows still old when written are replaced. A failed write is tried again by the next call.
  if (filled.size) await updateIndex((index) => ({ claims: index.claims.map((r) => (isComplete(r) ? r : (filled.get(r.id) ?? r))) })).catch(() => false);
  return rows.map((r) => (isComplete(r) ? r : (filled.get(r.id) ?? asIs(r))));
}

export function summarizeRecall(r: Recall): RecallSummary {
  return { id: r.id, slug: r.slug, owner: r.owner, title: r.title, createdAt: r.createdAt };
}

// Oldest first, so the demo recall leads a workspace's list.
export function upsertRecall(index: RecallIndex, row: RecallSummary): RecallIndex {
  const clash = index.recalls.find((r) => r.slug === row.slug && r.id !== row.id);
  if (clash) throw new Error(`Slug ${row.slug} is taken by recall ${clash.id}`);
  const recalls = [...index.recalls.filter((r) => r.id !== row.id), row];
  recalls.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { recalls };
}

// A new claim's row: an id already in the index throws, so a new claim never replaces another.
export function insert(index: ClaimIndex, row: ClaimSummary): ClaimIndex {
  if (index.claims.some((c) => c.id === row.id)) throw new Error(`Claim id ${row.id} is taken`);
  return upsert(index, row);
}

// Newest first.
export function upsert(index: ClaimIndex, row: ClaimSummary): ClaimIndex {
  const claims = [row, ...index.claims.filter((c) => c.id !== row.id)];
  claims.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { claims };
}

// A saved claim's row, unless the index has it already or a newer one: two saves of one claim can reach the index in
// either order (each index write retries on contention), and the older must not win. Null writes nothing.
export function reindex(index: ClaimIndex, row: ClaimSummary): ClaimIndex | null {
  const current = index.claims.find((c) => c.id === row.id);
  if (current && ((current.version ?? -1) > (row.version ?? -1) || isDeepStrictEqual(current, row))) return null;
  return upsert(index, row);
}

// Ids arrive from URLs: validate before they become paths, so "../" can't escape the store.
const PhotoKey = z.string().regex(/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\.jpg$/);

export const paths = {
  index: "index.json",
  recallIndex: "recalls.json",
  recall: (id: string) => `recalls/${RecallId.parse(id)}.json`,
  claim: (id: string) => `claims/${ClaimId.parse(id)}.json`,
  photo: (key: string) => `photos/${PhotoKey.parse(key)}`,
  usage: (day: string) => `usage/${UtcDay.parse(day)}.json`,
};

export const isValidRecallId = (id: string) => RecallId.safeParse(id).success;
export const isValidClaimId = (id: string) => ClaimId.safeParse(id).success;
