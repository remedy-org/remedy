import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CHECK_NAMES, fiveNames } from "@/lib/fiveChecks";
import { dHash, hamming } from "@/lib/fingerprint";
import { DEMO_CLAIMS, GENUINE } from "./claims";

vi.mock("server-only", () => ({}));

// Every picture of the demo recall reads one dataset (claims.ts). This fails if any replica's ids, verdicts, amounts,
// times, photos or check names drift from it, or if a photo or a code repeats outside the one repost.

const { previewProps, reportPreview, ARRIVE_ID } = await import("@/components/console/preview");
const { verdictOf } = await import("@/components/console/VerdictMark");
const { formatDayTime } = await import("@/components/console/format");
const { duration, toRow } = await import("@/app/console/_lib/view");
const { toDrawerClaim } = await import("@/app/console/_lib/drawer");
const { buildSeedClaims, SEED_PHOTOS } = await import("./seed");
const { demoRecall } = await import("./kikea");
const { summarize } = await import("@/lib/store/store");
const { CLAIM, CHAPTERS, CONSOLE_ROWS } = await import("@/components/home/custody/claim");
const { EXHIBIT, CHECKS: EXHIBIT_CHECKS } = await import("@/components/home/teardown/claim");
const { CHECKS: LAPTOP_CHECKS } = await import("@/components/home/ClaimScreen");
const { GATES } = await import("@/components/home/Pipeline");

const verdict = { paid: "paid", approved: "approved", held: "held", rejected: "rejected", blocked: "blocked" } as const;
const photosOf = (d: (typeof DEMO_CLAIMS)[number]) => d.photos.map((p) => `/demo/${p}`);
const home = previewProps().rows;
const signin = previewProps(456, { asConsole: true }).rows;
// The console: the stored claims as /console draws them (the seed's claims, through the console's own row and panel).
const recall = demoRecall(new Date("2026-11-05T09:00:00Z"));
const hashes = Object.fromEntries(SEED_PHOTOS.map((p, i) => [p, (i + 1).toString(16).padStart(16, "0")]));
const stored = buildSeedClaims({ recall, hashes });
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

  it("pay only where PayPal paid: RM-0442 alone, 15 s from its photo", () => {
    expect(DEMO_CLAIMS.filter((d) => d.outcome === "paid").map((d) => d.id)).toEqual([GENUINE.id]);
    expect(GENUINE.toPayout).toBe(15);
    expect(DEMO_CLAIMS.filter((d) => d.toPayout !== undefined)).toEqual([GENUINE]);
  });
});

describe("every replica reads the demo claims", () => {
  const expected = DEMO_CLAIMS.map((d) => [d.id, verdict[d.outcome], formatDayTime(d.filed), d.code, photosOf(d).length]);

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
    expect([CLAIM.id, CLAIM.code, CLAIM.seconds, CLAIM.photo, CLAIM.filed]).toEqual([GENUINE.id, GENUINE.code, row.toPay, photosOf(GENUINE)[0], formatDayTime(GENUINE.filed)]);
    expect(`$${CLAIM.amount.toFixed(2)}`).toBe(row.amount);
    expect(verdictOf(row)).toBe("paid");
    expect(CHAPTERS.find((c) => c.n === "05")!.text).toContain(`${CLAIM.seconds} seconds`);
  });

  it("How it works' console lists the other claims as the tour does: photo, verdict, reason, filing time, check time, amount", () => {
    const rows = home.filter((r) => r.id !== GENUINE.id);
    expect(CONSOLE_ROWS.map((r) => [r.id, r.photo, r.status, r.reason, r.filed, r.time ?? null, r.amount === undefined ? null : `$${r.amount.toFixed(2)}`])).toEqual(
      rows.map((r) => {
        const d = DEMO_CLAIMS.find((x) => x.id === r.id)!;
        return [r.id, photosOf(d)[0], verdictOf(r), r.note, formatDayTime(r.createdAt), r.modelSec === null ? null : duration(r.modelSec), r.amount];
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

  it("the CPSC report counts the same verdicts and says sent only for what PayPal paid", () => {
    const { report } = reportPreview();
    const count = (o: string) => DEMO_CLAIMS.filter((d) => d.outcome === o).length;
    const outcomes = Object.fromEntries(report.outcomes.map((o) => [o.label, o.count]));
    expect(outcomes).toMatchObject({ Paid: count("paid"), Approved: count("approved"), Held: count("held"), Rejected: count("rejected"), Blocked: count("blocked") });
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

describe("the console over a store seeded before the demo claims", () => {
  it("lists only the demo claims once they are seeded, and leaves a store without them as it is", async () => {
    const { listedClaims } = await import("@/app/console/_lib/workspace");
    const viewer = { payerId: "COMPANY00001", decided: {} };
    const older = { ...summarize(stored[1]), id: "RM-7581" };
    const rows = [...stored.map(summarize), older];
    expect(listedClaims(rows, recall, viewer).map((r) => r.id)).toEqual(DEMO_CLAIMS.map((d) => d.id));
    // A real claim holding RM-0442's id: the rest of the dataset still marks the store as seeded with it.
    const real = rows.filter((r) => r.id !== GENUINE.id);
    expect(listedClaims(real, recall, viewer).map((r) => r.id)).not.toContain("RM-7581");
    // An earlier seed (codes of its own on most ids): left as it is.
    const earlier = [...stored.map((c) => ({ ...summarize(c), code: c.id === "RM-9629" ? c.code : "K7Q" })), older];
    expect(listedClaims(earlier, recall, viewer).map((r) => r.id)).toContain("RM-7581");
  });
});
