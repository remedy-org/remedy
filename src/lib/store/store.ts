import { z } from "zod";
import { ClaimId, Decision, RecallId, type Claim, type Recall } from "../types";

// One row per claim in index.json: enough for the dashboard and the pre-checks without opening every claim.
export const ClaimSummary = z.object({
  id: ClaimId,
  recallId: RecallId,
  payerId: z.string(),
  decision: Decision,
  createdAt: z.iso.datetime(),
  photoHashes: z.array(z.string()),
  payoutStatus: z.string().nullable(),
});
export type ClaimSummary = z.infer<typeof ClaimSummary>;

export const ClaimIndex = z.object({ claims: z.array(ClaimSummary) });
export type ClaimIndex = z.infer<typeof ClaimIndex>;

export interface Store {
  getRecall(id: string): Promise<Recall | null>;
  putRecall(recall: Recall): Promise<void>;
  getClaim(id: string): Promise<Claim | null>;
  // Writes the claim's file, then its row in index.json.
  putClaim(claim: Claim): Promise<void>;
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
  };
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
  recall: (id: string) => `recalls/${RecallId.parse(id)}.json`,
  claim: (id: string) => `claims/${ClaimId.parse(id)}.json`,
  photo: (key: string) => `photos/${PhotoKey.parse(key)}`,
};

export const isValidRecallId = (id: string) => RecallId.safeParse(id).success;
export const isValidClaimId = (id: string) => ClaimId.safeParse(id).success;
