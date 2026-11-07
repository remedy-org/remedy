import "server-only";
import { isDeepStrictEqual } from "node:util";
import { recoverStale, STALE_AFTER_MS } from "@/app/api/claims/_lib/pipeline";
import { getAppStore } from "@/lib/demo";
import { CAPTURE_SESSION_MINUTES } from "@/lib/ids";
import { abandonedDemo } from "@/lib/limits";
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

// Recalls come through the recall cache, except the one shown when it's the company's own: its refund and auto-pay
// change, and the console must show them as they are. The others only name themselves in the picker, and the shared
// demo recall's settings are fixed. A wanted recall the cached list doesn't have yet (published a moment ago on
// another instance) is looked up fresh.
export async function loadWorkspace(session: Session, wanted?: string | string[]): Promise<Workspace> {
  const store = await getAppStore();
  const id = Array.isArray(wanted) ? wanted[0] : wanted;
  let listed = await store.listRecalls();
  if (id && !listed.some((r) => r.id === id)) listed = await store.listRecalls({ fresh: true });
  const rows = listed.filter((r) => canSee(r, session));
  // pickRecall's choice.
  const shown = rows.find((r) => r.id === id) ?? rows[0];
  const read = await Promise.allSettled(rows.map((r) => store.getRecall(r.id, { fresh: r === shown && r.owner !== null })));
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

/**
 * One recall's rows as the console lists them, from index.json: the claims this company may see, less the judges' demo
 * starts left before a photo was sent (abandonedDemo), which hold no evidence and no money. The queue, Insights and the
 * report all list through here, so their totals agree.
 */
export const listedClaims = <R extends ClaimSummary>(rows: R[], recall: Recall, session: Pick<Session, "payerId">, now = Date.now()): R[] =>
  rows.filter((r) => r.recallId === recall.id && canSeeClaim(recall, session)(r) && !abandonedDemo(r, new Date(now)));

// When this instance last read a claim whose row looks out of date. A payout that stays unsettled is asked about at
// most once a minute per instance, not on every load: each ask reads the claim file.
const RECHECK_MS = 60_000;
const lastChecked = new Map<string, number>();

// A payout PayPal hasn't settled: PayPal is asked again.
const settling = (r: ClaimSummary) => r.decision === "paid" && r.payoutStatus !== null && !isTerminal(r.payoutStatus);
// A claim can't still be checking this long after it was created: its camera session is over, and its own page holds
// a check that died (recoverStale). The row missed a later write, or nobody has looked since the check died.
const STUCK_AFTER_MS = CAPTURE_SESSION_MINUTES * 60_000 + STALE_AFTER_MS;
const stuck = (r: ClaimSummary, now: number) => r.decision === "pending" && r.photoHashes.length > 0 && now - Date.parse(r.createdAt) >= STUCK_AFTER_MS;

// Every claim for one recall that this company may see, newest first, from index.json alone: its rows carry what the
// grid, the stats and the report show. Rows that can't stay as they are (a payout settling, a check stuck) are read
// again (a few, briefly), so the grid is right without webhooks; only those claims' files are read.
export async function loadClaims(store: Store, recall: Recall, session: Pick<Session, "payerId">, now = Date.now()): Promise<ClaimSummary[]> {
  const rows = listedClaims(await store.listClaims(), recall, session, now);
  const due = rows
    .filter((r) => !r.seeded && (settling(r) || stuck(r, now)))
    .filter((r) => now - (lastChecked.get(r.id) ?? 0) >= RECHECK_MS)
    .slice(0, 10);
  if (!due.length) return rows;
  due.forEach((r) => lastChecked.set(r.id, now));
  const read = await Promise.allSettled(due.map((r) => store.getClaim(r.id)));
  const claims = read.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
  const deps = { store, now: () => new Date(now) };
  const recovered = await Promise.all(claims.map((c) => recoverStale(deps, c).catch(() => c)));
  const latest = await refreshPayouts(store, recovered);
  // A save above wrote its own row. A claim nothing changed can still disagree with its row, when the row's write
  // failed or lost a race after the claim's: write the row again, so the next view is right without a read. One at a
  // time, as each rewrites the shared index.
  const row = new Map(rows.map((r) => [r.id, r]));
  for (const [i, c] of latest.entries()) {
    if (c !== claims[i] || isDeepStrictEqual(summarize(c), row.get(c.id))) continue;
    await store.reindexClaim(c).catch(() => false);
  }
  const fresh = new Map(latest.map((c) => [c.id, summarize(c)]));
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
