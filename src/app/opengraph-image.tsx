import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { MARK_STUB, MARK_TAG } from "@/components/ui/markPaths";

// The link card for Slack, iMessage and X: the hero's two-tone headline in Schibsted Grotesk on the page colour, beside
// the genuine demo claim's photo. Colours are the Lamplight dark tokens (wave3 DIRECTION.md), as hex.
export const alt = "Remedy: recall refunds, paid in a minute through PayPal, once a live camera proves the product destroyed.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0d0c0a"; // --bg
const TEXT = "#f4f1ed"; // --text
const TEXT_2 = "#d3d1cd"; // --text-2
const MUTED = "#acaaa7"; // --muted
const FAINT = "#9a9895"; // --faint
const LINE = "rgba(248,241,227,0.08)"; // --line
const SCRIM = "rgba(13,12,10,0.78)"; // --photo-scrim
const PAPER = "#efebe1"; // --paper: the mark's tag
const ACCENT = "#ebb75b"; // --accent (brass): the mark's stub, the only amber on the card

// Schibsted Grotesk for the words, JetBrains Mono for the micro labels and codes, as on the site.
// ImageResponse needs TTF or OTF; Google's CSS API serves TTF to a client that doesn't ask for woff2. If the font
// can't be fetched, the card still renders in the built-in sans.
async function googleFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

const HEAD = "Recall refunds, paid in a minute.";
const TAIL = "Proven destroyed on a live camera.";
const EYEBROW = "RECALL REFUNDS, VERIFIED";
const LABELS = ["CODE M4T", "CPSC 27-071"] as const;
const LEAD = "Remedy turns any CPSC recall into a live refund program, paid through PayPal.";

export default async function OpengraphImage() {
  const [photo, semibold, medium, regular, mono] = await Promise.all([
    readFile(join(process.cwd(), "public/demo/c02-1.jpg")),
    googleFont("Schibsted+Grotesk", 600, "Remedy"),
    googleFont("Schibsted+Grotesk", 500, HEAD + TAIL),
    googleFont("Schibsted+Grotesk", 400, LEAD),
    googleFont("JetBrains+Mono", 500, EYEBROW + LABELS.join("")),
  ]);
  const fonts = [
    ...(semibold ? [{ name: "Schibsted Grotesk", data: semibold, weight: 600 as const, style: "normal" as const }] : []),
    ...(medium ? [{ name: "Schibsted Grotesk", data: medium, weight: 500 as const, style: "normal" as const }] : []),
    ...(regular ? [{ name: "Schibsted Grotesk", data: regular, weight: 400 as const, style: "normal" as const }] : []),
    ...(mono ? [{ name: "JetBrains Mono", data: mono, weight: 500 as const, style: "normal" as const }] : []),
  ];
  const monoFamily = mono ? "JetBrains Mono" : undefined;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: BG, color: TEXT, fontFamily: fonts.length ? "Schibsted Grotesk" : undefined }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "64px 56px 56px 72px" }}>
          {/* The lockup at 44px, so the master lands on 2px a unit (a fractional scale blurred the teeth into a seam): the
              tag is the cap height plus overshoot (0.727em, 32px), 0.25em from the name, its foot on the baseline. The
              viewBox opens 1.5 units above the tag for the stub's lift. flex-end aligns the svg with the line box's foot,
              under the baseline here, hence the margin. */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 11, fontSize: 44, fontWeight: 600, letterSpacing: -1.1, lineHeight: 1 }}>
            <svg width="48" height="35" viewBox="0 -1.5 24 17.5" style={{ marginBottom: 6 }}>
              <path fillRule="evenodd" fill={PAPER} d={MARK_TAG} />
              <path fill={ACCENT} d={MARK_STUB} />
            </svg>
            Remedy
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: monoFamily, fontWeight: 500, fontSize: 17, letterSpacing: 0.7, color: FAINT, marginBottom: 28 }}>{EYEBROW}</div>
            <div style={{ fontSize: 68, fontWeight: 500, lineHeight: 1.04, letterSpacing: -1.7 }}>{HEAD}</div>
            <div style={{ fontSize: 68, fontWeight: 500, lineHeight: 1.04, letterSpacing: -1.7, color: MUTED }}>{TAIL}</div>
            <div style={{ marginTop: 32, fontSize: 26, lineHeight: 1.45, color: TEXT_2, maxWidth: 560 }}>{LEAD}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: 430, padding: "56px 64px 56px 0" }}>
          <div style={{ display: "flex", position: "relative", width: 366, height: 470, borderRadius: 16, border: `1px solid ${LINE}`, overflow: "hidden" }}>
            <img src={`data:image/jpeg;base64,${photo.toString("base64")}`} alt="" width={366} height={549} style={{ objectFit: "cover", objectPosition: "50% 70%", width: 366, height: 470 }} />
            <div style={{ position: "absolute", left: 16, top: 16, display: "flex", padding: "6px 12px", borderRadius: 6, background: SCRIM, fontFamily: monoFamily, fontWeight: 500, fontSize: 17, letterSpacing: 0.7 }}>{LABELS[0]}</div>
          </div>
          <div style={{ display: "flex", marginTop: 16, fontFamily: monoFamily, fontWeight: 500, fontSize: 15, letterSpacing: 0.6, color: FAINT }}>{LABELS[1]}</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
