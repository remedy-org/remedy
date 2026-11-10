/** Standalone browser fixture: no Next server, credentials, application store, model, or provider is used. */
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
  const artifactDir = await mkdtemp(join(tmpdir(), "remedy-demo-capture-"));
  const bundle = await build({
    stdin: {
      contents: `import {createRoot} from 'react-dom/client';
        import {DemoCaptureStep} from './src/components/claim/DemoCaptureStep';
        import {DEMO_SAMPLES} from './src/lib/demo/samples';
        const sample = DEMO_SAMPLES.find(s => s.id === (new URLSearchParams(location.search).get('sample') || 'reposted'));
        const root = createRoot(document.getElementById('root'));
        window.__arrivals = 0;
        root.render(<DemoCaptureStep claimId="RM-fixture" code="T7Y" sample={sample} backHref="#" written="X-VESOLJE"
          onSent={() => { window.__arrivals++; root.render(<p data-arrived="">Checking screen received the photo</p>); }} />);`,
      resolveDir: root,
      loader: "tsx",
    },
    bundle: true, write: false, outfile: "fixture.js", jsx: "automatic", platform: "browser", metafile: true,
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  });
  for (const input of Object.keys(bundle.metafile!.inputs)) {
    assert(!/src\/lib\/(store|session|paypal|env)(\/|\.)/.test(input), `Forbidden fixture dependency: ${input}`);
  }
  const js = bundle.outputFiles!.find((file) => file.path.endsWith(".js"))!.contents;
  const moduleCss = bundle.outputFiles!.find((file) => file.path.endsWith(".css"))?.text ?? "";
  const css = (await postcss([tailwind({ base: root })]).process(await readFile(join(root, "src/app/globals.css"), "utf8"), { from: join(root, "src/app/globals.css") })).css + moduleCss;
  const server = createServer(async (request, response) => {
    const path = new URL(request.url!, "http://fixture.invalid").pathname;
    if (request.method !== "GET" || path.startsWith("/api/")) { response.writeHead(405).end(); return; }
    if (path === "/") { response.setHeader("Content-Type", "text/html"); response.end('<html><head><link rel="stylesheet" href="/fixture.css"></head><body><main id="root" class="mx-auto max-w-5xl px-6 pt-8"></main><script src="/fixture.js"></script></body></html>'); return; }
    if (path === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(js); return; }
    if (path === "/fixture.css") { response.setHeader("Content-Type", "text/css"); response.end(css); return; }
    if (/^\/demo\/(k01-1|web-1)\.jpg$/.test(path)) { response.setHeader("Content-Type", "image/jpeg"); response.end(await readFile(join(root, "public", path))); return; }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true });
  let passed = 0;
  try {
    async function run(name: string, options: { post?: "hold" | "offline" | "reject"; status?: "hold"; badImage?: boolean; slowImage?: boolean; sample?: string; mobile?: boolean }, test: (page: Page, control: { posts(): number; statuses(): number; releasePost(): void; received(): void }) => Promise<void>) {
      const context = await browser.newContext({ viewport: options.mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, serviceWorkers: "block", reducedMotion: "reduce" });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => {
        Storage.prototype.setItem = () => { throw new Error("Fixture forbids persisted browser writes"); };
        indexedDB.open = () => { throw new Error("Fixture forbids indexedDB"); };
      });
      await page.clock.install();
      let posts = 0;
      let statuses = 0;
      let received = false;
      let releasePost!: () => void;
      const heldPost = new Promise<void>((resolve) => { releasePost = resolve; });
      await page.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== origin) { errors.push(`External request blocked: ${url.origin}`); await route.abort(); return; }
        if (url.pathname === "/api/claims/RM-fixture/photos" && request.method() === "POST") {
          posts++;
          if (options.post === "offline") { await route.abort("failed"); return; }
          if (options.post === "reject" && posts === 1) { await route.fulfill({ status: 400, json: { error: "Nothing arrived. Send again." } }); return; }
          if (options.post === "hold") await heldPost;
          await route.fulfill({ status: 202, json: null }).catch(() => {});
          return;
        }
        if (url.pathname === "/api/claims/RM-fixture/status" && request.method() === "GET" && url.search === "?observe=1") {
          statuses++;
          if (options.status === "hold") { await new Promise(() => {}); return; }
          await route.fulfill({ json: { decision: received ? "blocked" : "pending", photos: received ? 1 : 0 } });
          return;
        }
        if (url.pathname.startsWith("/api/") || request.method() !== "GET") { errors.push(`Unexpected request blocked: ${request.method()} ${url.pathname}`); await route.abort(); return; }
        if (options.slowImage && url.pathname.startsWith("/demo/") && !url.search) { await heldPost; await route.abort().catch(() => {}); return; }
        if (options.badImage && url.pathname.startsWith("/demo/") && !url.search) { await route.fulfill({ status: 404, body: "Missing fixture photo" }); return; }
        await route.continue();
      });
      try {
        await page.goto(`${origin}/${options.sample ? `?sample=${options.sample}` : ""}`, { waitUntil: "domcontentloaded" });
        if (!options.badImage && !options.slowImage) await expect.poll(() => page.locator("img").first().evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        await test(page, { posts: () => posts, statuses: () => statuses, releasePost, received: () => { received = true; } });
        assert.deepEqual(errors, [], `Unexpected browser errors in ${name}`);
        passed++;
        console.log(`PASS ${name}`);
      } catch (error) {
        if (errors.length) console.error(errors);
        throw error;
      } finally {
        releasePost();
        await context.close();
      }
    }

    await run("pending POST stays single-flight, exposes recovery, then accepts late success", { post: "hold", mobile: true }, async (page, control) => {
      await page.getByRole("button", { name: "Take the photo and send it", exact: true }).evaluate((button) => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
      await expect(page.getByText("Sending photo…", { exact: true }).filter({ visible: true })).toBeVisible();
      await page.clock.fastForward(12_001);
      const recover = page.getByRole("button", { name: "Check this claim", exact: true });
      await expect(recover).toBeInViewport();
      assert.equal(control.posts(), 1);
      await page.screenshot({ path: join(artifactDir, "mobile-slow.png") });
      control.releasePost();
      await expect(page.locator("[data-arrived]")).toBeVisible();
    });
    await run("lost reply reconciles receipt without reposting", { post: "offline" }, async (page, control) => {
      await page.getByRole("button", { name: "Take the photo and send it", exact: true }).click();
      await page.clock.fastForward(500);
      await expect(page.getByText("Receipt not confirmed", { exact: true }).filter({ visible: true })).toBeVisible();
      await page.getByRole("button", { name: "Photo receipt not confirmed" }).evaluate((button) => (button as HTMLButtonElement).click());
      await page.getByRole("button", { name: "Check this claim", exact: true }).click();
      await expect(page.getByText(/Receipt isn’t confirmed yet/).filter({ visible: true })).toBeVisible();
      control.received();
      await page.getByRole("button", { name: "Check this claim", exact: true }).click();
      await expect(page.locator("[data-arrived]")).toBeVisible();
      assert.equal(control.posts(), 1);
      assert.equal(control.statuses(), 2);
    });
    await run("known rejection permits one deliberate retry on the same claim", { post: "reject" }, async (page, control) => {
      await page.getByRole("button", { name: "Take the photo and send it", exact: true }).click();
      await page.clock.fastForward(500);
      await page.getByRole("button", { name: "Try sending again", exact: true }).click();
      await page.clock.fastForward(500);
      await expect(page.locator("[data-arrived]")).toBeVisible();
      assert.equal(control.posts(), 2);
    });
    await run("failed image reload preserves claim and code and blocks sending until loaded", { badImage: true, mobile: true }, async (page, control) => {
      await expect(page.getByText("The sample photo didn’t load", { exact: true }).filter({ visible: true })).toBeVisible();
      await page.getByRole("button", { name: "Take the photo and send it", exact: true }).evaluate((button) => (button as HTMLButtonElement).click());
      assert.equal(control.posts(), 0);
      await page.screenshot({ path: join(artifactDir, "mobile-image-error.png") });
      await page.getByRole("button", { name: "Reload photo", exact: true }).click();
      await expect.poll(() => page.locator("img").first().evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await expect(page.getByText("T7Y", { exact: true }).filter({ visible: true })).toBeVisible();
      await page.getByRole("button", { name: "Take the photo and send it", exact: true }).click();
      await page.clock.fastForward(500);
      await expect(page.locator("[data-arrived]")).toBeVisible();
      assert.equal(control.posts(), 1);
    });
    await run("a stalled image offers reload without sending the claim", { slowImage: true, mobile: true }, async (page, control) => {
      await page.clock.fastForward(12_001);
      await expect(page.getByText("The photo is taking longer to load", { exact: true }).filter({ visible: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Reload photo", exact: true })).toBeInViewport();
      await page.getByRole("button", { name: "Take the photo and send it", exact: true }).evaluate((button) => (button as HTMLButtonElement).click());
      assert.equal(control.posts(), 0);
      await page.getByRole("button", { name: "Reload photo", exact: true }).click();
      await expect.poll(() => page.locator("img").first().evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await page.getByRole("button", { name: "Take the photo and send it", exact: true }).click();
      await page.clock.fastForward(500);
      await expect(page.locator("[data-arrived]")).toBeVisible();
      assert.equal(control.posts(), 1);
    });
    await run("status timeout offers another check without unlocking send", { post: "hold", status: "hold" }, async (page, control) => {
      await page.getByRole("button", { name: "Take the photo and send it", exact: true }).click();
      await page.clock.fastForward(12_001);
      await page.getByRole("button", { name: "Check this claim", exact: true }).click();
      await expect(page.getByRole("button", { name: "Checking this claim…" })).toBeVisible();
      await page.clock.fastForward(10_001);
      await expect(page.getByText(/Claim status didn’t answer/).filter({ visible: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Check this claim", exact: true })).toBeEnabled();
      assert.equal(control.posts(), 1);
    });
    await run("receipt recovery and late POST can advance only once", { post: "hold" }, async (page, control) => {
      await page.getByRole("button", { name: "Take the photo and send it", exact: true }).click();
      await page.clock.fastForward(12_001);
      control.received();
      await page.getByRole("button", { name: "Check this claim", exact: true }).click();
      await expect(page.locator("[data-arrived]")).toBeVisible();
      control.releasePost();
      await page.clock.fastForward(1_000);
      assert.equal(await page.evaluate(() => Reflect.get(window, "__arrivals")), 1);
    });
    await run("picture upload shows the same visible pending and receipt recovery", { post: "hold", sample: "ai-no-session", mobile: true }, async (page, control) => {
      await page.locator("#send-picture").click();
      await expect(page.locator("#send-picture")).toHaveText("Sending picture…");
      await page.clock.fastForward(12_001);
      await expect(page.getByRole("button", { name: "Check this claim", exact: true })).toBeVisible();
      control.received();
      await page.getByRole("button", { name: "Check this claim", exact: true }).click();
      await expect(page.locator("[data-arrived]")).toBeVisible();
      assert.equal(control.posts(), 1);
    });
    console.log(`${passed} browser scenarios passed. Screenshots: ${artifactDir}`);
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
