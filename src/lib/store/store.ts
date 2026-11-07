import { z } from "zod";
import { ClaimId, Decision, RecallId, RecallSlug, type Claim, type Recall } from "../types";

// One row per claim in index.json: enough for the dashboard and the pre-checks without opening every claim.
export const ClaimSummary = z.object({
  id: ClaimId,
  recallId: RecallId,
  payerId: z.string(),
  decision: Decision,
  createdAt: z.iso.datetime(),
  photoHashes: z.array(z.string()),
  payoutStatus: z.string().nullable(),
  seeded: z.boolean().optional(),
  demo: z.boolean().optional(),
});
export type ClaimSummary = z.infer<typeof ClaimSummary>;

export const ClaimIndex = z.object({ claims: z.array(ClaimSummary) });
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

export interface Store {
  getRecall(id: string): Promise<Recall | null>;
  // Writes the recall's file, then its row in recalls.json. Slugs must be unique: a clash throws.
  putRecall(recall: Recall): Promise<void>;
  listRecalls(): Promise<RecallSummary[]>;
  getClaim(id: string): Promise<Claim | null>;
  // Writes the claim's file, then its row in index.json.
  putClaim(claim: Claim): Promise<void>;
  // Reads the claim and saves change's result only if the claim hasn't changed since; when it has, reads it again and
  // re-runs change. Returns the saved claim, or null when the claim is missing or change returns null.
  updateClaim(id: string, change: (claim: Claim) => Claim | null): Promise<Claim | null>;
  // Reads index.json only: listing the blob store on every page load costs quota.
  listClaims(): Promise<ClaimSummary[]>;
  putPhoto(key: string, jpeg: Buffer): Promise<void>;
  getPhoto(key: string): Promise<Buffer | null>;
}

export function summarize(c: Claim): ClaimSummary {
  return {
    id: c.id,
    recallId: c.recallId,
    payerId: c.payerId,
    decision: c.decision,
    createdAt: c.createdAt,
    photoHashes: c.photos.map((p) => p.hash),
    payoutStatus: c.payout?.status ?? null,
    ...(c.seeded ? { seeded: true } : {}),
    ...(c.demo ? { demo: true } : {}),
  };
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

// Newest first.
export function upsert(index: ClaimIndex, row: ClaimSummary): ClaimIndex {
  const claims = [row, ...index.claims.filter((c) => c.id !== row.id)];
  claims.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { claims };
}

// Ids arrive from URLs: validate before they become paths, so "../" can't escape the store.
const PhotoKey = z.string().regex(/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\.jpg$/);

export const paths = {
  index: "index.json",
  recallIndex: "recalls.json",
  recall: (id: string) => `recalls/${RecallId.parse(id)}.json`,
  claim: (id: string) => `claims/${ClaimId.parse(id)}.json`,
  photo: (key: string) => `photos/${PhotoKey.parse(key)}`,
};

export const isValidRecallId = (id: string) => RecallId.safeParse(id).success;
export const isValidClaimId = (id: string) => ClaimId.safeParse(id).success;
