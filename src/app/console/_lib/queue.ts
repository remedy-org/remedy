import "server-only";
import { getAppStore } from "@/lib/demo";
import type { Session } from "@/lib/session";
import type { ClaimSummary } from "@/lib/store";
import type { Recall } from "@/lib/types";
import { sealedPhotoUrl } from "./photoToken";
import { toRow, type ClaimRow } from "./view";
import { canSee, canSeeClaim } from "./workspace";

/** The grid's rows for one company: each photo's URLs carry a sealed ticket, so thumbnails never open a claim file. */
export function gridRows(claims: ClaimSummary[], recall: Recall, session: Pick<Session, "payerId">, now = Date.now()): ClaimRow[] {
  return claims.map((c) =>
    toRow(c, recall, (key, n) => {
      const base = sealedPhotoUrl(c.id, n, key, session.payerId, now);
      return { thumb: `${base}&w=96`, large: `${base}&w=240` };
    }),
  );
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
export async function loadQueue(session: Pick<Session, "payerId">, wanted: string | null): Promise<Queue | null> {
  const store = await getAppStore();
  let listed = await store.listRecalls();
  if (wanted && !listed.some((r) => r.id === wanted)) listed = await store.listRecalls({ fresh: true });
  const visible = listed.filter((r) => canSee(r, session));
  const row = wanted ? visible.find((r) => r.id === wanted) : visible[0];
  if (!row) return null;
  const recall = await store.getRecall(row.id);
  if (!recall || !canSee(recall, session)) return null;
  const claims = (await store.listClaims()).filter((c) => c.recallId === recall.id).filter(canSeeClaim(recall, session));
  return { recall, rows: gridRows(claims, recall, session) };
}
