import { describe, expect, it } from "vitest";
import { abandonedDemo, claimRefusal, nextUtcDay, parseRefusal, refusalQuery, retryIn, utcDay, type Limits } from "./limits";

const NOW = new Date("2026-11-07T18:30:00.000Z");
const TOMORROW = new Date("2026-11-08T00:00:00.000Z");
const LIMITS: Limits = { vision: 100, draft: 20, claimsPerDay: 6, claimsPerMonth: 10, accountClaimsPerDay: 2, accountDemosPerDay: 3, demosPerDay: 1000, demosPerMonth: 1000 };

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

  it("leaves a demo start out once its camera session ended with no photo sent; never a real one", () => {
    const left = { createdAt: "2026-11-07T18:15:00.000Z", decision: "pending" as const, photoHashes: [] };
    const demos = [1, 2, 3].map((h) => ({ ...row(`2026-11-07T1${h}:00:00.000Z`, { demo: true }), ...left }));
    expect(refuse(demos, { demo: true })).toBeNull();
    // Still inside its 10-minute session, or with its photo in: it counts.
    expect(refuse(demos.map((d) => ({ ...d, createdAt: "2026-11-07T18:25:00.000Z" })), { demo: true })).toMatchObject({ kind: "account", limit: 3 });
    expect(refuse(demos.map((d) => ({ ...d, photoHashes: ["0123456789abcdef"] })), { demo: true })).toMatchObject({ kind: "account", limit: 3 });
    expect(abandonedDemo({ ...left, demo: true }, NOW)).toBe(true);
    expect(abandonedDemo({ ...left, demo: false }, NOW)).toBe(false);
    expect(abandonedDemo({ ...left, demo: true, decision: "held" }, NOW)).toBe(false);
    // Real starts left the same way keep counting.
    const real = [1, 2].map((h) => ({ ...row(`2026-11-07T1${h}:00:00.000Z`), ...left }));
    expect(refuse(real)).toMatchObject({ kind: "account", limit: 2 });
  });

  it("never counts seeded claims", () => {
    const seeded = Array.from({ length: 20 }, (_, i) => row(`2026-11-07T0${i % 10}:00:00.000Z`, { seeded: true }));
    expect(refuse(seeded)).toBeNull();
  });

  it("refuses every real start once today's real claims reach the daily total", () => {
    const rows = Array.from({ length: 6 }, (_, i) => row(`2026-11-07T0${i}:00:00.000Z`, { payerId: `OTHER${i}` }));
    expect(refuse(rows)).toEqual({ kind: "daily", limit: 6, until: TOMORROW });
    expect(refuse(rows.slice(1))).toBeNull();
  });

  it("never counts demo claims towards the daily or 30-day totals, so judges can't lock real owners out", () => {
    // Far more demo claims than either total, today and over the month, from the judges' one shared login.
    const demos = Array.from({ length: 40 }, (_, i) => row(new Date(Date.UTC(2026, 10, 7, 0, i)).toISOString(), { payerId: "JUDGES", demo: true }));
    const older = Array.from({ length: 20 }, (_, i) => row(new Date(Date.UTC(2026, 9, 20 + (i % 15))).toISOString(), { payerId: "JUDGES", demo: true }));
    expect(refuse([...demos, ...older])).toBeNull();
    // A real owner still meets the real totals as before.
    const real = Array.from({ length: 6 }, (_, i) => row(`2026-11-07T0${i}:00:00.000Z`, { payerId: `OWNER${i}` }));
    expect(refuse([...demos, ...real])).toMatchObject({ kind: "daily", limit: 6 });
  });

  it("lets demo claims run when the real totals are full, up to the account's own demo limit", () => {
    const real = Array.from({ length: 10 }, (_, i) => row(`2026-11-07T0${i}:00:00.000Z`, { payerId: `OWNER${i}` }));
    expect(refuse(real)).toMatchObject({ kind: "monthly" });
    expect(refuse(real, { demo: true })).toBeNull();
    const demos = [1, 2, 3].map((h) => row(`2026-11-07T1${h}:00:00.000Z`, { demo: true }));
    expect(refuse([...real, ...demos], { demo: true })).toEqual({ kind: "account", limit: 3, until: TOMORROW });
    // Another sandbox account has its own demo limit.
    expect(refuse([...real, ...demos], { demo: true, payerId: "PAYER2" })).toBeNull();
    // Yesterday's demo runs don't count.
    expect(refuse([row("2026-11-06T23:00:00.000Z", { demo: true }), ...demos.slice(1)], { demo: true })).toBeNull();
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

  it("caps demo claims for every account together, a day and in any 30 days, abandoned starts included", () => {
    // Two accounts, one start each sent and one left before its photo an hour ago: all four cost Blob writes.
    const demo = (createdAt: string, payerId: string, photoHashes: string[]) => ({ ...row(createdAt, { payerId, demo: true }), decision: "pending" as const, photoHashes });
    const rows = [demo("2026-11-07T17:00:00.000Z", "PAYER1", []), demo("2026-11-07T17:10:00.000Z", "PAYER1", ["a"]), demo("2026-11-07T17:20:00.000Z", "PAYER2", []), demo("2026-11-07T17:30:00.000Z", "PAYER2", ["b"])];
    expect(refuse(rows, { demo: true, payerId: "PAYER3", limits: { demosPerDay: 4 } })).toEqual({ kind: "daily", limit: 4, until: TOMORROW });
    expect(refuse(rows, { demo: true, payerId: "PAYER3", limits: { demosPerDay: 5 } })).toBeNull();
    // The account's own daily count still leaves its abandoned start out.
    expect(refuse(rows, { demo: true, limits: { accountDemosPerDay: 2 } })).toBeNull();
    const month = refuse(rows, { demo: true, payerId: "PAYER3", limits: { demosPerMonth: 4 } });
    expect(month).toEqual({ kind: "monthly", limit: 4, until: new Date(Date.parse("2026-11-07T17:00:00.000Z") + 30 * 86_400_000) });
    // Real claims never meet the demo totals.
    expect(refuse(rows, { limits: { demosPerDay: 0, demosPerMonth: 0 } })).toBeNull();
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
