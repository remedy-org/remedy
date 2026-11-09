// Rebuilds the committed demo assets from the local eval (eval/ is git-ignored, so this only runs on a machine that has it):
//   public/demo/<case>-<n>.jpg     our own AI-made sample photos, max 1200 px. Never the w- cases: those are third-party photos.
//   public/demo/<case>-tag.jpg     the wrong-code photo's tag, cut at 800 x 400 from its full-size original; the held
//                                  claim's tag (k10), cut from its original and enlarged 4x for the console's Zoom to tag.
//   src/lib/demo/verdicts.json     real model answers from eval/out/runs, copied verbatim: run 1 of each case.
//   src/lib/review/replay.json     the same answers, keyed by photo SHA-256, for the local review replay
//                                  (src/lib/review/replay.ts).
// npm run demo:assets
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const PHOTOS = join(ROOT, "eval/photos");
const RUNS = join(ROOT, "eval/out/runs");

// Our own generated cases only (eval/photos/SOURCES.md), each with the run files its answer comes from (<runs>-r1.json).
// The k cases are the demo recall's claims (src/lib/demo/claims.ts), checked by the app's model (gpt-6.1-sol, high)
// against eval/specs/kikea-tagged.json; k11 is blocked before the photo check, so it has no answer. c09 stays for the
// claim flow's dev previews of a hedged read.
const CASES: { name: string; runs?: string }[] = [
  { name: "k01-feathers-M4T", runs: "kikea-gpt-6.1-sol" },
  { name: "k02-floral-K7Q", runs: "kikea-gpt-6.1-sol" },
  { name: "k04-puzzle-joined-F3X", runs: "kikea-gpt-6.1-sol" },
  { name: "k06-floral-screen-C7W", runs: "kikea-gpt-6.1-sol" },
  { name: "k10-puzzle-far-dim-H9D", runs: "kikea-held2-gpt-6.1-sol" },
  { name: "k11-feathers-J4R" },
  { name: "c09-written-K7O", runs: "spike2-gpt-6.1-sol" },
];

// The wrong-code photo's tag, in its full-size original's pixels (2:1), for the refusal's enlarged tag.
const TAG = { name: "k02-floral-K7Q", box: { left: 676, top: 1046, width: 300, height: 150 } };
// The held claim's tag (src/lib/demo/claims.ts TAG_SPOTS), in its 1024 x 1536 original's pixels (4:3), enlarged 4x
// from the original rather than from the 1200px copy, so Zoom to tag shows every pixel the camera kept.
const HELD_TAG = { name: "k10-puzzle-far-dim-H9D", box: { left: 719, top: 769, width: 160, height: 120 } };

const short = (c: string) => c.slice(0, 3);
const jpgs = async (c: string) => (await readdir(join(PHOTOS, c))).filter((f) => f.endsWith(".jpg")).sort();

async function photos() {
  await mkdir(join(ROOT, "public/demo"), { recursive: true });
  for (const { name: c } of CASES) {
    if (c.startsWith("w")) throw new Error("third-party photos never leave eval/");
    for (const [i, f] of (await jpgs(c)).entries()) {
      const out = join(ROOT, "public/demo", `${short(c)}-${i + 1}.jpg`);
      await sharp(await readFile(join(PHOTOS, c, f)))
        .rotate()
        .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(out);
      console.log(out);
    }
  }
  const tag = join(ROOT, "public/demo", `${short(TAG.name)}-tag.jpg`);
  await sharp(await readFile(join(PHOTOS, TAG.name, "01.jpg")))
    .extract(TAG.box)
    .resize(800, 400)
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(tag);
  console.log(tag);
  const held = join(ROOT, "public/demo", `${short(HELD_TAG.name)}-tag.jpg`);
  await sharp(await readFile(join(PHOTOS, HELD_TAG.name, "01.jpg")))
    .rotate()
    .extract(HELD_TAG.box)
    .resize(HELD_TAG.box.width * 4, HELD_TAG.box.height * 4, { kernel: "lanczos3" })
    .sharpen({ sigma: 0.6 })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(held);
  console.log(held);
}

interface Row {
  case: string;
  decision: string;
  seconds: number;
  model: string;
  verdict: unknown;
}

// Run 1 of each case: one real answer per photo, verbatim.
async function answers() {
  const out = [];
  for (const { name: c, runs } of CASES) {
    if (!runs) continue;
    const file = `${runs}-r1.json`;
    const { rows } = JSON.parse(await readFile(join(RUNS, file), "utf8")) as { rows: Row[] };
    const row = rows.find((r) => r.case === c);
    if (!row?.verdict) throw new Error(`${file} has no verdict for ${c}`);
    const kase = JSON.parse(await readFile(join(PHOTOS, c, "case.json"), "utf8")) as { code: string };
    const files = await jpgs(c);
    out.push({ c, file, row, code: kase.code, files });
  }
  return out;
}

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

async function main() {
  await photos();
  const rows = await answers();
  const verdicts = rows.map(({ c, file, row, code, files }) => ({
    case: c,
    source: `eval/out/runs/${file}`,
    model: row.model,
    code,
    photos: files.map((_, i) => `${short(c)}-${i + 1}.jpg`),
    seconds: row.seconds,
    verdict: row.verdict,
  }));
  const vFile = join(ROOT, "src/lib/demo/verdicts.json");
  await writeFile(vFile, JSON.stringify(verdicts, null, 2) + "\n");
  console.log(`${vFile} (${verdicts.length} verdicts)`);

  // Each photo is keyed by its bytes as committed in public/demo (what the demo samples send) and as in eval/photos.
  const replay = await Promise.all(
    rows.map(async ({ c, file, row, code, files }) => ({
      case: c,
      source: `eval/out/runs/${file}`,
      model: row.model,
      code,
      photos: await Promise.all(
        files.map(async (f, i) => {
          const name = `${short(c)}-${i + 1}.jpg`;
          return { name, sha256: [sha256(await readFile(join(ROOT, "public/demo", name))), sha256(await readFile(join(PHOTOS, c, f)))] };
        }),
      ),
      verdict: row.verdict,
    })),
  );
  const rFile = join(ROOT, "src/lib/review/replay.json");
  await writeFile(rFile, JSON.stringify(replay, null, 2) + "\n");
  console.log(`${rFile} (${replay.length} answers)`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
