import { env } from "./env";
import { CAPTURE_SESSION_MINUTES } from "./ids";
import type { ClaimSummary } from "./store";

// What the live demo may spend, so a burst of traffic can't run up the OpenAI bill or Vercel Blob's quota. Model calls
// are counted in the store, one small file per UTC day (Store.takeUsage). Claim starts are counted from index.json,
// which every start reads anyway, so they cost no extra write.

export interface Limits {
  /** Photo checks a day, every claim together. */
  vision: number;
  /** Recall-check drafts a day, every company together. */
  draft: number;
  /** New real claims a day, every recall together. Demo and seeded claims never count. */
  claimsPerDay: number;
  /** New real claims in any 30 days: Blob's quota is monthly, so daily limits alone can't protect it. */
  claimsPerMonth: number;
  /** Real claims one PayPal account can start a day; abandoned and expired ones count too. */
  accountClaimsPerDay: number;
  /** Demo claims one PayPal account can run a day, the demo's own limit. A start left before its photo was sent stops
   * counting once its camera session is over (abandonedDemo). */
  accountDemosPerDay: number;
}

export function limits(): Limits {
  const e = env();
  return {
    vision: e.VISION_DAILY_LIMIT,
    draft: e.DRAFT_DAILY_LIMIT,
    claimsPerDay: e.CLAIM_DAILY_LIMIT,
    claimsPerMonth: e.CLAIM_MONTHLY_LIMIT,
    accountClaimsPerDay: e.ACCOUNT_CLAIM_DAILY_LIMIT,
    accountDemosPerDay: e.ACCOUNT_DEMO_DAILY_LIMIT,
  };
}

const HOUR_MS = 3_600_000;
const MONTH_MS = 30 * 24 * HOUR_MS;

/** The UTC day a time falls on, as the usage file is named: "2026-11-07". */
export const utcDay = (at: Date) => at.toISOString().slice(0, 10);

/** When the next UTC day starts: daily limits reset then. */
export const nextUtcDay = (at: Date) => new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + 1));

export const LIMIT_KINDS = ["account", "daily", "monthly", "checks"] as const;
export type LimitKind = (typeof LIMIT_KINDS)[number];

/** A start refused by a limit: which one, its number, and when a start can succeed again. */
export interface Refusal {
  kind: LimitKind;
  limit: number;
  until: Date;
}

/**
 * Whether a new claim may start, from index.json's rows. Seeded claims never count. Demo and real claims are counted
 * apart, so judges sharing one server and one sandbox login can never use up the claims real owners need: a real start
 * counts the account's real claims today and every real claim towards the daily and 30-day totals; a demo start counts
 * only the account's demo claims today, leaving out the ones abandoned before a photo was sent (abandonedDemo), and is
 * refused once today's photo checks are used up, since its check couldn't run (a real claim still starts, and is held
 * for a person if its check can't run). When several limits are hit, the one that lasts longest.
 */
export function claimRefusal(
  rows: (Pick<ClaimSummary, "payerId" | "createdAt" | "seeded" | "demo"> & Partial<Pick<ClaimSummary, "decision" | "photoHashes">>)[],
  { payerId, demo, now, limits, visionUsed = 0 }: { payerId: string; demo: boolean; now: Date; limits: Limits; visionUsed?: number },
): Refusal | null {
  const counted = rows.filter((r) => !r.seeded && Boolean(r.demo) === demo && !abandonedDemo(r, now));
  const tomorrow = nextUtcDay(now);
  const dayStart = tomorrow.getTime() - 24 * HOUR_MS;
  const today = counted.filter((r) => Date.parse(r.createdAt) >= dayStart);

  const hits: Refusal[] = [];
  const perAccount = demo ? limits.accountDemosPerDay : limits.accountClaimsPerDay;
  if (today.filter((r) => r.payerId === payerId).length >= perAccount) hits.push({ kind: "account", limit: perAccount, until: tomorrow });
  if (demo) {
    if (visionUsed >= limits.vision) hits.push({ kind: "checks", limit: limits.vision, until: tomorrow });
  } else {
    if (today.length >= limits.claimsPerDay) hits.push({ kind: "daily", limit: limits.claimsPerDay, until: tomorrow });
    // Oldest first: the 30-day total drops as the oldest of these turn 30 days old.
    const month = counted.filter((r) => Date.parse(r.createdAt) > now.getTime() - MONTH_MS).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (month.length >= limits.claimsPerMonth) {
      // A start fits once all but limit - 1 of these are older than 30 days.
      const frees = month[month.length - limits.claimsPerMonth];
      hits.push({ kind: "monthly", limit: limits.claimsPerMonth, until: new Date((frees ? Date.parse(frees.createdAt) : now.getTime()) + MONTH_MS) });
    }
  }
  return hits.reduce<Refusal | null>((longest, r) => (!longest || r.until > longest.until ? r : longest), null);
}

/** "1 claim", "5 claims": for the copy that names a limit. */
export const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** "in about 5 hours", "in 3 days": when to try again, without guessing the reader's time zone. */
export function retryIn(until: Date, now: Date): string {
  const hours = Math.ceil((until.getTime() - now.getTime()) / HOUR_MS);
  if (hours <= 1) return "in under an hour";
  if (hours <= 24) return `in about ${hours} hours`;
  return `in ${Math.ceil(hours / 24)} days`;
}

/**
 * A demo claim started and left before its sample photo was sent, its camera session over: it never reached the model,
 * so it costs no photo check. It stops counting towards the account's demo limit, and the console leaves it out of the
 * queue, Insights and the report. Real claims are never abandoned this way: theirs count as they always did.
 */
export function abandonedDemo(r: Pick<ClaimSummary, "demo" | "createdAt"> & Partial<Pick<ClaimSummary, "decision" | "photoHashes">>, now: Date): boolean {
  return r.demo === true && r.decision === "pending" && (r.photoHashes?.length ?? 0) === 0 && now.getTime() - Date.parse(r.createdAt) >= CAPTURE_SESSION_MINUTES * 60_000;
}

/** A refusal as the query string of the page it redirects to, so the page can say which limit and when. */
export const refusalQuery = (r: Refusal) => new URLSearchParams({ limit: r.kind, n: String(r.limit), until: r.until.toISOString() }).toString();

/** The refusal in a page's search params, or null when there is none, it doesn't parse, or it has run out. */
export function parseRefusal(query: Record<string, string | string[] | undefined>, now: Date): Refusal | null {
  const { limit: kind, n, until } = query;
  if (typeof kind !== "string" || !(LIMIT_KINDS as readonly string[]).includes(kind) || typeof n !== "string" || typeof until !== "string") return null;
  const limit = Number(n);
  const at = new Date(until);
  if (!/^\d+$/.test(n) || Number.isNaN(at.getTime()) || at <= now) return null;
  return { kind: kind as LimitKind, limit, until: at };
}
