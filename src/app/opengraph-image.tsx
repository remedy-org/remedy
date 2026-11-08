import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The link card for Devpost, Slack and X: the hero's two-tone headline in Schibsted Grotesk on the page colour, beside
// the genuine demo claim's photo. Colours are the Lamplight dark tokens (wave3 DIRECTION.md), as hex.
export const alt = "Remedy: proof it's destroyed, paid in a minute. Recall refunds through PayPal.";
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
const ACCENT = "#f3aa40"; // --accent: the mark's stub, the only amber on the card

// The Claim Check mark, the same 24 x 16 geometry as ui/Wordmark.tsx: the tag (proof) and the amber stub (refund)
// torn from it, lifting at -8deg. The viewBox starts a unit higher to hold the stub's raised corner.
const MARK_TAG =
  "M0 3.5L3.5 0H13L11.667 1.333L13 2.667L11.667 4L13 5.333L11.667 6.667L13 8L11.667 9.333L13 10.667L11.667 12L13 13.333L11.667 14.667L13 16H3.5L0 12.5ZM5.25 8A1.25 1.25 0 1 0 2.75 8A1.25 1.25 0 1 0 5.25 8Z";
const MARK_STUB =
  "M15 0L21.437 -0.905L23.664 14.94L17.227 15.844L15.721 14.709L16.856 13.204L15.35 12.069L16.485 10.563L14.979 9.428L16.113 7.922L14.607 6.787L15.742 5.281L14.236 4.147L15.371 2.641L13.865 1.506Z";

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

const HEAD = "Proof it’s destroyed.";
const TAIL = "Paid in a minute.";
const EYEBROW = "RECALL REFUNDS, VERIFIED";
const LABELS = ["CODE M4T", "AI-MADE TEST PHOTO", "EXHIBIT 01 · CPSC 27-071"] as const;
const LEAD = "Owners cut the recalled product on a live camera. Remedy checks the photo and pays through PayPal.";

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
          {/* The lockup at 30px: the tag is the cap height (0.727em, 22px), 0.3em from the name, its foot on the baseline. */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 9, fontSize: 30, fontWeight: 600, letterSpacing: -0.75, lineHeight: 1 }}>
            <svg width="33" height="23.375" viewBox="0 -1 24 17" style={{ marginBottom: 1 }}>
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
            {/* The photo is AI-made (public/demo/c02-1.jpg); it is never presented as real. */}
            <div style={{ position: "absolute", left: 16, bottom: 16, display: "flex", padding: "6px 12px", borderRadius: 6, background: SCRIM, fontFamily: monoFamily, fontWeight: 500, fontSize: 15, letterSpacing: 0.6, color: TEXT }}>{LABELS[1]}</div>
          </div>
          <div style={{ display: "flex", marginTop: 16, fontFamily: monoFamily, fontWeight: 500, fontSize: 15, letterSpacing: 0.6, color: FAINT }}>{LABELS[2]}</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
