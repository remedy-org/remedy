// WCAG contrast of the Evidence Room tokens, read straight from src/app/globals.css: OKLCH -> OKLab -> linear sRGB
// (clipped to gamut, as browsers render it) -> WCAG 2.x relative luminance. Translucent colours (the 14% soft state
// backgrounds, the 85% stamp ink, the highlighter) are composited over their backdrop in gamma sRGB, as a browser does.
//   npx tsx scripts/contrast.ts            prints every pair, exits 1 if a required pair fails
// Required: text pairs at 4.5:1 (ink on paper, state text, body text), UI borders and the focus ring at 3:1.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type RGBA = { r: number; g: number; b: number; a: number }; // gamma-encoded sRGB 0..1

// ---- colour maths ----

function oklchToRgb(L: number, C: number, H: number, a = 1): RGBA {
  const h = (H * Math.PI) / 180;
  const A = C * Math.cos(h);
  const B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const [r, g, b] = lin.map((v) => {
    const c = Math.min(1, Math.max(0, v));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  });
  return { r, g, b, a };
}

const over = (fg: RGBA, bg: RGBA): RGBA => ({
  r: fg.a * fg.r + (1 - fg.a) * bg.r,
  g: fg.a * fg.g + (1 - fg.a) * bg.g,
  b: fg.a * fg.b + (1 - fg.a) * bg.b,
  a: 1,
});

function luminance({ r, g, b }: RGBA) {
  const f = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(fg: RGBA, bg: RGBA) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const hex = ({ r, g, b }: RGBA) => "#" + [r, g, b].map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("");

// ---- tokens from globals.css ----

const css = readFileSync(resolve(import.meta.dirname, "../src/app/globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const norm = (s: string) => s.replace(/\s+/g, "");

function block(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // The match runs back to the previous brace, so drop any @import or declaration before the selector.
    if (norm(m[1].split(";").pop()!) !== norm(selector)) continue;
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim();
  }
  return out;
}

const shared = block(':root,[data-theme]');
const themes = {
  dark: { ...block(':root,[data-theme="dark"]'), ...shared },
  light: { ...block('[data-theme="light"]'), ...shared },
};

// The Problem section's aged sheet keeps its tokens in its own module (src/components/home/problem.module.css, the section's
// first block), the same in both themes.
const sheetCss = readFileSync(resolve(import.meta.dirname, "../src/components/home/problem.module.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const sheet: Record<string, string> = {};
for (const d of (sheetCss.match(/\.section\s*\{([^{}]*)\}/)?.[1] ?? "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) sheet[d[1]] = d[2].trim();
const withSheet = (tokens: Record<string, string>) => ({ ...tokens, ...sheet });

function resolveColor(tokens: Record<string, string>, value: string, depth = 0): RGBA {
  if (depth > 8) throw new Error(`token loop at ${value}`);
  const v = value.trim();
  const ok = v.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)$/);
  if (ok) return oklchToRgb(+ok[1], +ok[2], +ok[3], ok[4] === undefined ? 1 : +ok[4]);
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  if (ref) return resolveColor(tokens, need(tokens, ref[1]), depth + 1);
  // color-mix(in oklch, var(--x) N%, transparent): x at N% alpha (premultiplied mixing with transparent keeps x's hue).
  const mix = v.match(/^color-mix\(\s*in oklch\s*,\s*(.+?)\s+([\d.]+)%\s*,\s*transparent\s*\)$/);
  if (mix) {
    const c = resolveColor(tokens, mix[1], depth + 1);
    return { ...c, a: c.a * (+mix[2] / 100) };
  }
  throw new Error(`can't read colour ${v}`);
}

function need(tokens: Record<string, string>, name: string) {
  const v = tokens[name];
  if (!v) throw new Error(`missing token ${name}`);
  return v;
}

// ---- pairs ----

type Pair = { fg: string; bg: string; min: number; note?: string };

// A colour spec: a token, a token at an alpha ("--pay-ink@0.85"), "white", or a stack painted bottom to top
// ("--surface+--pay-soft").
function layer(tokens: Record<string, string>, part: string): RGBA {
  const [name, alpha] = part.split("@");
  // "white": a pure-white photo, the worst case under the photo label's scrim; "white@0.22", the primary's hover sheen.
  if (name === "white") return { r: 1, g: 1, b: 1, a: alpha ? Number(alpha) : 1 };
  const c = resolveColor(tokens, need(tokens, name));
  return alpha ? { ...c, a: c.a * Number(alpha) } : c;
}

function paint(tokens: Record<string, string>, spec: string): RGBA {
  return spec.split("+").reduce((acc, part) => over(layer(tokens, part), acc), { r: 0, g: 0, b: 0, a: 1 } as RGBA);
}

// Every surface text can sit on: the three steps, the section fade's top, the console's open row, and the light
// table's pool at its brightest (the pool sits under content, so text over it is measured at its peak).
const surfaces = ["--bg", "--surface", "--surface-2", "--surface-3", "--section-lift", "--surface+--accent-soft", "--bg+--pool"];
const app: Pair[] = [
  ...["--text", "--text-2", "--muted", "--faint"].flatMap((fg) => surfaces.map((bg) => ({ fg, bg, min: 4.5 }))),
  ...["--accent-text"].flatMap((fg) => surfaces.map((bg) => ({ fg, bg, min: 4.5 }))),
  { fg: "--accent-ink", bg: "--accent", min: 4.5, note: "primary button" },
  { fg: "--accent-ink", bg: "--accent-hover", min: 4.5, note: "primary button, hover" },
  // The hover sheen (.btn-primary::before) at its brightest, the top centre: white at 22% over the hover fill.
  { fg: "--accent-ink", bg: "--accent-hover+white@0.22", min: 4.5, note: "primary button, hover sheen" },
  { fg: "--accent-ink", bg: "--accent-press", min: 4.5, note: "primary button, pressed" },
  // The primary's 1px rim is its edge against the page (in light, brass alone is under 2:1 there), and the mark's rim.
  ...["--bg", "--surface", "--surface-2"].map((bg) => ({ fg: "--accent-edge", bg, min: 3, note: "primary button's rim" })),
  { fg: "--accent", bg: "--bg", min: 0, note: "info: brass fill against the page" },
  ...["--pay", "--hold", "--stop"].flatMap((s) => [
    ...surfaces.slice(0, 3).map((bg) => ({ fg: s, bg, min: 4.5 })),
    { fg: s, bg: `--bg+${s}-soft`, min: 4.5, note: "status pill on the page" },
    { fg: s, bg: `--surface+${s}-soft`, min: 4.5, note: "status pill on a card" },
    { fg: s, bg: `--surface-2+${s}-soft`, min: 4.5, note: "status pill on the grid header or panel" },
    { fg: s, bg: `--surface+--accent-soft+${s}-soft`, min: 4.5, note: "status pill on the open row" },
  ]),
  { fg: "--pay-fill-text", bg: "--pay-fill", min: 4.5, note: "a chart's figure on its paid column" },
  ...["--bg", "--surface", "--surface-2"].map((bg) => ({ fg: "--line-strong", bg, min: 3, note: "input border" })),
  { fg: "--photo-scrim-text", bg: "white+--photo-scrim", min: 4.5, note: "AI-made photo label, scrim over a white photo" },
  // The 2px focus ring, 2px off the control: 3:1 against every surface it can lie on (WCAG 1.4.11, 2.4.13).
  ...["--bg", "--surface", "--surface-2", "--surface-3", "--section-lift"].map((bg) => ({ fg: "--focus", bg, min: 3, note: "focus ring" })),
];

// The ring around the amber primary button. In light it must clear the button itself; in dark it is the button's own
// amber, and only the 2px offset of page colour between them (the ring is 10:1 on that) sets it apart.
const ringOnAccent = (min: number): Pair[] => [{ fg: "--focus", bg: "--accent", min, note: min ? "focus ring around the primary button" : "info: the offset gap separates them" }];

const paperBgs = ["--paper", "--paper-2"];
// Paper and its inks are fixed, but the band and the sheet on it differ by theme, and so does the highlighter's amber:
// run these for each theme.
const paper: Pair[] = [
  ...["--ink", "--ink-muted", "--pay-ink", "--hold-ink", "--stop-ink"].flatMap((fg) => paperBgs.map((bg) => ({ fg, bg, min: 4.5 }))),
  ...["--ink", "--ink-muted"].flatMap((fg) => ["--band", "--band-sheet"].map((bg) => ({ fg, bg, min: 4.5, note: "the Problem band" }))),
  ...["--pay-ink", "--hold-ink", "--stop-ink", "--ink-muted"].map((s) => ({ fg: `${s}@0.85`, bg: "--paper", min: 4.5, note: "Stamp (ink at 0.85)" })),
  { fg: "--ink", bg: "--paper+--highlight", min: 4.5, note: "highlighted text on paper" },
  { fg: "--ink-muted", bg: "--paper+--highlight", min: 4.5, note: "highlighted muted text on paper" },
  { fg: "--ink", bg: "--paper-2+--highlight", min: 4.5, note: "highlighted text on paper-2" },
  { fg: "--accent-text", bg: "--paper", min: 0, note: "info: amber text never sits on paper" },
];

// The aged sheet: text sits only where the paper is lit. The worst case under any sheet text is the grain at its
// darkest (it multiplies by 0.84) with the warm edge band over it, as along the sources line. The cards and the clipping
// carry the rest; the stamp is 100% stop ink on the clipping.
const sheetPaper = ["--aged", "--aged+--grain-floor", "--aged+--aged-edge@0.2+--grain-floor"];
const agedSheet: Pair[] = [
  ...["--ink", "--sheet-muted"].flatMap((fg) => sheetPaper.map((bg) => ({ fg, bg, min: 4.5, note: "Problem sheet" }))),
  ...["--ink", "--ink-muted"].flatMap((fg) => ["--evidence-card", "--evidence-clip"].map((bg) => ({ fg, bg, min: 4.5, note: "Problem card" }))),
  { fg: "--ink", bg: "--evidence-clip+--highlight", min: 4.5, note: "highlighted address" },
  // The payoff prints in ink inside the lamp's last pool; its farthest letters sit where the room is at most 14% of the
  // dim's 0.88.
  { fg: "--ink", bg: "--aged+--grain-floor+--room@0.13", min: 4.5, note: "payoff at the edge of the lamp's pool" },
  // Stacked, the chain's "Back to 1" is the string's red a step darker, on the sheet at its darkest ("Remedy cuts here"
  // is --ink, checked above).
  { fg: "--loop-ink", bg: "--aged+--aged-edge@0.2+--grain-floor", min: 4.5, note: "Back to 1 on the sheet" },
  // In light the lamp goes down to --dim-light; the payoff's farthest letters sit where it is at most 14% of the 0.6.
  { fg: "--ink", bg: "--aged+--grain-floor+--dim-light@0.09", min: 4.5, note: "payoff at the edge of the pool, light" },
];
// In light the desk under the sheet is two steps down from the page; the eyebrow there is --muted.
const lightDesk: Pair[] = [
  { fg: "--muted", bg: "--desk-light", min: 4.5, note: "Problem eyebrow on the light desk" },
  { fg: "--text", bg: "--desk-light", min: 4.5, note: "text on the light desk" },
];

let failed = 0;

function report(title: string, tokens: Record<string, string>, pairs: Pair[]) {
  console.log(`\n${title}`);
  for (const p of pairs) {
    const bg = paint(tokens, p.bg);
    const fg = over(layer(tokens, p.fg), bg);
    const r = ratio(fg, bg);
    const ok = r >= p.min;
    if (!ok) failed++;
    const verdict = p.min === 0 ? "info" : ok ? "pass" : "FAIL";
    console.log(
      `  ${verdict.padEnd(4)}  ${r.toFixed(2).padStart(5)}:1  (min ${p.min})  ${p.fg.padEnd(18)} ${hex(fg)}  on ${p.bg.padEnd(22)} ${hex(bg)}${p.note ? `  ${p.note}` : ""}`,
    );
  }
}

// Sanity: the maths must give the textbook extremes.
const white = oklchToRgb(1, 0, 0);
const black = oklchToRgb(0, 0, 0);
if (Math.abs(ratio(white, black) - 21) > 0.01) throw new Error("contrast maths is off");

report("Paper and ink, dark", themes.dark, paper);
report("Paper and ink, light", themes.light, paper);
report("Problem sheet, dark", withSheet(themes.dark), agedSheet);
report("Problem sheet, light", withSheet(themes.light), [...agedSheet, ...lightDesk]);
report("App tokens, dark", themes.dark, [...app, ...ringOnAccent(0)]);
report("App tokens, light", themes.light, [...app, ...ringOnAccent(3)]);

console.log(failed ? `\n${failed} pair(s) below the minimum.` : "\nEvery required pair passes.");
process.exit(failed ? 1 : 0);
