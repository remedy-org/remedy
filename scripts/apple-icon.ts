// Generate matching browser/home-screen icons from the original Remedy mark.
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { MARK_STUB, MARK_TAG } from "../src/components/ui/markPaths";
async function main() {
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><rect width="180" height="180" rx="38" fill="#000000"/><g transform="translate(30 30) scale(5)"><path fill="#fafafa" fill-rule="evenodd" d="${MARK_TAG}${MARK_STUB}"/></g></svg>`;
await sharp(Buffer.from(svg)).png().toFile(resolve("src/app/apple-icon.png"));
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#000000"/><path transform="translate(4 4)" fill="#fafafa" fill-rule="evenodd" d="${MARK_TAG}${MARK_STUB}"/></svg>`;
await writeFile(resolve("src/app/icon.svg"), favicon);
const png = await sharp(Buffer.from(favicon)).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4); header[6] = 32; header[7] = 32;
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
await writeFile(resolve("src/app/favicon.ico"), Buffer.concat([header, png]));
console.log("Generated Remedy SVG, favicon and apple icon.");

}
void main();
