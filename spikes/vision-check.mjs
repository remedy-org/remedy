// Spike 2: can a vision model (Claude or GPT) verify a recall-destruction photo reliably enough to pay on it?
// Each folder under spikes/photos/ is one claim: 1-3 photos plus case.json:
//   { "code": "K7Q" | null, "expect": "reject" | ["reject", "hold"], "spec": "spikes/specs/x.json", "note": "...",
//     "truth": { "label": "yes", "steps": ["done", ["not_done", "unclear"]], "code": "no", "screen": "no" } }
// "code": null turns the code check off. "spec" and "truth" are optional; a truth value may list several acceptable answers.
// Run: npm run spike:vision [-- spikes/photos] [--spec spikes/specs/standin-pillow.json] [--model gpt-6.1-sol | claude-opus-5-5] [--effort high | medium] [--out spikes/out/x.json]
// Go if: at least 90% of decisions and answers match, no answer errs toward paying, and no fake is ever "pass".

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, extname, basename, dirname } from "node:path";
import { tmpdir } from "node:os";
import { PRICES } from "./prices.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const specPath = flag("--spec", "spikes/specs/standin-pillow.json");
const model = flag("--model", "gpt-6.1-sol");
const effort = flag("--effort", "high");
const photosDir = args.find((a, i) => !a.startsWith("--") && !["--spec", "--model", "--effort", "--out"].includes(args[i - 1])) || "spikes/photos";
const defaultSpec = JSON.parse(readFileSync(specPath, "utf8"));
const gpt = model.startsWith("gpt-");
const client = gpt ? new OpenAI() : new Anthropic();

const Tri = z.enum(["yes", "no", "unclear"]);
const Verdict = z.object({
  label: z.object({ text_seen: z.string().nullable(), matches_recalled_product: Tri, evidence: z.string() }),
  steps: z.array(z.object({ step: z.string(), status: z.enum(["done", "not_done", "unclear"]), evidence: z.string() })),
  challenge_code: z.object({ text_seen: z.string().nullable(), matches: Tri, evidence: z.string() }),
  same_item_in_all_photos: Tri,
  looks_like_photo_of_screen_or_print: Tri,
  summary: z.string(),
});

const SYSTEM = `You examine photos submitted as proof for a product-recall refund. Money is paid only if the photos prove the claim, so be strict and literal.
- Report only what is visible. Quote any text you can read exactly as written. If you can't see something clearly, say "unclear"; never assume.
- Check each proof step separately against the photos.
- The claimant was asked to hand-write a one-time code on the product or its tag before taking the photos. Compare what's written with the expected code, character by character. If no code is written anywhere in the photos, it does not match: answer "no".
- Note anything suggesting the image is a photo of a screen or a print, or that the photos show different items.`;

const MEDIA = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };

// Phone photos are often HEIC, over 5 MB, or bigger than the models use: convert and shrink with macOS sips when needed.
// sips -Z also enlarges small images, so it only runs on images over 1568 px.
function loadImage(path) {
  const ext = extname(path).toLowerCase();
  const [, w, h] = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", path], { encoding: "utf8" }).match(/pixelWidth: (\d+)\s+pixelHeight: (\d+)/);
  const big = Math.max(w, h) > 1568;
  let file = path;
  let media = MEDIA[ext];
  if (!media || big || readFileSync(path).length > 4_500_000) {
    file = join(tmpdir(), `remedy-${process.pid}-${basename(dirname(path))}-${basename(path)}.jpg`);
    execFileSync("sips", ["-s", "format", "jpeg", ...(big ? ["-Z", "1568"] : []), path, "--out", file], { stdio: "ignore" });
    media = "image/jpeg";
  }
  return { media, data: readFileSync(file).toString("base64") };
}

// The model describes; this rule decides. Any "no" rejects, any "unclear" holds for a person.
// "Same item in all photos" only means something when there is more than one photo.
function decide(v, withCode, photos) {
  const checks = [
    v.label.matches_recalled_product,
    ...(withCode ? [v.challenge_code.matches] : []),
    ...(photos > 1 ? [v.same_item_in_all_photos] : []),
    v.looks_like_photo_of_screen_or_print === "yes" ? "no" : v.looks_like_photo_of_screen_or_print === "no" ? "yes" : "unclear",
    ...v.steps.map((s) => (s.status === "done" ? "yes" : s.status === "not_done" ? "no" : "unclear")),
  ];
  if (checks.includes("no")) return "reject";
  if (checks.includes("unclear")) return "hold";
  return "pass";
}

// The answer that would move money, per field. Getting one of these wrong is the dangerous kind of miss.
const PAYS = { label: "yes", code: "yes", screen: "no" };
const pays = (field, value) => value === (field.startsWith("step") ? "done" : PAYS[field]);

// Compare what the model read with the case's answer key.
function score(v, truth) {
  const read = { label: v.label.matches_recalled_product, code: v.challenge_code.matches, screen: v.looks_like_photo_of_screen_or_print };
  v.steps.forEach((s, i) => (read[`step${i + 1}`] = s.status));
  const want = { label: truth.label, code: truth.code, screen: truth.screen };
  (truth.steps || []).forEach((s, i) => (want[`step${i + 1}`] = s));
  return Object.entries(want)
    .filter(([, w]) => w !== undefined)
    .map(([field, w]) => {
      const ok = [w].flat();
      return { field, want: ok, got: read[field], ok: ok.includes(read[field]), towardPaying: pays(field, read[field]) && !ok.includes(read[field]) };
    });
}

async function check(caseDir, code, spec) {
  const images = readdirSync(caseDir)
    .filter((f) => /\.(jpe?g|png|webp|gif|heic)$/i.test(f))
    .slice(0, 3)
    .map((f) => loadImage(join(caseDir, f)));
  const label = spec.label_must_show.length
    ? `The label must show: ${spec.label_must_show.join(", ")}.`
    : "This product has no label: judge whether it is the recalled product from its shape and pattern.";
  const text = `Recalled product: ${spec.product}. ${label}
Proof steps to check, in this order:
${spec.proof_steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}
${code ? `Expected one-time code: ${code}` : 'This claim has no one-time code; answer "unclear" for the code.'}`;
  return { photos: images.length, ...(await (gpt ? askGpt(images, text) : askClaude(images, text))) };
}

async function askClaude(images, text) {
  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: betaZodOutputFormat(Verdict) },
    system: SYSTEM,
    messages: [{
      role: "user",
      content: [...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.media, data: i.data } })), { type: "text", text }],
    }],
  });
  if (response.stop_reason === "refusal") throw new Error(`refused: ${response.stop_details?.category}`);
  if (!response.parsed_output) throw new Error(`unparsed output, stop_reason=${response.stop_reason}`);
  return { verdict: response.parsed_output, model: response.model, usage: response.usage };
}

// Same prompt, schema and effort through OpenAI's Responses API. "original" detail keeps small label text readable.
async function askGpt(images, text) {
  const response = await client.responses.parse({
    model,
    reasoning: { effort },
    input: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [...images.map((i) => ({ type: "input_image", image_url: `data:${i.media};base64,${i.data}`, detail: "original" })), { type: "input_text", text }],
      },
    ],
    text: { format: zodTextFormat(Verdict, "verdict") },
  });
  if (!response.output_parsed) throw new Error(`unparsed output, status=${response.status}`);
  return { verdict: response.output_parsed, model: response.model, usage: response.usage };
}

if (!existsSync(photosDir)) {
  console.error(`No ${photosDir} folder yet. See spikes/README.md for the shot list.`);
  process.exit(1);
}

const rows = [];
const tokens = { in: 0, out: 0 };
for (const name of readdirSync(photosDir).sort()) {
  const dir = join(photosDir, name);
  if (!existsSync(join(dir, "case.json"))) continue;
  const c = JSON.parse(readFileSync(join(dir, "case.json"), "utf8"));
  const expect = [c.expect].flat();
  const spec = c.spec ? JSON.parse(readFileSync(c.spec, "utf8")) : defaultSpec;
  try {
    const started = Date.now();
    const { verdict, model: served, usage, photos } = await check(dir, c.code, spec);
    const seconds = (Date.now() - started) / 1000;
    tokens.in += usage.input_tokens;
    tokens.out += usage.output_tokens;
    const decision = decide(verdict, Boolean(c.code), photos);
    const fields = c.truth ? score(verdict, c.truth) : [];
    const misses = fields.filter((f) => !f.ok);
    rows.push({ case: name, expect, decision, ok: expect.includes(decision), fakePaid: !expect.includes("pass") && decision === "pass", fields, note: c.note, model: served, seconds, usage, verdict });
    console.log(`${expect.includes(decision) ? "OK  " : "MISS"} ${name} (${seconds.toFixed(1)}s): expected ${expect.join("/")}, got ${decision}` +
      (misses.length ? ` | misread ${misses.map((f) => `${f.field}=${f.got} (want ${f.want.join("/")})${f.towardPaying ? " TOWARD PAYING" : ""}`).join(", ")}` : "") +
      ` | ${verdict.summary}`);
  } catch (e) {
    rows.push({ case: name, expect, decision: "error", ok: false, fields: [], error: e.message });
    console.log(`ERR  ${name}: ${e.message}`);
  }
}

const correct = rows.filter((r) => r.ok).length;
const fakesPaid = rows.filter((r) => r.fakePaid).length;
const fields = rows.flatMap((r) => r.fields);
const fieldsOk = fields.filter((f) => f.ok).length;
const towardPaying = fields.filter((f) => f.towardPaying).length;
const out = flag("--out", `spikes/out/spike2-${model}${effort === "high" ? "" : `-${effort}`}.json`);
const price = PRICES[model];
const times = rows.filter((r) => r.seconds).map((r) => r.seconds);
console.log(`\n${model}, effort ${effort}: ${correct}/${rows.length} decisions as expected; ${fieldsOk}/${fields.length} answers match the key; ${towardPaying} misread toward paying; fakes paid: ${fakesPaid}.`);
console.log(`Tokens: ${tokens.in} in, ${tokens.out} out` + (price ? ` (about $${((tokens.in * price[0] + tokens.out * price[1]) / 1e6).toFixed(3)})` : "") + ".");
if (times.length) console.log(`Seconds per claim: ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)} on average, ${Math.max(...times).toFixed(1)} at most.`);
if (rows.length === 0) console.log("No cases found. Add case folders as described in spikes/README.md.");
else {
  const go = fakesPaid === 0 && towardPaying === 0 && correct >= Math.ceil(rows.length * 0.9) && fieldsOk >= Math.ceil(fields.length * 0.9);
  console.log(go ? "GO" : `NO-GO: look at the misses in ${out}`);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ model, effort, spec: specPath, tokens, rows }, null, 2));
