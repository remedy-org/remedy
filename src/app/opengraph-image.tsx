import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The link card for Devpost, Slack and X: the hero's two-tone headline in Instrument Sans on the page colour, beside
// the genuine demo claim's photo. Colours are the dark tokens from globals.css, as hex.
export const alt = "Remedy: proof it's destroyed, paid in a minute. Recall refunds through PayPal.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0b0f14";
const TEXT = "#eff2f5";
const MUTED = "#a0a5ac";
const FAINT = "#878d94";
const AMBER = "#f2b95a";
const LINE = "#2a2e34";
const ACCENT = "#f5ae39";
const ACCENT_INK = "#24180a";

// ImageResponse needs TTF or OTF; Google's CSS API serves TTF to a client that doesn't ask for woff2. If the font
// can't be fetched, the card still renders in the built-in sans.
async function instrumentSans(weight: 400 | 600, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@${weight}&text=${encodeURIComponent(text)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

const HEAD = "Proof it’s destroyed.";
const TAIL = "Paid in a minute.";
const EYEBROW = "RECALL REFUNDS, VERIFIED";
const LEAD = "Owners cut the recalled product on a live camera. Remedy checks the photo and pays through PayPal.";

export default async function OpengraphImage() {
  const [photo, semibold, regular] = await Promise.all([
    readFile(join(process.cwd(), "public/demo/c02-1.jpg")),
    instrumentSans(600, HEAD + TAIL + "Remedy"),
    instrumentSans(400, LEAD + EYEBROW + "Exhibit 01 · CPSC 27-071 M4T AI-MADE TEST PHOTO"),
  ]);
  const fonts = [
    ...(semibold ? [{ name: "Instrument Sans", data: semibold, weight: 600 as const, style: "normal" as const }] : []),
    ...(regular ? [{ name: "Instrument Sans", data: regular, weight: 400 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: BG, color: TEXT, fontFamily: fonts.length ? "Instrument Sans" : undefined }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "64px 56px 56px 72px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 28, fontWeight: 600 }}>
            {/* The tag mark from ui/Wordmark.tsx: an amber evidence tag on a string loop, hanging at -8deg. */}
            <svg width="34" height="34" viewBox="1.5 2.5 21 21">
              <g transform="rotate(-8 12 15)">
                <path
                  fillRule="evenodd"
                  fill={ACCENT}
                  d="M9.5 8.5h5l3.5 3.5v9.25c0 .97-.78 1.75-1.75 1.75h-8.5c-.97 0-1.75-.78-1.75-1.75V12zM13.5 12a1.5 1.5 0 1 0-3 0a1.5 1.5 0 1 0 3 0z"
                />
                <path d="M9 16.25h6M9 19.25h3.5" stroke={ACCENT_INK} strokeWidth="1.5" strokeLinecap="round" />
                <path d="M12 12C10.4 9 9.2 5 11.6 3.6c2.4-1.4 4.2 1.8 2.1 4.8-.6.9-1.1 2.1-1.3 3.5" fill="none" stroke={MUTED} strokeWidth="1.4" strokeLinecap="round" />
              </g>
            </svg>
            Remedy
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 18, letterSpacing: 2, color: AMBER, marginBottom: 28 }}>{EYEBROW}</div>
            <div style={{ fontSize: 76, fontWeight: 600, lineHeight: 1.04, letterSpacing: -2 }}>{HEAD}</div>
            <div style={{ fontSize: 76, fontWeight: 600, lineHeight: 1.04, letterSpacing: -2, color: MUTED }}>{TAIL}</div>
            <div style={{ marginTop: 32, fontSize: 26, lineHeight: 1.45, color: MUTED, maxWidth: 560 }}>{LEAD}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: 430, padding: "56px 64px 56px 0" }}>
          <div style={{ display: "flex", position: "relative", width: 366, height: 470, borderRadius: 16, border: `1px solid ${LINE}`, overflow: "hidden" }}>
            <img src={`data:image/jpeg;base64,${photo.toString("base64")}`} alt="" width={366} height={549} style={{ objectFit: "cover", objectPosition: "50% 70%", width: 366, height: 470 }} />
            <div style={{ position: "absolute", left: 16, top: 16, display: "flex", padding: "6px 12px", borderRadius: 6, background: "rgba(11,15,20,0.82)", fontSize: 18, letterSpacing: 1.5 }}>CODE M4T</div>
            {/* The photo is AI-made (public/demo/c02-1.jpg); it is never presented as real. */}
            <div style={{ position: "absolute", left: 16, bottom: 16, display: "flex", padding: "6px 12px", borderRadius: 6, background: "rgba(11,15,20,0.82)", fontSize: 16, letterSpacing: 1.5, color: MUTED }}>AI-MADE TEST PHOTO</div>
          </div>
          <div style={{ display: "flex", marginTop: 16, fontSize: 16, letterSpacing: 1.5, color: FAINT }}>EXHIBIT 01 · CPSC 27-071</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
