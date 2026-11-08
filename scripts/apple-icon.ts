// Renders src/app/apple-icon.png (180 x 180, opaque) from the mark's master paths, so the home-screen icon never
// drifts from RemedyMark. Run after any change to src/components/ui/markPaths.ts:
//   npx tsx scripts/apple-icon.ts
import { resolve } from "node:path";
import sharp from "sharp";
import { MARK_STUB, MARK_TAG } from "../src/components/ui/markPaths";

const SIZE = 180;
const BG = "#0d0c0a"; // --bg (dark)
const PAPER = "#efebe1"; // --paper: the tag
const ACCENT = "#ebb75b"; // --accent (brass): the stub
// The mark spans x 0 to 23 and y -1.124 to 16 on its grid. At 4.65 units a pixel it is 107px wide, 37px clear of
// each side; the tag (y 0 to 16) is centred, and the stub's lifted corner rises into the top margin.
const SCALE = 4.65;
const X = (SIZE - 23 * SCALE) / 2;
const Y = (SIZE - 16 * SCALE) / 2;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
<rect width="${SIZE}" height="${SIZE}" fill="${BG}"/>
<g transform="translate(${X} ${Y}) scale(${SCALE})"><path fill-rule="evenodd" fill="${PAPER}" d="${MARK_TAG}"/><path fill="${ACCENT}" d="${MARK_STUB}"/></g>
</svg>`;

const out = resolve(import.meta.dirname, "../src/app/apple-icon.png");
sharp(Buffer.from(svg))
  .flatten({ background: BG })
  .png({ compressionLevel: 9 })
  .toFile(out)
  .then(() => console.log(`wrote ${out}`));
