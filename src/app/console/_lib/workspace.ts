import "server-only";
import { getAppStore } from "@/lib/demo";
import type { Session } from "@/lib/session";
import type { Store } from "@/lib/store";
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

// Every claim for one recall, newest first. The index has no reasons or amounts, so each claim file is read.
export async function loadClaims(store: Store, recallId: string): Promise<RecallClaims> {
  const rows = (await store.listClaims()).filter((r) => r.recallId === recallId);
  const read = await Promise.allSettled(rows.map((r) => store.getClaim(r.id)));
  const claims: Claim[] = [];
  const unreadable: string[] = [];
  read.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) claims.push(r.value);
    else unreadable.push(rows[i].id);
  });
  claims.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { claims, unreadable };
}

// A claim the company may open: its recall must be in the workspace.
export async function loadClaimFor(session: Session, claimId: string): Promise<{ store: Store; claim: Claim; recall: Recall } | null> {
  const store = await getAppStore();
  const claim = await store.getClaim(claimId);
  if (!claim) return null;
  const recall = await store.getRecall(claim.recallId);
  if (!recall || !canSee(recall, session)) return null;
  return { store, claim, recall };
}

// Only a company's own recalls can be changed; the shared demo recall is editable by every workspace on purpose,
// so judges can try the settings.
export async function loadRecallFor(session: Session, recallId: string): Promise<{ store: Store; recall: Recall } | null> {
  const store = await getAppStore();
  const recall = await store.getRecall(recallId);
  if (!recall || !canSee(recall, session)) return null;
  return { store, recall };
}
