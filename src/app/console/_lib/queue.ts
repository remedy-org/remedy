import "server-only";
import { duplicateOfRow } from "@/app/api/claims/_lib/pipeline";
import { getAppStore } from "@/lib/demo";
import type { Session } from "@/lib/session";
import type { ClaimSummary } from "@/lib/store";
import type { Recall } from "@/lib/types";
import { sealedPhotoUrl } from "./photoToken";
import { toRow, type ClaimRow } from "./view";
import { canSee, listedClaims, type Viewer } from "./workspace";

/** The grid's rows for one company: each photo's URLs carry a sealed ticket, so thumbnails never open a claim file. */
export function gridRows(claims: ClaimSummary[], recall: Recall, session: Pick<Session, "payerId">, now = Date.now()): ClaimRow[] {
  return claims.map((c) =>
    toRow(
      c,
      recall,
      (key, n) => {
        const base = sealedPhotoUrl(c.id, n, key, session.payerId, now);
        return { thumb: `${base}&w=96`, large: `${base}&w=240` };
      },
      copiedFrom(c, claims),
    ),
  );
}

/**
 * A claim blocked for a reused photo: the earlier claim its photo matched, among the claims it was checked against
 * (duplicateOfRow: a demo claim meets only its own round's), so the grid's line names the claim the panel and the owner's
 * result name.
 */
export function copiedFrom(c: ClaimSummary, claims: ClaimSummary[]): string | null {
  if (c.decision !== "blocked" || c.reason?.check !== "duplicate_photo") return null;
  return duplicateOfRow(c, claims)?.id ?? null;
}

export interface Queue {
  recall: Recall;
  rows: ClaimRow[];
}

/**
 * What the claims page polls: one recall's rows from index.json, and nothing else. Recalls come through the
 * instance's recall cache (a cold instance reads recalls.json and the recall once a minute), so a poll costs 1 Blob
 * read warm and at most 3 cold. Unlike loadClaims it never reads a claim file or asks PayPal: a settling payout
 * changes its row when the webhook (or the next full page load) saves it.
 */
export async function loadQueue(session: Viewer, wanted: string | null): Promise<Queue | null> {
  const store = await getAppStore();
  let listed = await store.listRecalls();
  if (wanted && !listed.some((r) => r.id === wanted)) listed = await store.listRecalls({ fresh: true });
  const visible = listed.filter((r) => canSee(r, session));
  const row = wanted ? visible.find((r) => r.id === wanted) : visible[0];
  if (!row) return null;
  const recall = await store.getRecall(row.id);
  if (!recall || !canSee(recall, session)) return null;
  const claims = listedClaims(await store.listClaims(), recall, session);
  return { recall, rows: gridRows(claims, recall, session) };
}
