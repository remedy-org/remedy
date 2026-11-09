import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CHECK_NAMES, fiveNames } from "@/lib/fiveChecks";
import { dHash, hamming } from "@/lib/fingerprint";
import { DEMO_CLAIMS, GENUINE } from "./claims";

vi.mock("server-only", () => ({}));

// A visit two weeks after the dataset's own day (DATASET_NOW, 8 Nov): the dataset has moved forward to it, and every
// replica must move with it (dataset.ts datasetShift).
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-11-21T10:30:00Z"));

// Every picture of the demo recall reads one dataset (claims.ts). This fails if any replica's ids, verdicts, amounts,
// times, photos or check names drift from it, or if a photo or a code repeats outside the one repost.

const { previewProps, reportPreview, ARRIVE_ID } = await import("@/components/console/preview");
const { verdictOf } = await import("@/components/console/VerdictMark");
const { formatDay, formatDayTime } = await import("@/components/console/format");
const { duration, toRow } = await import("@/app/console/_lib/view");
const { toDrawerClaim } = await import("@/app/console/_lib/drawer");
const { buildSeedClaims, SEED_PHOTOS } = await import("./seed");
const { demoRecall } = await import("./kikea");
const { summarize } = await import("@/lib/store/store");
const { DATASET_NOW, datasetNow, datasetShift, demoDataset } = await import("./dataset");
const { CLAIM, CHAPTERS, CONSOLE_ROWS } = await import("@/components/home/custody/claim");
const { EXHIBIT, CHECKS: EXHIBIT_CHECKS } = await import("@/components/home/teardown/claim");
const { CHECKS: LAPTOP_CHECKS } = await import("@/components/home/ClaimScreen");
const { GATES } = await import("@/components/home/Pipeline");

const verdict = { paid: "paid", approved: "approved", held: "held", rejected: "rejected", blocked: "blocked" } as const;
const photosOf = (d: (typeof DEMO_CLAIMS)[number]) => d.photos.map((p) => `/demo/${p}`);
const home = previewProps().rows;
const signin = previewProps(456, { asConsole: true }).rows;
// The console: the stored claims as /console draws them (the seed's claims, through the console's own row and panel).
const shift = datasetShift();
const recall = demoRecall(new Date(Date.parse("2026-11-05T09:00:00Z") + shift));
const hashes = Object.fromEntries(SEED_PHOTOS.map((p, i) => [p, (i + 1).toString(16).padStart(16, "0")]));
const stored = buildSeedClaims({ recall, hashes, shift });
// A claim's filing time on the visit's day, and the time of day alone, as the homepage's drawn-ahead replicas give it.
const filedOf = (d: (typeof DEMO_CLAIMS)[number]) => new Date(Date.parse(d.filed) + shift).toISOString();
const timeOf = (iso: string) => formatDayTime(iso).split(" ").pop();
const console_ = stored.map((c) => toRow(summarize(c), recall));

describe("the demo claims", () => {
  it("give every claim its own photo and its own code, but for the one repost, which names the claim it copied", () => {
    const reposts = DEMO_CLAIMS.filter((d) => d.copies);
    expect(reposts).toHaveLength(1);
    const [repost] = reposts;
    const copied = DEMO_CLAIMS.find((d) => d.id === repost.copies)!;
    expect(repost.photos).toEqual(copied.photos);
    const photos = DEMO_CLAIMS.filter((d) => d !== repost).flatMap((d) => d.photos);
    expect(new Set(photos).size).toBe(photos.length);
    const codes = DEMO_CLAIMS.map((d) => d.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(DEMO_CLAIMS.map((d) => d.id)).size).toBe(DEMO_CLAIMS.length);
    // The console says which claim it copied.
    expect(console_.find((r) => r.id === repost.id)?.note).toContain(copied.id);
  });

  it("use no two photos that are the same picture, by the console's own fingerprint", async () => {
    const files = [...new Set(DEMO_CLAIMS.flatMap((d) => d.photos))];
    const prints = await Promise.all(files.map(async (f) => dHash(await readFile(join(process.cwd(), "public", "demo", f)))));
    for (let i = 0; i < prints.length; i++) for (let j = i + 1; j < prints.length; j++) expect(hamming(prints[i], prints[j]), `${files[i]} ~ ${files[j]}`).toBeGreaterThan(8);
  });

  it("move to the visit's day: the newest filed yesterday, every time of day kept, none before the recall's date", () => {
    expect(shift % 86_400_000).toBe(0);
    expect(datasetNow().toISOString()).toBe("2026-11-21T09:00:00.000Z");
    const { recall: r, claims } = demoDataset();
    expect(claims.map((c) => c.id)).toEqual(DEMO_CLAIMS.map((d) => d.id));
    expect(claims.map((c) => c.createdAt)).toEqual(DEMO_CLAIMS.map(filedOf));
    expect(claims[0].createdAt.slice(0, 10)).toBe("2026-11-20");
    expect(claims.map((c) => timeOf(c.createdAt))).toEqual(DEMO_CLAIMS.map((d) => timeOf(d.filed)));
    expect(claims.at(-1)!.createdAt.slice(0, 10) >= r.recallDate).toBe(true);
    // Never back: a visit before the dataset's own day reads it as written.
    expect(datasetShift(Date.parse("2026-11-06T12:00:00Z"))).toBe(0);
    expect(datasetShift(DATASET_NOW.getTime())).toBe(0);
    // One build a day: the same visit day reads the same claims at any hour.
    expect(demoDataset(Date.parse("2026-11-21T23:59:00Z")).claims[0].createdAt).toBe(claims[0].createdAt);
  });

  it("pay only where PayPal paid: RM-0442 alone, 15 s from its photo", () => {
    expect(DEMO_CLAIMS.filter((d) => d.outcome === "paid").map((d) => d.id)).toEqual([GENUINE.id]);
    expect(GENUINE.toPayout).toBe(15);
    expect(DEMO_CLAIMS.filter((d) => d.toPayout !== undefined)).toEqual([GENUINE]);
  });
});

describe("every replica reads the demo claims", () => {
  const expected = DEMO_CLAIMS.map((d) => [d.id, verdict[d.outcome], formatDayTime(filedOf(d)), d.code, photosOf(d).length]);

  it("the console, the For companies tour and the sign-in page list the same claims, verdicts, codes and filing times", () => {
    const shape = (rows: { id: string; decision: Parameters<typeof verdictOf>[0]["decision"]; payoutStatus: string | null; createdAt: string; code: string | null; photoCount: number }[]) =>
      rows.map((r) => [r.id, verdictOf(r), formatDayTime(r.createdAt), r.code, r.photoCount]);
    expect(shape(console_)).toEqual(expected);
    expect(shape(home)).toEqual(expected);
    expect(shape(signin)).toEqual(expected);
    // The same photos in the tour as in the dataset.
    expect(home.map((r) => r.photos.map((p) => decodeURIComponent(p.thumb.match(/url=([^&]+)/)![1])))).toEqual(DEMO_CLAIMS.map(photosOf));
    // The same amounts and photo-to-payout seconds.
    for (const rows of [console_, home, signin]) {
      expect(rows.map((r) => [r.id, r.amount, r.toPay])).toEqual(console_.map((r) => [r.id, r.amount, r.toPay]));
    }
    expect(console_.find((r) => r.id === GENUINE.id)?.toPay).toBe(GENUINE.toPayout);
    expect(ARRIVE_ID).toBe(GENUINE.id);
  });

  it("the hero line and How it works stage RM-0442 as the console has it", () => {
    const row = console_.find((r) => r.id === GENUINE.id)!;
    expect([CLAIM.id, CLAIM.code, CLAIM.seconds, CLAIM.photo, CLAIM.filed]).toEqual([GENUINE.id, GENUINE.code, row.toPay, photosOf(GENUINE)[0], timeOf(row.createdAt)]);
    expect(`$${CLAIM.amount.toFixed(2)}`).toBe(row.amount);
    expect(verdictOf(row)).toBe("paid");
    expect(CHAPTERS.find((c) => c.n === "05")!.text).toContain(`${CLAIM.seconds} seconds`);
  });

  it("How it works' console lists the other claims as the tour does: photo, verdict, reason, filing time, check time, amount", () => {
    const rows = home.filter((r) => r.id !== GENUINE.id);
    expect(CONSOLE_ROWS.map((r) => [r.id, r.photo, r.status, r.reason, r.filed, r.time ?? null, r.amount === undefined ? null : `$${r.amount.toFixed(2)}`])).toEqual(
      rows.map((r) => {
        const d = DEMO_CLAIMS.find((x) => x.id === r.id)!;
        return [r.id, photosOf(d)[0], verdictOf(r), r.note, timeOf(r.createdAt), r.modelSec === null ? null : duration(r.modelSec), r.amount];
      }),
    );
  });

  it("How it works' console marks the check that stopped each claim where the console does", async () => {
    const { fiveOutcomes } = await import("@/lib/fiveChecks");
    for (const row of CONSOLE_ROWS) {
      const c = stored.find((x) => x.id === row.id)!;
      const items = [...toDrawerClaim(c, recall).fiveRows.flatMap((r) => r.parts.map((p) => ({ id: p.id, state: p.state })))];
      const failed = fiveOutcomes(items).flatMap((o, i) => (o.outcome === "fail" ? [i] : []));
      expect(failed, row.id).toEqual(row.fails === undefined ? [] : [row.fails]);
    }
  });

  it("the Opened Exhibit stages RM-0442, against the photos of the claims before it", () => {
    expect([EXHIBIT.id, EXHIBIT.code, EXHIBIT.seconds, EXHIBIT.photo, EXHIBIT.amount]).toEqual([CLAIM.id, CLAIM.code, CLAIM.seconds, CLAIM.photo, CLAIM.amount]);
    const before = DEMO_CLAIMS.filter((d) => d.filed < GENUINE.filed).flatMap(photosOf);
    for (const p of EXHIBIT.earlier) expect(before).toContain(p);
  });

  it("the CPSC report counts the same verdicts and says sent only for what PayPal paid, drawn up on the visit's day", () => {
    const { report, generated, daysIn } = reportPreview();
    expect(generated).toBe(formatDay(new Date().toISOString()));
    // 5 to 21 Nov, counted as the reporting period reads: inclusive.
    expect(daysIn).toBe(17);
    const count = (o: string) => DEMO_CLAIMS.filter((d) => d.outcome === o).length;
    const outcomes = Object.fromEntries(report.outcomes.map((o) => [o.label, o.count]));
    // Approved, with nothing sent, has no claim, so the report leaves it out.
    expect(outcomes).toMatchObject({ Paid: count("paid"), Held: count("held"), Rejected: count("rejected"), Blocked: count("blocked") });
    expect(outcomes.Approved ?? 0).toBe(count("approved"));
    expect(report.stats.total).toBe(DEMO_CLAIMS.length);
    expect(report.sent).toBe(count("paid"));
    expect(JSON.stringify(report)).not.toMatch(/starter|seeded|sample|came with|workspace/i);
  });
});

describe("the five checks", () => {
  const names = fiveNames(GENUINE.code, "X-VESOLJE", "Pillow", true);

  it("are named word for word the same on the homepage, the receipt and the console", () => {
    expect(EXHIBIT_CHECKS.map((c) => c.label)).toEqual(names);
    expect([...LAPTOP_CHECKS]).toEqual(names);
    expect(GATES.map((g) => g.title)).toEqual(names);
    const d = toDrawerClaim(stored.find((c) => c.id === GENUINE.id)!, recall);
    expect(d.fiveRows.map((r) => r.name)).toEqual(names);
    expect(console_.find((r) => r.id === GENUINE.id)?.checkNames).toEqual(names);
    expect(names.slice(0, 3)).toEqual([CHECK_NAMES.session, CHECK_NAMES.duplicate, CHECK_NAMES.account]);
    // How it works' chapter 04 says them in a sentence.
    const said = CHAPTERS.find((c) => c.n === "04")!.text.replace(/’/g, "'").toLowerCase();
    for (const name of [...names.slice(0, 3), "the tag shows X-VESOLJE and M4T", "pillow is cut in half"]) expect(said).toContain(name.replace(/’/g, "'").toLowerCase());
  });

  it("name every claim's five the same way in the console's rows and its evidence", () => {
    for (const c of stored) {
      expect(toDrawerClaim(c, recall).fiveRows.map((r) => r.name)).toEqual(console_.find((r) => r.id === c.id)?.checkNames);
    }
  });
});

describe("the console over any store", () => {
  it("lists the seven claims from memory, no earlier seed's claims, and only this browser's demo runs", async () => {
    const { listedClaims } = await import("@/app/console/_lib/workspace");
    const { withDatasetRows } = await import("@/app/console/_lib/dataset");
    const round = "dr_0123456789abcdef0123456789abcdef";
    const viewer = { payerId: "COMPANY00001", decided: {}, round };
    const demoRecall_ = demoDataset().recall;
    // A store an earlier seed wrote: 40 claims, repeated photos and codes, M4T paid again and again.
    const earlier = Array.from({ length: 40 }, (_, i) => ({ ...summarize(stored[i % stored.length]), id: `RM-${String(7000 + i)}`, code: "M4T" }));
    // Demo runs: one of this browser's round, one of another's, one from before rounds, all from one sandbox account.
    const run = (id: string, demoRound?: string) => ({ ...summarize(stored[0]), id, seeded: undefined, demo: true, payerId: "SANDBOX00001", createdAt: new Date(datasetNow().getTime() + 3_600_000).toISOString(), ...(demoRound ? { demoRound } : {}) });
    // A stored claim under one of the dataset's ids gives way to the dataset's.
    const clash = { ...summarize(stored[0]), seeded: undefined, payerId: "COMPANY00001", code: "ZZZ" };
    const rows = withDatasetRows([...earlier, ...stored.map(summarize), clash, run("RM-8001", round), run("RM-8002", "dr_ffffffffffffffffffffffffffffffff"), run("RM-8003")]);
    const listed = listedClaims(rows, demoRecall_, viewer);
    expect(listed.map((r) => r.id)).toEqual(["RM-8001", ...DEMO_CLAIMS.map((d) => d.id)]);
    expect(listed.find((r) => r.id === GENUINE.id)?.code).toBe(GENUINE.code);
    // Another browser on the same sandbox account: the seven claims alone.
    expect(listedClaims(rows, demoRecall_, { ...viewer, round: null }).map((r) => r.id)).toEqual(DEMO_CLAIMS.map((d) => d.id));
  });
});
