import "server-only";
import { getAppStore } from "@/lib/demo";
import { refreshPayouts } from "@/lib/paypal/status";
import type { Session } from "@/lib/session";
import type { Store } from "@/lib/store";
import type { ClaimSummary } from "@/lib/store";
import type { Claim, Recall } from "@/lib/types";

// What a signed-in company can see: its own recalls plus the shared Kikea demo recall (owner null).
export const canSee = (recall: Pick<Recall, "owner">, session: Pick<Session, "payerId">) => recall.owner === null || recall.owner === session.payerId;

export interface Workspace {
  store: Store;
  recalls: Recall[];
  // Recall files listed in recalls.json that couldn't be read: shown as a partial state, never hidden.
  unreadable: string[];
}

export async function loadWorkspace(session: Session): Promise<Workspace> {
  const store = await getAppStore();
  const rows = (await store.listRecalls()).filter((r) => canSee(r, session));
  const read = await Promise.allSettled(rows.map((r) => store.getRecall(r.id)));
  const recalls: Recall[] = [];
  const unreadable: string[] = [];
  read.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) recalls.push(r.value);
    else unreadable.push(rows[i].id);
  });
  return { store, recalls, unreadable };
}

// ?recall=<id> if it's one of the workspace's, else the first (the demo recall leads: recalls.json is oldest first).
export function pickRecall(recalls: Recall[], wanted: string | string[] | undefined): Recall | null {
  const id = Array.isArray(wanted) ? wanted[0] : wanted;
  return recalls.find((r) => r.id === id) ?? recalls[0] ?? null;
}

export interface RecallClaims {
  claims: Claim[];
  // Claim ids in the index whose files couldn't be read.
  unreadable: string[];
}

// On the shared demo recall every signed-in company is a different judge, so a company sees the seeded samples, the
// demo claims (public sample photos, sandbox money) and real claims from its own PayPal account, never another
// person's camera photos. A company's own recall shows every claim.
export const canSeeClaim = (recall: Pick<Recall, "owner">, session: Pick<Session, "payerId">) => (c: Pick<ClaimSummary, "seeded" | "demo" | "payerId">) =>
  recall.owner !== null || Boolean(c.seeded) || Boolean(c.demo) || c.payerId === session.payerId;

// Every claim for one recall that this company may see, newest first. The index has no reasons or amounts, so each
// claim file is read. Payouts PayPal hasn't settled are checked again (a few, briefly), so the grid is right without
// webhooks.
export async function loadClaims(store: Store, recall: Recall, session: Pick<Session, "payerId">): Promise<RecallClaims> {
  const rows = (await store.listClaims()).filter((r) => r.recallId === recall.id).filter(canSeeClaim(recall, session));
  const read = await Promise.allSettled(rows.map((r) => store.getClaim(r.id)));
  const claims: Claim[] = [];
  const unreadable: string[] = [];
  read.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) claims.push(r.value);
    else unreadable.push(rows[i].id);
  });
  claims.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { claims: await refreshPayouts(store, claims), unreadable };
}

// A claim the company may open: its recall must be in the workspace.
export async function loadClaimFor(session: Session, claimId: string): Promise<{ store: Store; claim: Claim; recall: Recall } | null> {
  const store = await getAppStore();
  const claim = await store.getClaim(claimId);
  if (!claim) return null;
  const recall = await store.getRecall(claim.recallId);
  if (!recall || !canSee(recall, session) || !canSeeClaim(recall, session)(claim)) return null;
  return { store, claim, recall };
}

// A recall the company may open. Only its own can be changed: the shared demo recall's settings are fixed (see the
// PATCH route), or one judge's edit would change the demo for every other.
export async function loadRecallFor(session: Session, recallId: string): Promise<{ store: Store; recall: Recall } | null> {
  const store = await getAppStore();
  const recall = await store.getRecall(recallId);
  if (!recall || !canSee(recall, session)) return null;
  return { store, recall };
}
