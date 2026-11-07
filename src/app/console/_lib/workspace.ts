import "server-only";
import { getAppStore } from "@/lib/demo";
import { isTerminal, refreshPayouts } from "@/lib/paypal/status";
import type { Session } from "@/lib/session";
import type { Store } from "@/lib/store";
import { summarize, type ClaimSummary } from "@/lib/store/store";
import type { Claim, Recall } from "@/lib/types";

// What a signed-in company can see: its own recalls plus the shared Kikea demo recall (owner null).
export const canSee = (recall: Pick<Recall, "owner">, session: Pick<Session, "payerId">) => recall.owner === null || recall.owner === session.payerId;

export interface Workspace {
  store: Store;
  recalls: Recall[];
  // Recall files listed in recalls.json that couldn't be read: shown as a partial state, never hidden.
  unreadable: string[];
}

// Recalls come through the recall cache, except the company's own: those are the ones that change, and the console
// must show their current refund and auto-pay. The shared demo recall's settings are fixed. A wanted recall the
// cached list doesn't have yet (published a moment ago on another instance) is looked up fresh.
export async function loadWorkspace(session: Session, wanted?: string | string[]): Promise<Workspace> {
  const store = await getAppStore();
  const id = Array.isArray(wanted) ? wanted[0] : wanted;
  let listed = await store.listRecalls();
  if (id && !listed.some((r) => r.id === id)) listed = await store.listRecalls({ fresh: true });
  const rows = listed.filter((r) => canSee(r, session));
  const read = await Promise.allSettled(rows.map((r) => store.getRecall(r.id, { fresh: r.owner !== null })));
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

// On the shared demo recall every signed-in company is a different judge, so a company sees the seeded samples, the
// demo claims (public sample photos, sandbox money) and real claims from its own PayPal account, never another
// person's camera photos. A company's own recall shows every claim.
export const canSeeClaim = (recall: Pick<Recall, "owner">, session: Pick<Session, "payerId">) => (c: Pick<ClaimSummary, "seeded" | "demo" | "payerId">) =>
  recall.owner !== null || Boolean(c.seeded) || Boolean(c.demo) || c.payerId === session.payerId;

// When this instance last asked PayPal about a claim's payout. A payout that stays unsettled is asked about at most
// once a minute per instance, not on every load: each ask reads the claim file.
const PAYOUT_RECHECK_MS = 60_000;
const payoutChecked = new Map<string, number>();

// Every claim for one recall that this company may see, newest first, from index.json alone: its rows carry what the
// grid, the stats and the report show. Payouts PayPal hasn't settled are checked again (a few, briefly), so the grid
// is right without webhooks; only those claims' files are read.
export async function loadClaims(store: Store, recall: Recall, session: Pick<Session, "payerId">, now = Date.now()): Promise<ClaimSummary[]> {
  const rows = (await store.listClaims()).filter((r) => r.recallId === recall.id).filter(canSeeClaim(recall, session));
  const due = rows
    .filter((r) => r.decision === "paid" && !r.seeded && r.payoutStatus !== null && !isTerminal(r.payoutStatus))
    .filter((r) => now - (payoutChecked.get(r.id) ?? 0) >= PAYOUT_RECHECK_MS)
    .slice(0, 10);
  if (!due.length) return rows;
  due.forEach((r) => payoutChecked.set(r.id, now));
  const read = await Promise.allSettled(due.map((r) => store.getClaim(r.id)));
  const claims = read.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
  const fresh = new Map((await refreshPayouts(store, claims)).map((c) => [c.id, summarize(c)]));
  return rows.map((r) => fresh.get(r.id) ?? r);
}

// A claim the company may open: its recall must be in the workspace. fresh reads the recall past the recall cache,
// for the drawer and the reviews, which show and pay its current refund.
export async function loadClaimFor(session: Session, claimId: string, { fresh = false } = {}): Promise<{ store: Store; claim: Claim; recall: Recall } | null> {
  const store = await getAppStore();
  const claim = await store.getClaim(claimId);
  if (!claim) return null;
  const recall = await store.getRecall(claim.recallId, { fresh });
  if (!recall || !canSee(recall, session) || !canSeeClaim(recall, session)(claim)) return null;
  return { store, claim, recall };
}

// A recall the company may open. Only its own can be changed: the shared demo recall's settings are fixed (see the
// PATCH route), or one judge's edit would change the demo for every other. Read fresh: the settings form and the
// PATCH change what they read.
export async function loadRecallFor(session: Session, recallId: string): Promise<{ store: Store; recall: Recall } | null> {
  const store = await getAppStore();
  const recall = await store.getRecall(recallId, { fresh: true });
  if (!recall || !canSee(recall, session)) return null;
  return { store, recall };
}
