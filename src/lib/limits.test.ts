import { describe, expect, it } from "vitest";
import { claimRefusal, nextUtcDay, parseRefusal, refusalQuery, retryIn, utcDay, type Limits } from "./limits";

const NOW = new Date("2026-11-07T18:30:00.000Z");
const TOMORROW = new Date("2026-11-08T00:00:00.000Z");
const LIMITS: Limits = { vision: 100, draft: 20, claimsPerDay: 6, claimsPerMonth: 10, accountClaimsPerDay: 2, accountDemosPerDay: 3 };

const row = (createdAt: string, over: { payerId?: string; demo?: boolean; seeded?: boolean } = {}) => ({ payerId: "PAYER1", createdAt, ...over });
const refuse = (rows: ReturnType<typeof row>[], over: { payerId?: string; demo?: boolean; visionUsed?: number; limits?: Partial<Limits> } = {}) =>
  claimRefusal(rows, { payerId: over.payerId ?? "PAYER1", demo: over.demo ?? false, now: NOW, limits: { ...LIMITS, ...over.limits }, visionUsed: over.visionUsed });

describe("utc days", () => {
  it("names the UTC day and finds the next one, across a month end", () => {
    expect(utcDay(new Date("2026-11-07T23:59:59.999Z"))).toBe("2026-11-07");
    expect(nextUtcDay(NOW)).toEqual(TOMORROW);
    expect(nextUtcDay(new Date("2026-11-30T05:00:00.000Z"))).toEqual(new Date("2026-12-01T00:00:00.000Z"));
  });
});

describe("claimRefusal", () => {
  it("lets a start through under every limit", () => {
    expect(refuse([row("2026-11-07T10:00:00.000Z")])).toBeNull();
  });

  it("refuses an account's third real start today, until the next UTC day; yesterday's don't count", () => {
    const rows = [row("2026-11-06T23:59:00.000Z"), row("2026-11-07T00:00:00.000Z"), row("2026-11-07T09:00:00.000Z")];
    expect(refuse(rows)).toEqual({ kind: "account", limit: 2, until: TOMORROW });
    expect(refuse(rows, { payerId: "PAYER2" })).toBeNull();
  });

  it("counts an account's demo and real claims apart", () => {
    const real = [row("2026-11-07T01:00:00.000Z"), row("2026-11-07T02:00:00.000Z")];
    expect(refuse(real, { demo: true })).toBeNull();
    const demos = [1, 2, 3].map((h) => row(`2026-11-07T0${h}:00:00.000Z`, { demo: true }));
    expect(refuse(demos, { demo: true })).toMatchObject({ kind: "account", limit: 3 });
    expect(refuse(demos)).toBeNull();
  });

  it("never counts seeded claims", () => {
    const seeded = Array.from({ length: 20 }, (_, i) => row(`2026-11-07T0${i % 10}:00:00.000Z`, { seeded: true }));
    expect(refuse(seeded)).toBeNull();
  });

  it("refuses everyone once today's claims reach the daily total", () => {
    const rows = Array.from({ length: 6 }, (_, i) => row(`2026-11-07T0${i}:00:00.000Z`, { payerId: `OTHER${i}`, demo: i % 2 === 0 }));
    expect(refuse(rows)).toEqual({ kind: "daily", limit: 6, until: TOMORROW });
    expect(refuse(rows, { demo: true })).toMatchObject({ kind: "daily" });
  });

  it("refuses at the 30-day total until enough of those claims turn 30 days old", () => {
    // 10 claims over the past weeks, none today: the 30-day total is full.
    const rows = Array.from({ length: 10 }, (_, i) => row(new Date(Date.UTC(2026, 9, 10 + i * 2)).toISOString(), { payerId: `OTHER${i}` }));
    // The oldest (10 Oct) leaves the window on 9 Nov; then one start fits.
    expect(refuse(rows)).toEqual({ kind: "monthly", limit: 10, until: new Date("2026-11-09T00:00:00.000Z") });
    // Two over: the second oldest (12 Oct) has to leave too.
    expect(refuse([...rows, row("2026-10-30T00:00:00.000Z", { payerId: "X" })])?.until).toEqual(new Date("2026-11-11T00:00:00.000Z"));
    // Claims older than 30 days don't count.
    expect(refuse(rows.slice(1).concat(row("2026-10-01T00:00:00.000Z", { payerId: "OLD" })))).toBeNull();
  });

  it("refuses a demo start once today's photo checks are used up, but not a real one", () => {
    expect(refuse([], { demo: true, visionUsed: 100 })).toEqual({ kind: "checks", limit: 100, until: TOMORROW });
    expect(refuse([], { demo: true, visionUsed: 99 })).toBeNull();
    expect(refuse([], { visionUsed: 100 })).toBeNull();
  });

  it("names the limit that lasts longest when several are hit", () => {
    const rows = Array.from({ length: 10 }, (_, i) => row(`2026-11-07T0${i}:00:00.000Z`));
    expect(refuse(rows)).toEqual({ kind: "monthly", limit: 10, until: new Date("2026-12-07T00:00:00.000Z") });
  });

  it("refuses everything with a limit of 0", () => {
    expect(refuse([], { limits: { claimsPerMonth: 0 } })).toMatchObject({ kind: "monthly" });
    expect(refuse([], { limits: { accountClaimsPerDay: 0 } })).toMatchObject({ kind: "account" });
  });
});

describe("retryIn", () => {
  it("says hours within a day and days beyond", () => {
    expect(retryIn(TOMORROW, NOW)).toBe("in about 6 hours");
    expect(retryIn(new Date(NOW.getTime() + 40 * 60_000), NOW)).toBe("in under an hour");
    expect(retryIn(new Date("2026-11-09T00:00:00.000Z"), NOW)).toBe("in 2 days");
  });
});

describe("refusal query", () => {
  it("round-trips through the redirect's query string", () => {
    const refusal = { kind: "account" as const, limit: 5, until: TOMORROW };
    const query = Object.fromEntries(new URLSearchParams(refusalQuery(refusal)));
    expect(parseRefusal(query, NOW)).toEqual(refusal);
  });

  it("ignores missing, malformed and expired refusals", () => {
    const until = TOMORROW.toISOString();
    expect(parseRefusal({}, NOW)).toBeNull();
    expect(parseRefusal({ limit: "everything", n: "5", until }, NOW)).toBeNull();
    expect(parseRefusal({ limit: "daily", n: "-1", until }, NOW)).toBeNull();
    expect(parseRefusal({ limit: "daily", n: "5", until: "soon" }, NOW)).toBeNull();
    expect(parseRefusal({ limit: "daily", n: "5", until: ["a", "b"] }, NOW)).toBeNull();
    expect(parseRefusal({ limit: "daily", n: "5", until }, new Date("2026-11-08T00:00:01.000Z"))).toBeNull();
  });
});
