// The vision-check eval: does the app's check (src/lib/vision + src/lib/rule) decide each test claim as expected?
// Each folder under eval/photos/ is one claim: 1-3 photos plus case.json:
//   { "code": "K7Q" | null, "expect": "reject" | ["reject", "hold"], "spec": "eval/specs/x.json", "note": "...",
//     "truth": { "label": "yes", "steps": ["done", ["not_done", "unclear"]], "code": "no", "screen": "no" } }
// "code": null turns the code check off. "spec" and "truth" are optional; a truth value may list several acceptable answers.
// Run: npm run eval:run [-- eval/photos] [--spec eval/specs/standin-pillow.json] [--model gpt-6.1-sol] [--effort high | medium] [--out eval/out/x.json]
// Go if: at least 90% of decisions and answers match, no answer errs toward paying, and no fake is ever "pass".

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { env } from "../src/lib/env";
import { decide } from "../src/lib/rule";
import { CheckSpec, type Outcome, type Verdict } from "../src/lib/types";
import { runVisionCheck } from "../src/lib/vision/check";
import { PRICES } from "./prices";
import type { Field, Row, RunFile } from "./results";

type Want = string | string[] | undefined;
interface Case {
  code: string | null;
  expect: Outcome | Outcome[];
  spec?: string;
  note?: string;
  truth?: { label?: Want; steps?: Want[]; code?: Want; screen?: Want };
}

const args = process.argv.slice(2);
const FLAGS = ["--spec", "--model", "--effort", "--out"];
const flag = (name: string, fallback: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const specPath = flag("--spec", "eval/specs/standin-pillow.json");
const model = flag("--model", "gpt-6.1-sol");
const effort = flag("--effort", "high");
const photosDir = args.find((a, i) => !a.startsWith("--") && !FLAGS.includes(args[i - 1])) || "eval/photos";
const out = flag("--out", `eval/out/${model}${effort === "high" ? "" : `-${effort}`}.json`);

// The app reads its model and effort from the environment, so the flags go there.
process.env.VISION_MODEL = model;
process.env.VISION_EFFORT = effort;

const readSpec = (path: string) => CheckSpec.parse(JSON.parse(readFileSync(path, "utf8")));

// The answer that would move money, per field. Getting one of these wrong is the dangerous kind of miss.
const PAYS: Record<string, string> = { label: "yes", code: "yes", screen: "no" };
const pays = (field: string, value: string | undefined) => value === (field.startsWith("step") ? "done" : PAYS[field]);

// Compare what the model read with the case's answer key.
function score(v: Verdict, truth: NonNullable<Case["truth"]>): Field[] {
  const read: Record<string, string | undefined> = { label: v.label.matches_recalled_product, code: v.challenge_code.matches, screen: v.looks_like_photo_of_screen_or_print };
  v.steps.forEach((s, i) => (read[`step${i + 1}`] = s.status));
  const want: Record<string, Want> = { label: truth.label, code: truth.code, screen: truth.screen };
  (truth.steps || []).forEach((s, i) => (want[`step${i + 1}`] = s));
  return Object.entries(want)
    .filter((e): e is [string, string | string[]] => e[1] !== undefined)
    .map(([field, w]) => {
      const ok = [w].flat();
      const got = read[field];
      return { field, want: ok, got, ok: ok.includes(got as string), towardPaying: pays(field, got) && !ok.includes(got as string) };
    });
}

async function main() {
  if (!model.startsWith("gpt-")) throw new Error(`The app's vision check calls OpenAI only; ${model} isn't an OpenAI model.`);
  // Fails here, once, if .env is missing something the app needs.
  env();
  if (!existsSync(photosDir)) throw new Error(`No ${photosDir} folder yet. See docs/EVAL.md for the test set.`);
  const defaultSpec = readSpec(specPath);

  const rows: Row[] = [];
  const tokens = { in: 0, out: 0 };
  for (const name of readdirSync(photosDir).sort()) {
    const dir = join(photosDir, name);
    if (!existsSync(join(dir, "case.json"))) continue;
    const c: Case = JSON.parse(readFileSync(join(dir, "case.json"), "utf8"));
    const expect = [c.expect].flat();
    try {
      const spec = c.spec ? readSpec(c.spec) : defaultSpec;
      const images = readdirSync(dir)
        .filter((f) => /\.(jpe?g|png|webp|gif|heic)$/i.test(f))
        .sort()
        .slice(0, 3)
        .map((f) => readFileSync(join(dir, f)));
      const { verdict, model: served, usage, seconds } = await runVisionCheck({ images, spec, code: c.code });
      tokens.in += usage?.input_tokens ?? 0;
      tokens.out += usage?.output_tokens ?? 0;
      const { outcome: decision } = decide(verdict, { spec, code: c.code, photos: images.length });
      const fields = c.truth ? score(verdict, c.truth) : [];
      const misses = fields.filter((f) => !f.ok);
      rows.push({ case: name, expect, decision, ok: expect.includes(decision), fakePaid: !expect.includes("pass") && decision === "pass", fields, note: c.note, model: served, seconds, usage, verdict });
      console.log(`${expect.includes(decision) ? "OK  " : "MISS"} ${name} (${seconds.toFixed(1)}s): expected ${expect.join("/")}, got ${decision}` +
        (misses.length ? ` | misread ${misses.map((f) => `${f.field}=${f.got} (want ${f.want.join("/")})${f.towardPaying ? " TOWARD PAYING" : ""}`).join(", ")}` : "") +
        ` | ${verdict.summary}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      rows.push({ case: name, expect, decision: "error", ok: false, fields: [], error: message });
      console.log(`ERR  ${name}: ${message}`);
    }
  }

  const correct = rows.filter((r) => r.ok).length;
  const fakesPaid = rows.filter((r) => r.fakePaid).length;
  const fields = rows.flatMap((r) => r.fields);
  const fieldsOk = fields.filter((f) => f.ok).length;
  const towardPaying = fields.filter((f) => f.towardPaying).length;
  const price = PRICES[model];
  const times = rows.flatMap((r) => (r.seconds ? [r.seconds] : []));
  console.log(`\n${model}, effort ${effort}: ${correct}/${rows.length} decisions as expected; ${fieldsOk}/${fields.length} answers match the key; ${towardPaying} misread toward paying; fakes paid: ${fakesPaid}.`);
  console.log(`Tokens: ${tokens.in} in, ${tokens.out} out` + (price ? ` (about $${((tokens.in * price[0] + tokens.out * price[1]) / 1e6).toFixed(3)})` : "") + ".");
  if (times.length) console.log(`Seconds per claim: ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)} on average, ${Math.max(...times).toFixed(1)} at most.`);
  if (rows.length === 0) console.log("No cases found. Add case folders as described in docs/EVAL.md.");
  else {
    const go = fakesPaid === 0 && towardPaying === 0 && correct >= Math.ceil(rows.length * 0.9) && fieldsOk >= Math.ceil(fields.length * 0.9);
    console.log(go ? "GO" : `NO-GO: look at the misses in ${out}`);
  }
  mkdirSync(dirname(out), { recursive: true });
  const file: RunFile = { model, effort, spec: specPath, tokens, rows };
  writeFileSync(out, JSON.stringify(file, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
