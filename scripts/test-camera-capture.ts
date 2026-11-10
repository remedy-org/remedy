/** Standalone synthetic camera: no Next server, credentials, app store, model or provider.
 * Regression: OWNER-001 — stalled or lost camera replies need receipt recovery, never blind resend.
 * Found by /qa on 2026-11-11. Report: ../planning/final-platform-qa-2026-11-11/owner/report.md
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, type Page } from "@playwright/test";
import tailwind from "@tailwindcss/postcss";
import { build } from "esbuild";
import postcss from "postcss";

async function main() {
  const root = process.cwd();
  const artifacts = await mkdtemp(join(tmpdir(), "remedy-camera-capture-"));
  const bundle = await build({
    stdin: {
      contents: `import {createRoot} from 'react-dom/client'; import {CaptureStep} from './src/components/claim/CaptureStep';
        const root=createRoot(document.getElementById('root')); window.__arrivals=0;
        root.render(<CaptureStep claimId="RM-fixture" sessionId="cs_fixture" code="M4T" expiresAt={new Date(Date.now()+600000).toISOString()} startNow={Date.now()}
          qrSvg="" phoneUrl="#" newClaimHref="#" loginHref="#" reminder="Photograph the tag and cut pillow."
          onBack={()=>{}} onSent={(view,urls)=>{window.__arrivals++; window.__photos=urls?.length; root.render(<p data-arrived>Photo received</p>);}}/>);`,
      resolveDir: root, loader: "tsx",
    },
    bundle: true, write: false, outfile: "fixture.js", jsx: "automatic", platform: "browser", metafile: true,
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  });
  for (const input of Object.keys(bundle.metafile!.inputs)) assert(!/src\/lib\/(store|session|paypal|env)(\/|\.)/.test(input), `Forbidden fixture dependency: ${input}`);
  const js = bundle.outputFiles!.find((f) => f.path.endsWith(".js"))!.contents;
  const css = (await postcss([tailwind({ base: root })]).process(await readFile(join(root, "src/app/globals.css"), "utf8"), { from: join(root, "src/app/globals.css") })).css
    + (bundle.outputFiles!.find((f) => f.path.endsWith(".css"))?.text ?? "");
  const server = createServer((request, response) => {
    const path = new URL(request.url!, "http://fixture.invalid").pathname;
    if (request.method !== "GET" || path.startsWith("/api/")) { response.writeHead(405).end(); return; }
    if (path === "/") { response.setHeader("Content-Type", "text/html"); response.end('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><main id="root" style="padding:32px 24px 0"></main><script src="/fixture.js"></script></body></html>'); return; }
    if (path === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(js); return; }
    if (path === "/fixture.css") { response.setHeader("Content-Type", "text/css"); response.end(css); return; }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true });
  let passed = 0;
  try {
    async function run(name: string, options: { post?: "hold" | "offline" | "500" | "400" | "409"; status?: "hold" }, test: (page: Page, control: { posts(): number; receipts(): number; release(): void; received(): void }) => Promise<void>) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce", serviceWorkers: "block" });
      const page = await context.newPage();
      const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
      // Raw script keeps the browser fixture independent of tsx's function-name helpers.
      await page.addInitScript(`
        Storage.prototype.setItem = Storage.prototype.removeItem = Storage.prototype.clear = () => { throw new Error("No persisted browser writes"); };
        Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: async () => new MediaStream() } });
        Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { get: () => 800 });
        Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { get: () => 600 });
        HTMLMediaElement.prototype.play = async () => {};
        HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
        HTMLCanvasElement.prototype.toBlob = function (callback) { callback(new Blob(["synthetic photo"], { type: "image/jpeg" })); };
      `);
      await page.clock.install();
      let posts = 0, receipts = 0, received = false;
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      await page.route("**/*", async (route) => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== origin) { errors.push(`External request blocked: ${url.origin}`); await route.abort(); return; }
        if (url.pathname === "/api/claims/RM-fixture/photos" && request.method() === "POST") {
          posts++;
          assert(request.postData()?.includes('name="sessionId"'), "Capture payload retains its session");
          if (options.post === "offline") { await route.abort("failed"); return; }
          if (options.post === "409") { await route.fulfill({ status: 409, body: "" }); return; }
          if ((options.post === "500" || options.post === "400") && posts === 1) { await route.fulfill({ status: Number(options.post), json: { error: "Not accepted" } }); return; }
          if (options.post === "hold") await held;
          await route.fulfill({ status: 202, json: null }).catch(() => {}); return;
        }
        if (url.pathname === "/api/claims/RM-fixture/status" && request.method() === "GET") {
          // Ordinary arrival polling is also mocked; user-triggered recovery must use observe=1.
          if (!url.search) { await route.fulfill({ json: { decision: "pending", photos: 0 } }); return; }
          assert.equal(url.search, "?observe=1"); receipts++;
          if (options.status === "hold") { await new Promise(() => {}); return; }
          await route.fulfill({ json: { decision: received ? "paid" : "pending", photos: received ? 1 : 0 } }); return;
        }
        if (url.pathname.startsWith("/api/") || request.method() !== "GET") { errors.push(`Unexpected request: ${request.method()} ${url.pathname}`); await route.abort(); return; }
        await route.continue();
      });
      try {
        await page.goto(origin, { waitUntil: "networkidle" });
        const shutter = page.getByRole("button", { name: "Take a photo", exact: true });
        await expect(shutter).toBeEnabled(); await shutter.click();
        await test(page, { posts: () => posts, receipts: () => receipts, release, received: () => { received = true; } });
        assert.deepEqual(errors, []); passed++; console.log(`PASS ${name}`);
      } finally { release(); await context.close(); }
    }

    await run("stalled send stays single-flight and accepts late success", { post: "hold" }, async (page, control) => {
      await page.getByRole("button", { name: "Send photo", exact: true }).evaluate((button) => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
      await page.clock.fastForward(12_001);
      await expect(page.getByRole("button", { name: "Check this claim", exact: true })).toBeInViewport();
      assert.equal(control.posts(), 1); await page.screenshot({ path: join(artifacts, "mobile-stalled.png") });
      control.release(); await expect(page.locator("[data-arrived]")).toBeVisible();
      assert.equal(await page.evaluate(() => Reflect.get(window, "__photos")), 1);
    });
    await run("session expiry keeps an in-flight claim in receipt recovery", { post: "hold" }, async (page, control) => {
      await page.getByRole("button", { name: "Send photo", exact: true }).click(); await page.clock.fastForward(600_001);
      await expect(page.getByRole("button", { name: "Check this claim", exact: true })).toBeInViewport();
      assert.equal(await page.getByRole("link", { name: "Get a new code", exact: true }).count(), 0);
      control.release(); await expect(page.locator("[data-arrived]")).toBeVisible(); assert.equal(control.posts(), 1);
    });
    for (const post of ["offline", "500"] as const) await run(`${post} reply checks receipt without resending`, { post }, async (page, control) => {
      await page.getByRole("button", { name: "Send photo", exact: true }).click();
      const check = page.getByRole("button", { name: "Check this claim", exact: true });
      await expect(check).toBeVisible(); await check.click();
      await expect(page.getByText(/Receipt isn’t confirmed yet/)).toBeVisible();
      assert.equal(control.receipts(), 1);
      assert.equal(await page.getByRole("button", { name: "Send again", exact: true }).count(), 0);
      control.received(); await check.click(); await expect(page.locator("[data-arrived]")).toBeVisible();
      assert.equal(control.posts(), 1);
    });
    await run("known pre-write refusal permits retry", { post: "400" }, async (page, control) => {
      await page.getByRole("button", { name: "Send photo", exact: true }).click();
      await page.getByRole("button", { name: "Send again", exact: true }).click();
      await expect(page.locator("[data-arrived]")).toBeVisible(); assert.equal(control.posts(), 2);
    });
    await run("receipt timeout permits another check, never another send", { post: "hold", status: "hold" }, async (page, control) => {
      await page.getByRole("button", { name: "Send photo", exact: true }).click(); await page.clock.fastForward(12_001);
      await page.getByRole("button", { name: "Check this claim", exact: true }).click();
      await page.clock.fastForward(10_001);
      await expect(page.getByText(/Claim status didn’t answer/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Check this claim", exact: true })).toBeEnabled(); assert.equal(control.posts(), 1);
    });
    await run("confirmed receipt and late POST advance only once", { post: "hold" }, async (page, control) => {
      await page.getByRole("button", { name: "Send photo", exact: true }).click(); await page.clock.fastForward(12_001);
      control.received(); await page.getByRole("button", { name: "Check this claim", exact: true }).click();
      await expect(page.locator("[data-arrived]")).toBeVisible();
      assert.equal(await page.evaluate(() => Reflect.get(window, "__photos")), undefined);
      control.release(); await page.clock.fastForward(1_000);
      assert.equal(await page.evaluate(() => Reflect.get(window, "__arrivals")), 1);
    });
    await run("ordinary accepted capture carries its photo forward", {}, async (page, control) => {
      await page.getByRole("button", { name: "Send photo", exact: true }).click();
      await expect(page.locator("[data-arrived]")).toBeVisible(); assert.equal(control.posts(), 1);
      assert.equal(await page.evaluate(() => Reflect.get(window, "__photos")), 1);
    });
    await run("another-device receipt never claims this tab's unaccepted photo", { post: "409" }, async (page, control) => {
      await page.getByRole("button", { name: "Send photo", exact: true }).click();
      await expect(page.locator("[data-arrived]")).toBeVisible(); assert.equal(control.posts(), 1);
      assert.equal(await page.evaluate(() => Reflect.get(window, "__photos")), undefined);
      assert.equal(await page.evaluate(() => Reflect.get(window, "__arrivals")), 1);
    });
    console.log(`${passed} synthetic-camera browser scenarios passed. Screenshots: ${artifacts}`);
  } finally { await browser.close(); await new Promise<void>((resolve) => server.close(() => resolve())); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
