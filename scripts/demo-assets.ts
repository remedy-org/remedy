// Rebuilds the committed demo assets from the local eval (eval/ is git-ignored, so this only runs on a machine that has it):
//   public/demo/<case>-<n>.jpg     our own AI-made sample photos, max 1200 px. Never the w- cases: those are third-party photos.
//   src/lib/demo/verdicts.json     real model answers from eval/out/runs, copied verbatim, for the seeded claims.
//   src/lib/review/replay.json     the app model's run-1 answer for each case, verbatim, keyed by photo SHA-256, for
//                                  the local review replay (src/lib/review/replay.ts).
// npm run demo:assets
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const PHOTOS = join(ROOT, "eval/photos");
const RUNS = join(ROOT, "eval/out/runs");

// Our own generated cases only (eval/photos/SOURCES.md). c11 is c01's photo under another code.
const CASES = ["c01-pillow-cut-daylight", "c02-pillow-cut-lamplight", "c03-pillow-two-photos", "c05-pillow-code-scrawled", "c08-kikea-cut", "c09-written-K7O", "c10-photo-of-screen", "c11-wrong-code-K7P"];

// Which stored answers feed the seeded claims: the app's model (Sol) for paid and rejected claims, and Terra's
// real holds on c03 (it couldn't confirm both photos show the same pillow) for held ones.
const VERDICTS: { model: string; cases: string[] }[] = [
  { model: "gpt-6.1-sol", cases: ["c01-pillow-cut-daylight", "c03-pillow-two-photos", "c05-pillow-code-scrawled", "c09-written-K7O", "c10-photo-of-screen"] },
  { model: "gpt-6.1-terra", cases: ["c03-pillow-two-photos"] },
];

const short = (c: string) => c.slice(0, 3);

async function photos() {
  await mkdir(join(ROOT, "public/demo"), { recursive: true });
  for (const c of CASES) {
    if (c.startsWith("w")) throw new Error("third-party photos never leave eval/");
    const files = (await readdir(join(PHOTOS, c))).filter((f) => f.endsWith(".jpg")).sort();
    for (const [i, f] of files.entries()) {
      const out = join(ROOT, "public/demo", `${short(c)}-${i + 1}.jpg`);
      await sharp(await readFile(join(PHOTOS, c, f)))
        .rotate()
        .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(out);
      console.log(out);
    }
  }
}

interface Row {
  case: string;
  decision: string;
  seconds: number;
  verdict: unknown;
}

async function verdicts() {
  const out: unknown[] = [];
  for (const { model, cases } of VERDICTS) {
    for (const run of [1, 2, 3]) {
      const file = `spike2-${model}-r${run}.json`;
      const { rows } = JSON.parse(await readFile(join(RUNS, file), "utf8")) as { rows: Row[] };
      for (const c of cases) {
        const row = rows.find((r) => r.case === c);
        if (!row?.verdict) throw new Error(`${file} has no verdict for ${c}`);
        const kase = JSON.parse(await readFile(join(PHOTOS, c, "case.json"), "utf8")) as { code: string };
        const n = (await readdir(join(PHOTOS, c))).filter((f) => f.endsWith(".jpg")).length;
        out.push({
          case: c,
          source: `eval/out/runs/${file}`,
          model,
          code: kase.code,
          photos: Array.from({ length: n }, (_, i) => `${short(c)}-${i + 1}.jpg`),
          seconds: row.seconds,
          verdict: row.verdict,
        });
      }
    }
  }
  const file = join(ROOT, "src/lib/demo/verdicts.json");
  await writeFile(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`${file} (${out.length} verdicts)`);
}

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

// Each photo is keyed by its bytes as committed in public/demo (what the demo samples send) and as in eval/photos.
async function replay() {
  const file = "spike2-gpt-6.1-sol-r1.json";
  const { rows } = JSON.parse(await readFile(join(RUNS, file), "utf8")) as { rows: Row[] };
  const out: unknown[] = [];
  for (const c of CASES) {
    const row = rows.find((r) => r.case === c);
    if (!row?.verdict) throw new Error(`${file} has no verdict for ${c}`);
    const kase = JSON.parse(await readFile(join(PHOTOS, c, "case.json"), "utf8")) as { code: string };
    const files = (await readdir(join(PHOTOS, c))).filter((f) => f.endsWith(".jpg")).sort();
    const photos = await Promise.all(
      files.map(async (f, i) => {
        const name = `${short(c)}-${i + 1}.jpg`;
        return { name, sha256: [sha256(await readFile(join(ROOT, "public/demo", name))), sha256(await readFile(join(PHOTOS, c, f)))] };
      }),
    );
    out.push({ case: c, source: `eval/out/runs/${file}`, model: "gpt-6.1-sol", code: kase.code, photos, verdict: row.verdict });
  }
  const target = join(ROOT, "src/lib/review/replay.json");
  await writeFile(target, JSON.stringify(out, null, 2) + "\n");
  console.log(`${target} (${out.length} answers)`);
}

photos()
  .then(verdicts)
  .then(replay)
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
