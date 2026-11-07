// The end-to-end checks we used to do by hand, against a running Remedy: a local `next start` or a deployment.
//   npm run e2e                                              -> http://127.0.0.1:3000, signed-out checks only
//   npm run e2e -- --base http://127.0.0.1:3000 --mint       -> also mints a company and a fresh owner session from .env
//   npm run e2e -- --base https://<host> --company <value> --owner <value>
//   npm run e2e -- --mint --live                             -> also the samples that need the photo check (2 model calls)
// Options: --base (default http://127.0.0.1:3000), --company / --owner (session cookie VALUES, e.g. from
// `npm run -s dev-session -- company`), --mint (sign both with .env's SESSION_SECRET; the owner gets a new payer id each
// run), --live. Each run is its own demo round, so the same --owner can run it again and see the same outcomes.
// Checks: the homepage loads with no console errors; the demo recall and /try load; signed out, /console goes to
// /signin; with a company session the console grid has rows; with an owner session each demo sample reaches its
// expected decision through the API. Without --live, only the samples decided before the model run: the AI image
// (blocked, no session) always, and the repost once this round's genuine claim was sent. The genuine sample only pays
// for an owner who logged in with a real sandbox PayPal account; with a minted owner it passes once every check passed
// and only the payout was refused.
// Every sample filed is a real demo claim in the target's store. Exits 1 if any check fails.
import { parseArgs } from "node:util";
import { chromium, type Browser, type Cookie } from "@playwright/test";
import type { ClaimView } from "../src/components/claim/model";
import { DEMO_ROUND_COOKIE, newDemoRound } from "../src/lib/demo/round";
import { DEMO_SAMPLES, type DemoSample } from "../src/lib/demo/samples";

const { values } = parseArgs({
  options: {
    base: { type: "string", default: "http://127.0.0.1:3000" },
    company: { type: "string" },
    owner: { type: "string" },
    mint: { type: "boolean", default: false },
    live: { type: "boolean", default: false },
  },
});

const SLUG = "kikea-x-vesolje";
const base = new URL(values.base);
const url = (path: string) => new URL(path, base).toString();

let failed = 0;
const pass = (name: string, note = "") => console.log(`  ok    ${name}${note && `  (${note})`}`);
const fail = (name: string, why: string) => {
  failed++;
  console.log(`  FAIL  ${name}: ${why}`);
};
const skip = (name: string, why: string) => console.log(`  skip  ${name}: ${why}`);

// Thrown by a check that turns out not to apply.
class Skip extends Error {}

async function check(name: string, run: () => Promise<string | void>) {
  try {
    pass(name, (await run()) ?? "");
  } catch (e) {
    if (e instanceof Skip) skip(name, e.message);
    else fail(name, e instanceof Error ? e.message.split("\n")[0] : String(e));
  }
}

function assert(ok: unknown, why: string): asserts ok {
  if (!ok) throw new Error(why);
}

async function sessions(): Promise<{ company?: string; owner?: string }> {
  if (!values.mint) return { company: values.company, owner: values.owner };
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env: the dev session secret applies, which `next dev` also uses.
  }
  const { mintSession } = await import("../src/lib/session-token");
  const payer = `E2E${Date.now().toString(36).toUpperCase()}`;
  return {
    company: values.company ?? mintSession({ role: "company", payerId: "DEVCOMPANY01", verified: true, name: "E2E company", email: null }),
    owner: values.owner ?? mintSession({ role: "owner", payerId: payer, verified: true, name: "E2E owner", email: null }),
  };
}

const cookie = (name: string, value: string): Cookie => ({
  name,
  value,
  domain: base.hostname,
  path: "/",
  expires: -1,
  httpOnly: true,
  secure: base.protocol === "https:",
  sameSite: "Lax",
});

// Loads a page in a fresh context and fails on an HTTP error or anything logged to the console as an error.
async function load(browser: Browser, path: string, cookies: Cookie[] = []) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies(cookies);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  const response = await page.goto(url(path), { waitUntil: "networkidle" });
  return { context, page, response, errors };
}

async function pageLoads(browser: Browser, path: string, heading?: RegExp) {
  const { context, page, response, errors } = await load(browser, path);
  try {
    assert(response?.ok(), `HTTP ${response?.status()}`);
    if (heading) assert(await page.getByRole("heading", { name: heading }).first().isVisible(), `no heading matching ${heading}`);
    assert(!errors.length, `console: ${errors.join(" | ")}`);
  } finally {
    await context.close();
  }
}

// Signed out at 320px, the narrowest phone: the page never scrolls sideways, and the judges' pill and the theme toggle
// sit side by side with at least 8px between them, the SANDBOX label still showing.
async function narrowTry(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 320, height: 640 } });
  try {
    const page = await context.newPage();
    await page.goto(url(`/r/${SLUG}/try`), { waitUntil: "networkidle" });
    const pill = page.getByRole("button", { name: /judges/i });
    await pill.waitFor();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    assert(width <= 320, `scrollWidth ${width}`);
    const [p, t] = await Promise.all([pill.boundingBox(), page.getByRole("button", { name: /theme/i }).boundingBox()]);
    assert(p && t && t.x >= p.x + p.width + 8, `pill ends at ${p && p.x + p.width}, toggle starts at ${t?.x}`);
    assert(await page.locator("header").getByText(/^Sandbox/).first().isVisible(), "no SANDBOX label in the header");
    return `toggle ${Math.round(t.x - p.x - p.width)}px after the pill`;
  } finally {
    await context.close();
  }
}

// One demo round for the whole run, as one browser has: the repost meets this run's genuine claim, and no other's.
const round = newDemoRound();

// API calls with the owner's cookie and the run's round. Redirects are not followed: a 303's Location is the answer.
const api = (owner: string, path: string, init: RequestInit = {}) =>
  fetch(url(path), { ...init, redirect: "manual", headers: { ...init.headers, Cookie: `remedy_owner=${owner}; ${DEMO_ROUND_COOKIE}=${round}` } });

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

// Files the sample's demo claim, sends its photos, and waits for the decision. No view: the server refused to file it.
async function runSample(owner: string, sample: DemoSample): Promise<{ status: number; view?: ClaimView }> {
  const filed = await api(owner, "/api/claims", { method: "POST", body: form({ recall: SLUG, sample: sample.id }) });
  if (filed.status !== 303) return { status: filed.status };
  const id = filed.headers.get("location")?.match(/\/try\/(RM-\d{4})$/)?.[1];
  assert(id, `unexpected redirect to ${filed.headers.get("location")}`);

  const sent = await api(owner, `/api/claims/${id}/photos`, { method: "POST", body: form({ sessionId: "" }) });
  if (sent.status !== 202) throw new Error(`photos: HTTP ${sent.status} ${await sent.text()}`);
  let view = (await sent.json()) as ClaimView;
  // The photo check takes 15 to 40 s; GET /api/claims/<id> holds the claim for a person after 150 s.
  for (const deadline = Date.now() + 180_000; view.decision === "pending" && Date.now() < deadline; ) {
    await new Promise((r) => setTimeout(r, 2000));
    view = (await (await api(owner, `/api/claims/${id}`)).json()) as ClaimView;
  }
  return { status: 202, view };
}

function expectOutcome(sample: DemoSample, view: ClaimView, minted: boolean): string {
  // PayPal refuses a payout to a payer id it doesn't know, so a minted owner's genuine claim is held at the payout.
  const onlyPayoutHeld = view.decision === "held" && view.rows.every((r) => r.state === "pass" || r.id === "payout");
  if (minted && sample.expect === "paid" && onlyPayoutHeld) return `${view.id}: every check passed; held at the payout, as PayPal refuses a minted payer id`;
  const row = view.rows.find((r) => r.id === sample.decidedBy);
  const why = row?.detail ?? view.rows.find((r) => r.state !== "pass" && r.detail)?.detail ?? "";
  assert(view.decision === sample.expect, `${view.id} is ${view.decision}, expected ${sample.expect}${why && `: ${why}`}`);
  if (sample.decidedBy !== "all") assert(row && row.state !== "pass" && row.state !== "waiting", `${view.id}: the ${sample.decidedBy} check didn't decide it`);
  return `${view.id} ${view.decision}${sample.decidedBy === "all" ? "" : ` by ${sample.decidedBy}`}`;
}

async function main() {
  const { company, owner } = await sessions();
  console.log(`Remedy e2e against ${base.origin}${values.live ? " (live)" : ""}`);
  const browser = await chromium.launch();
  try {
    await check("homepage loads with no console errors", () => pageLoads(browser, "/"));
    await check(`/r/${SLUG} loads`, () => pageLoads(browser, `/r/${SLUG}`));
    await check(`/r/${SLUG}/try loads`, () => pageLoads(browser, `/r/${SLUG}/try`));
    await check(`/r/${SLUG}/try at 320px: no sideways scroll, header controls apart`, () => narrowTry(browser));

    await check("signed out, /console redirects to /signin", async () => {
      const { context, page } = await load(browser, "/console");
      const at = new URL(page.url());
      await context.close();
      assert(at.pathname === "/signin", `ended at ${at.pathname}`);
    });

    if (!company) skip("console grid has rows", "no company session (--company or --mint)");
    else
      await check("console grid has rows", async () => {
        const { context, page, errors } = await load(browser, "/console", [cookie("remedy_company", company)]);
        try {
          assert(new URL(page.url()).pathname === "/console", `ended at ${new URL(page.url()).pathname}: is the company session valid?`);
          await page.locator(".ag-row").first().waitFor({ timeout: 10_000 });
          const rows = await page.locator(".ag-row").count();
          assert(!errors.length, `console: ${errors.join(" | ")}`);
          return `${rows} rows rendered`;
        } finally {
          await context.close();
        }
      });

    if (!owner) skip("demo samples", "no owner session (--owner or --mint)");
    else
      for (const sample of DEMO_SAMPLES) {
        const name = `demo sample "${sample.id}" is ${sample.expect}`;
        const needsModel = sample.expect !== "blocked";
        if (needsModel && !values.live) {
          skip(name, "runs the photo check; pass --live");
          continue;
        }
        await check(name, async () => {
          const { status, view } = await runSample(owner, sample);
          // The repost needs this round's genuine photo already sent, which costs a photo check.
          if (status === 409 && sample.after && !values.live) throw new Skip(`needs "${sample.after}" sent first; pass --live`);
          assert(view, `filing the claim: HTTP ${status}`);
          return expectOutcome(sample, view, values.mint && !values.owner);
        });
      }
  } finally {
    await browser.close();
  }
  console.log(failed ? `${failed} failed` : "All passed");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
