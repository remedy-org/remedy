import type { Store } from "../store";
import type { Claim } from "../types";
import { getPayoutStatus } from "./payouts";

// PayPal's later word on a payout, written back into the claim. Shared by the webhook (src/app/api/webhooks/paypal)
// and the console's refresh on read, so both follow the same rules.

// Item and batch statuses PayPal never moves on from, except that a sent payout can still be refunded or reversed.
const TERMINAL = new Set(["SUCCESS", "FAILED", "RETURNED", "BLOCKED", "DENIED", "CANCELED", "REFUNDED", "REVERSED"]);
const AFTER_SUCCESS = new Set(["REFUNDED", "REVERSED"]);

export const isTerminal = (status: string) => TERMINAL.has(status);

// Seeded claims carry made-up SEED batch ids and were never sent, so PayPal has nothing to say about them.
const wasSent = (c: Pick<Claim, "payout" | "seeded">) => Boolean(c.payout) && !c.seeded && !c.payout?.batchId.startsWith("SEED");

export interface StatusUpdate {
  status: string;
  itemId?: string;
  // When PayPal reported it: the event's create_time, or the time of a live check.
  at: Date;
}

/** The claim with PayPal's new status, or null when nothing changes: a duplicate, a seeded claim, a terminal status
 * going anywhere but SUCCESS to REFUNDED or REVERSED, or a settling status older than the stored one. */
export function applyPayoutStatus(claim: Claim, update: StatusUpdate): Claim | null {
  const payout = claim.payout;
  if (!payout || !wasSent(claim) || !update.status || update.status === payout.status) return null;
  if (isTerminal(payout.status) && !(payout.status === "SUCCESS" && AFTER_SUCCESS.has(update.status))) return null;
  // Webhooks arrive out of order and are retried: a settling status only replaces a stored one it is newer than.
  if (!isTerminal(update.status) && !(update.at.getTime() > Date.parse(payout.updatedAt))) return null;
  const at = new Date(Math.max(update.at.getTime(), Date.parse(payout.updatedAt))).toISOString();
  return {
    ...claim,
    payout: { ...payout, ...(update.itemId && !payout.itemId ? { itemId: update.itemId } : {}), status: update.status, updatedAt: at },
    events: [...claim.events, { at, type: "payout_updated", detail: `PayPal: ${update.status}` }],
  };
}

/** Reads the claim fresh, applies the update and saves it. Claim ids repeat across stores, so the claim must still be
 * paid by this batch. Returns the saved claim, or null when nothing changed. */
export async function savePayoutStatus(store: Store, claimId: string, batchId: string, update: StatusUpdate): Promise<Claim | null> {
  const claim = await store.getClaim(claimId);
  if (!claim || claim.payout?.batchId !== batchId) return null;
  const next = applyPayoutStatus(claim, update);
  if (next) await store.putClaim(next);
  return next;
}

function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export interface RefreshOptions {
  check?: typeof getPayoutStatus;
  limit?: number;
  timeoutMs?: number;
  now?: () => Date;
}

/** Asks PayPal again about up to `limit` sent payouts that haven't settled, in parallel, each bounded by `timeoutMs`.
 * Changes are saved; a slow or failed check keeps the stored status. Returns the claims, updated where PayPal moved. */
export async function refreshPayouts(store: Store, claims: Claim[], { check = getPayoutStatus, limit = 10, timeoutMs = 3000, now = () => new Date() }: RefreshOptions = {}): Promise<Claim[]> {
  const due = claims.filter((c) => wasSent(c) && !isTerminal(c.payout!.status)).slice(0, limit);
  const checked = await Promise.allSettled(due.map((c) => within(check(c.payout!.batchId), timeoutMs)));
  const fresh = new Map<string, Claim>();
  // Saved one at a time: each save rewrites the shared index.
  for (const [i, result] of checked.entries()) {
    if (result.status !== "fulfilled") continue;
    const { itemId, itemStatus, batchStatus } = result.value;
    try {
      const saved = await savePayoutStatus(store, due[i].id, due[i].payout!.batchId, { status: itemStatus ?? batchStatus, itemId, at: now() });
      if (saved) fresh.set(saved.id, saved);
    } catch {
      // The stored status stands; the next load tries again.
    }
  }
  return claims.map((c) => fresh.get(c.id) ?? c);
}
