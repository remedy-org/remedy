// Sums up repeated eval runs: one row per model and effort, with the spread across runs.
// Run: npm run eval:summarize [-- eval/out/runs]

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PRICES } from "./prices";
import type { Row, RunFile } from "./results";

const dir = process.argv[2] || "eval/out/runs";
const byModel: Record<string, RunFile[]> = {};
for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const run: RunFile = JSON.parse(readFileSync(join(dir, f), "utf8"));
  (byModel[`${run.model} (${run.effort})`] ??= []).push(run);
}

const pct = (a: number, b: number) => `${Math.round((100 * a) / b)}%`;
const range = (xs: number[]) => (Math.min(...xs) === Math.max(...xs) ? `${xs[0]}` : `${Math.min(...xs)}–${Math.max(...xs)}`);
// The c and h (held-out) cases carry a one-time code; the w cases are web photos, which can't.
const isCode = (r: Row) => /^[ch]\d/.test(r.case);
const realClaim = (r: Row) => isCode(r) && r.expect.includes("pass");
const wrongCode = (r: Row) => isCode(r) && r.fields.some((f) => f.field === "code" && f.want.includes("no"));

console.log("| Model | Runs | Decisions right | Answers right | Real claims paid | Wrong codes rejected | Misreads toward paying | Fakes paid | Same decision every run | Seconds per claim (avg / max) | Cost per claim |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|");
const details: string[] = [];
for (const [name, runs] of Object.entries(byModel)) {
  const rows = runs.flatMap((r) => r.rows);
  const fields = rows.flatMap((r) => r.fields);
  const real = rows.filter(realClaim);
  const wrong = rows.filter(wrongCode);
  const toward = rows.flatMap((r) => r.fields.filter((f) => f.towardPaying).map((f) => `${r.case} ${f.field}=${f.got}`));
  const cases = [...new Set(rows.map((r) => r.case))];
  const stable = cases.filter((c) => new Set(rows.filter((r) => r.case === c).map((r) => r.decision)).size === 1).length;
  const secs = rows.flatMap((r) => (r.seconds ? [r.seconds] : []));
  const [pin, pout] = PRICES[runs[0].model] || [0, 0];
  const cost = runs.reduce((s, r) => s + r.tokens.in * pin + r.tokens.out * pout, 0) / 1e6 / rows.length;
  console.log(`| ${name} | ${runs.length} | ${range(runs.map((r) => r.rows.filter((x) => x.ok).length))} of ${runs[0].rows.length} | ${pct(fields.filter((f) => f.ok).length, fields.length)} | ${real.filter((r) => r.decision === "pass").length} of ${real.length} | ${wrong.filter((r) => r.decision === "reject").length} of ${wrong.length} | ${toward.length} | ${rows.filter((r) => r.fakePaid).length} | ${stable} of ${cases.length} | ${(secs.reduce((a, b) => a + b, 0) / secs.length).toFixed(1)} / ${Math.max(...secs).toFixed(1)} | $${cost.toFixed(4)} |`);

  const missesByField: Record<string, number> = {};
  for (const f of fields.filter((f) => !f.ok)) missesByField[f.field.replace(/\d+$/, "")] = (missesByField[f.field.replace(/\d+$/, "")] || 0) + 1;
  details.push(`\n${name}: misreads by field ${JSON.stringify(missesByField)}`);
  if (toward.length) details.push(`  toward paying: ${toward.join("; ")}`);
  for (const c of cases) {
    const rs = rows.filter((r) => r.case === c);
    if (rs.every((r) => r.ok) && new Set(rs.map((r) => r.decision)).size === 1) continue;
    details.push(`  ${c}: ${rs.map((r) => r.decision).join(", ")} (want ${rs[0].expect.join("/")})`);
  }
  const errors = rows.filter((r) => r.error);
  if (errors.length) details.push(`  errors: ${errors.map((r) => `${r.case}: ${r.error}`).join("; ")}`);
}
console.log(details.join("\n"));
