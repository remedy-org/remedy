import "server-only";
import { canSee, canSeeClaim, pickRecall } from "@/app/console/_lib/workspace";
import { getAppStore } from "@/lib/demo";
import type { Session } from "@/lib/session";
import type { Claim, Recall } from "@/lib/types";

export interface InsightsLoad {
  recall: Recall | null;
  recalls: Recall[];
  claims: Claim[];
  // Claim ids in the index whose files couldn't be read: shown as a partial state, never hidden.
  unreadable: string[];
}

// Read only: the recalls this company may see and one recall's claims, straight from the store. Unlike the claims
// page it never asks PayPal for payout updates, so opening Insights writes nothing and calls nobody.
export async function loadInsights(session: Session, wanted: string | string[] | undefined): Promise<InsightsLoad> {
  const store = await getAppStore();
  const rows = (await store.listRecalls()).filter((r) => canSee(r, session));
  const recalls = (await Promise.all(rows.map((r) => store.getRecall(r.id).catch(() => null)))).filter((r): r is Recall => r !== null);
  const recall = pickRecall(recalls, wanted);
  if (!recall) return { recall: null, recalls, claims: [], unreadable: [] };

  const index = (await store.listClaims()).filter((r) => r.recallId === recall.id).filter(canSeeClaim(recall, session));
  const read = await Promise.allSettled(index.map((r) => store.getClaim(r.id)));
  const claims: Claim[] = [];
  const unreadable: string[] = [];
  read.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) claims.push(r.value);
    else unreadable.push(index[i].id);
  });
  claims.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { recall, recalls, claims, unreadable };
}
