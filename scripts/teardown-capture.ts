// Stills of the Opened Exhibit (src/components/home/teardown) from the running app's /dev/teardown?capture=1 page,
// on the real GPU. For the still loop, the poster frames and the collision check.
//   npx tsx scripts/teardown-capture.ts --base http://127.0.0.1:3417 --out .shots/teardown --at beats
//   npx tsx scripts/teardown-capture.ts --at 0,0.31,0.5 --sizes 1440x900,1920x1080 --themes dark,light
//   npx tsx scripts/teardown-capture.ts --posters public/teardown   (the pre-rendered stills, both themes and forms)
// --at takes p values or "beats" (each beat's hold). --check writes collisions.json: for every DOM text box in the
// stage, how many solid scene pixels (alpha > 0.9: the evidence, not its shadow) sit under it. Any > 0 is a fail.
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { BEATS, holdOf } from "../src/components/home/teardown/model";

const { values } = parseArgs({
  options: {
    base: { type: "string", default: "http://127.0.0.1:3000" },
    out: { type: "string", default: ".shots/teardown" },
    at: { type: "string", default: "beats" },
    sizes: { type: "string", default: "1440x900" },
    themes: { type: "string", default: "dark,light" },
    dpr: { type: "string", default: "1" },
    check: { type: "boolean", default: false },
    posters: { type: "string" },
    ref: { type: "boolean", default: false },
  },
});

const THEME_STORAGE_KEY = "remedy-theme";
const beatList = BEATS.map((b) => ({ name: b.id, p: holdOf(b.id) }));
const ats = values.at.split(",").flatMap((v) => (v === "beats" ? beatList : [{ name: `p${v}`, p: Number(v) }]));

// Hides everything in the stage but the canvas, with a transparent page: the poster and collision frames.
const BARE = `[data-mode] > :not(canvas) { visibility: hidden !important } html, body, body * { background: transparent !important }`;
// Posters and the reference pose: the raw canvas, without the stage's text-safe mask (the page applies it on display).
const RAW = `${BARE} [data-mode] > canvas { mask-image: none !important }`;

async function main() {
  const browser = await chromium.launch({
    args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--use-angle=metal", "--enable-webgl", "--hide-scrollbars"],
  });
  const report: unknown[] = [];
  try {
    const jobs = values.posters
      ? (["dark", "light"] as const).flatMap((theme) => [
          { theme, w: 1440, h: 900, dpr: 1.6, form: "d" },
          { theme, w: 640, h: 640, dpr: 1.5, form: "m" },
        ])
      : values.themes.split(",").flatMap((theme) =>
          values.sizes.split(",").map((s) => ({
            theme,
            w: Number(s.split("x")[0]),
            h: Number(s.split("x")[1]),
            dpr: Number(values.dpr),
            form: "",
          })),
        );
    for (const job of jobs) {
      // The OS scheme as well as the stored choice: with nothing stored the site follows prefers-color-scheme, and
      // Playwright's default is light, so a "dark" job drew the light theme's scene.
      const ctx = await browser.newContext({
        viewport: { width: job.w, height: job.h },
        deviceScaleFactor: job.dpr,
        colorScheme: job.theme === "light" ? "light" : "dark",
      });
      await ctx.addInitScript(
        ([key, theme]) => {
          try {
            if (theme === "light") localStorage.setItem(key, "light");
            else localStorage.removeItem(key);
          } catch {}
        },
        [THEME_STORAGE_KEY, job.theme],
      );
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      await page.goto(`${values.base}/dev/teardown?capture=1`, {
        waitUntil: "networkidle",
      });
      await page.waitForFunction(() => (window as unknown as { __exhibit?: { ready(): boolean } }).__exhibit?.ready(), null, { timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);
      const out = resolve(values.posters ?? values.out);
      await mkdir(out, { recursive: true });
      // --ref: the cut evidence posed like the RM-0442 photo (from the front, about 52 degrees down), canvas only.
      if (values.ref) {
        await page.evaluate(
          (p) =>
            (
              window as unknown as {
                __exhibit: { at(p: number, r: unknown, s: unknown): void };
              }
            ).__exhibit.at(p, { x0: 0.1, y0: 0.05, x1: 0.9, y1: 0.95 }, { az: 2, el: 52, at: [0.02, 0.03, 0.06], rx: 0.36, ry: 0.36 }),
          holdOf("intro"),
        );
        await page.evaluate(() => new Promise((r) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), 120)));
        const style = await page.addStyleTag({
          content: `[data-mode] > :not(canvas) { visibility: hidden !important } [data-mode] > canvas { mask-image: none !important }`,
        });
        const file = join(out, `ref-${job.theme}.png`);
        await page.screenshot({ path: file });
        await style.evaluate((n) => (n as Element).remove());
        console.log(file);
        await ctx.close();
        continue;
      }
      const list = values.posters ? beatList : ats;
      for (const at of list) {
        // Mobile posters frame the evidence alone in a near-square still. The wide shots (the whole pillow) are framed
        // tight, past the canvas edge where only the shot's margin falls, so on a 375px phone the object fills about
        // 85% of the width instead of a thumbnail's 55%; the macro shots (the print, the tag) keep their margin.
        // The cut and paid shots part the halves, and the live shot holds the phone off the pillow's right, so they
        // keep a little more room than the whole pillow does.
        const rect = ["fp", "code"].includes(at.name)
          ? { x0: 0.1, y0: 0.12, x1: 0.9, y1: 0.88 }
          : ["live", "torn", "paid"].includes(at.name)
            ? { x0: 0.02, y0: 0.06, x1: 0.98, y1: 0.94 }
            : { x0: -0.07, y0: 0.04, x1: 1.07, y1: 0.96 };
        await page.evaluate(
          ([p, r]) => {
            const ex = (
              window as unknown as {
                __exhibit: { at(p: number, rect?: unknown): void };
              }
            ).__exhibit;
            ex.at(p as number, r ?? undefined);
          },
          [at.p, job.form === "m" ? rect : null] as const,
        );
        // A frame, React's commit, then the frame the commit schedules.
        await page.evaluate(() => new Promise((r) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), 120)));
        if (values.posters) {
          const style = await page.addStyleTag({ content: RAW });
          const png = await page.screenshot({ omitBackground: true });
          await style.evaluate((n) => (n as Element).remove());
          const file = join(out, `${job.theme}-${at.name}-${job.form}.webp`);
          await sharp(png).webp({ quality: 78, alphaQuality: 85, effort: 6 }).toFile(file);
          console.log(file);
          continue;
        }
        const file = join(out, `${job.theme}-${job.w}-${at.name}.png`);
        await page.screenshot({ path: file });
        console.log(file);
        if (values.check) {
          const boxes = await page.evaluate(() => {
            const stage = document.querySelector("[data-mode]");
            if (!stage) return [];
            const els = stage.querySelectorAll("h2, dt, dd, p, blockquote, figcaption, li, button");
            return [...els]
              .filter((e) => {
                const cs = getComputedStyle(e);
                let o = 1;
                for (let n: Element | null = e; n && n !== stage; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
                return cs.visibility !== "hidden" && o > 0.05 && e.getBoundingClientRect().width > 0;
              })
              .map((e) => {
                const r = e.getBoundingClientRect();
                return {
                  text: (e.textContent ?? "").trim().slice(0, 40),
                  x: r.x,
                  y: r.y,
                  w: r.width,
                  h: r.height,
                };
              });
          });
          const style = await page.addStyleTag({ content: BARE });
          const png = await page.screenshot({ omitBackground: true });
          await style.evaluate((n) => (n as Element).remove());
          const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          const k = info.width / job.w;
          const hits = boxes
            .map((b) => {
              let n = 0;
              for (let y = Math.floor(b.y * k); y < Math.min(info.height, (b.y + b.h) * k); y++)
                for (let x = Math.floor(b.x * k); x < Math.min(info.width, (b.x + b.w) * k); x++) if (data[(y * info.width + x) * 4 + 3] > 230) n++;
              return { ...b, solid: n };
            })
            .filter((b) => b.solid > 0);
          // Edge margin: no solid pixel within 24px of the canvas edge.
          let edge = 0;
          for (let y = 0; y < info.height; y++)
            for (let x = 0; x < info.width; x++) {
              const m = 24 * k;
              if (x > m && x < info.width - m && y > m && y < info.height - m) continue;
              if (data[(y * info.width + x) * 4 + 3] > 230) edge++;
            }
          report.push({
            theme: job.theme,
            size: `${job.w}x${job.h}`,
            at: at.name,
            hits,
            edge,
          });
          if (hits.length || edge)
            console.log(`  COLLISION ${at.name}: ${hits.map((h) => `"${h.text}" (${h.solid}px)`).join(", ")}${edge ? ` edge ${edge}px` : ""}`);
        }
      }
      const info = await page.evaluate(() => (window as unknown as { __exhibit: { info(): unknown } }).__exhibit.info());
      console.log(
        JSON.stringify({
          theme: job.theme,
          size: `${job.w}x${job.h}`,
          info,
          errors: errors.slice(0, 5),
        }),
      );
      await ctx.close();
    }
    if (values.check) await writeFile(join(resolve(values.out), "collisions.json"), JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
