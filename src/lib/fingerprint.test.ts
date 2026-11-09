import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { dHash, hamming, isLikelySame, SAME_PHOTO_THRESHOLD } from "./fingerprint";

// A 640x480 image of random coloured blocks, the same for the same seed. Blurred, as a photo's edges are soft:
// hard block edges sit right on the hash's sampling grid and flip bits no real photo would.
async function blocks(seed: number): Promise<Buffer> {
  let s = seed;
  const rand = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * 256;
  const cells = Array.from({ length: 12 * 16 }, () => [rand(), rand(), rand()]);
  const raw = Buffer.alloc(640 * 480 * 3);
  for (let y = 0; y < 480; y++) {
    for (let x = 0; x < 640; x++) {
      const c = cells[Math.floor(y / 40) * 16 + Math.floor(x / 40)];
      raw.set(c, (y * 640 + x) * 3);
    }
  }
  return sharp(raw, { raw: { width: 640, height: 480, channels: 3 } }).blur(12).png().toBuffer();
}

describe("dHash", () => {
  it("is 64 bits as 16 hex characters", async () => {
    expect(await dHash(await blocks(1))).toMatch(/^[0-9a-f]{16}$/);
  });

  it.each([1, 2, 3, 4, 5])("matches re-encoded and resized copies (image %i)", async (seed) => {
    const original = await blocks(seed);
    const hash = await dHash(original);
    const copies = [
      await sharp(original).jpeg({ quality: 40 }).toBuffer(),
      await sharp(original).resize(200).png().toBuffer(),
      await sharp(original).resize(1600).webp({ quality: 60 }).toBuffer(),
    ];
    for (const copy of copies) expect(isLikelySame(hash, await dHash(copy))).toBe(true);
  });

  it("doesn't match a different image", async () => {
    const [a, b] = await Promise.all([blocks(1), blocks(2)].map(async (p) => dHash(await p)));
    expect(hamming(a, b)).toBeGreaterThan(SAME_PHOTO_THRESHOLD);
    expect(isLikelySame(a, b)).toBe(false);
  });
});

// The genuine /try photo and the edits the homepage says a repost is still refused after ("resized, re-saved or
// brightened": home/Pipeline.tsx). Each copy goes through the claim page's own encode first (CaptureStep.tsx: longest
// side 1600 px, JPEG 0.85), as an upload would. Measured 9 Nov: a mirror, a crop of 5% or more off one side, a
// screenshot of the photo and a rotation that leaves white corners are not matched, and the page doesn't claim them.
describe("a reposted k01 photo, lightly edited", () => {
  const k01 = readFileSync(new URL("../../public/demo/k01-1.jpg", import.meta.url));
  const upload = (b: Buffer) => sharp(b).resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();

  it.each<[string, (b: Buffer) => Promise<Buffer>]>([
    ["re-saved as JPEG 50", (b) => sharp(b).jpeg({ quality: 50 }).toBuffer()],
    ["resized to 50%", (b) => sharp(b).resize(400).toBuffer()],
    ["brightness +15%", (b) => sharp(b).modulate({ brightness: 1.15 }).toBuffer()],
    ["brightness -15%", (b) => sharp(b).modulate({ brightness: 0.85 }).toBuffer()],
    ["contrast +15%", (b) => sharp(b).linear(1.15, 128 * -0.15).toBuffer()],
    ["contrast -15%", (b) => sharp(b).linear(0.85, 128 * 0.15).toBuffer()],
    ["cropped by 2%, evenly from every side", (b) => sharp(b).extract({ left: 8, top: 12, width: 784, height: 1176 }).toBuffer()],
  ])("matches when %s", async (_, edit) => {
    const [a, b] = await Promise.all([upload(k01), edit(k01).then(upload)].map(async (p) => dHash(await p)));
    expect(isLikelySame(a, b)).toBe(true);
  });
});

describe("hamming", () => {
  it("counts differing bits", () => {
    expect(hamming("0000000000000000", "0000000000000000")).toBe(0);
    expect(hamming("0000000000000000", "ffffffffffffffff")).toBe(64);
    expect(hamming("000000000000000f", "0000000000000001")).toBe(3);
  });
});
