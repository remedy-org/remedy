// Full-page screenshots of the running app at each width and theme, into .shots/ (git-ignored). Prints each file.
//   npm run shots -- / /console --as company
//   npm run shots -- /r/kikea-x-vesolje --base http://127.0.0.1:3000 --widths 375 --themes dark
//   npm run shots -- /console --cookie remedy_company=<value from npm run -s dev-session -- company>
// Options: --base (default http://127.0.0.1:3000), --cookie name=value (repeatable), --as owner|company (mints a dev
// session; reads .env for SESSION_SECRET), --widths 1440,375, --themes dark,light, --out .shots, --wait 400 (ms after
// load), --motion (keep animations; by default reduced motion shows every final state).
// --scroll '<selector>:<fractions>' (repeatable) takes viewport frames instead of a full page: for each fraction p it
// scrolls so the element's scroll progress is p, as Motion's useScroll({ target, offset: ["start start", "end end"] })
// counts it (0 = its top at the viewport top, 1 = its bottom at the viewport bottom). Pair it with --motion:
//   npm run shots -- / --widths 1440 --themes dark --motion --scroll '[data-runway]:0,0.25,0.5,0.75,0.95'
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium, type Cookie } from "@playwright/test";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: "string", default: "http://127.0.0.1:3000" },
    cookie: { type: "string", multiple: true, default: [] },
    as: { type: "string" },
    widths: { type: "string", default: "1440,375" },
    themes: { type: "string", default: "dark,light" },
    out: { type: "string", default: ".shots" },
    wait: { type: "string", default: "400" },
    motion: { type: "boolean", default: false },
    scroll: { type: "string", multiple: true, default: [] },
  },
});

const THEME_STORAGE_KEY = "remedy-theme";
const paths = positionals.length ? positionals : ["/"];
const widths = values.widths.split(",").map(Number);
const themes = values.themes.split(",") as ("dark" | "light")[];
const base = new URL(values.base);

async function cookies(): Promise<Cookie[]> {
  const pairs = values.cookie.map((c) => {
    const i = c.indexOf("=");
    if (i < 1) throw new Error(`--cookie wants name=value, got ${c}`);
    return [c.slice(0, i), c.slice(i + 1)] as const;
  });
  if (values.as) {
    try {
      process.loadEnvFile(".env");
    } catch {
      // No .env: the dev session secret applies, which the dev server also uses.
    }
    const { mintSession, Role, SESSION_COOKIE } = await import("../src/lib/session-token");
    const role = Role.parse(values.as);
    const payerId = role === "company" ? "DEVCOMPANY01" : "DEVOWNER0001";
    pairs.push([SESSION_COOKIE[role], mintSession({ role, payerId, verified: true, name: "Dev session", email: null })]);
  }
  return pairs.map(([name, value]) => ({ name, value, domain: base.hostname, path: "/", expires: -1, httpOnly: true, secure: false, sameSite: "Lax" }));
}

// "[data-runway]:0,0.25" -> selector and fractions. The last colon splits, so selectors may contain colons.
const scrolls = values.scroll.map((spec) => {
  const i = spec.lastIndexOf(":");
  const fractions = i < 1 ? [] : spec.slice(i + 1).split(",").map(Number);
  if (!fractions.length || fractions.some((f) => !Number.isFinite(f) || f < 0 || f > 1)) {
    throw new Error(`--scroll wants selector:fraction,fraction (each 0 to 1), got ${spec}`);
  }
  return { selector: spec.slice(0, i), fractions };
});

const slug = (path: string) => path.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9]+/g, "-") || "home";

async function main() {
  const out = resolve(values.out);
  await mkdir(out, { recursive: true });
  const jar = await cookies();
  const browser = await chromium.launch();
  try {
    for (const theme of themes) {
      for (const width of widths) {
        const context = await browser.newContext({
          viewport: { width, height: width < 768 ? 812 : 900 },
          deviceScaleFactor: width < 768 ? 3 : 2,
          isMobile: width < 768,
          hasTouch: width < 768,
          colorScheme: theme,
          reducedMotion: values.motion ? "no-preference" : "reduce",
        });
        await context.addCookies(jar);
        await context.addInitScript(
          ([key, light]) => {
            try {
              if (light) localStorage.setItem(key, "light");
              else localStorage.removeItem(key);
            } catch {}
          },
          [THEME_STORAGE_KEY, theme === "light"] as const,
        );
        const page = await context.newPage();
        for (const path of paths) {
          const response = await page.goto(new URL(path, base).toString(), { waitUntil: "networkidle" });
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(Number(values.wait));
          const status = response && !response.ok() ? `  (HTTP ${response.status()})` : "";
          if (!scrolls.length) {
            const file = join(out, `${slug(path)}-${width}-${theme}.png`);
            await page.screenshot({ path: file, fullPage: true });
            console.log(`${file}${status}`);
            continue;
          }
          for (const { selector, fractions } of scrolls) {
            for (const f of fractions) {
              const top = await page.evaluate(
                ([sel, p]) => {
                  const el = document.querySelector(sel);
                  if (!el) return null;
                  const start = el.getBoundingClientRect().top + window.scrollY;
                  const y = start + p * Math.max(0, (el as HTMLElement).offsetHeight - window.innerHeight);
                  window.scrollTo({ top: y, behavior: "instant" });
                  return y;
                },
                [selector, f] as const,
              );
              if (top === null) {
                console.warn(`${path}: no element matches ${selector}; skipped`);
                break;
              }
              // Scroll-linked values update on the next frames; let them settle before the shot.
              await page.waitForTimeout(Number(values.wait));
              const file = join(out, `${slug(path)}-${width}-${theme}-${slug(selector).replace(/^-+|-+$/g, "")}-${f}.png`);
              await page.screenshot({ path: file });
              console.log(`${file}${status}`);
            }
          }
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
