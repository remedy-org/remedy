import sharp from "sharp";

// At or below this many differing bits (of 64), two photos are treated as the same picture.
// Re-encoded or resized copies land at 0-6 in the tests; unrelated images near 32. The usual dHash bar is 10:
// kept lower so two owners' own shots of the same product are less likely to collide.
export const SAME_PHOTO_THRESHOLD = 8;

// Perceptual difference hash: survives re-encoding, resizing and small edits, unlike a byte hash.
// 9x8 grayscale, one bit per pixel: is it brighter than its right-hand neighbour? 64 bits as 16 hex chars.
export async function dHash(image: Buffer): Promise<string> {
  const pixels = await sharp(image).rotate().flatten({ background: "#fff" }).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let hex = "";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x += 4) {
      let nibble = 0;
      for (let k = 0; k < 4; k++) nibble = (nibble << 1) | (pixels[y * 9 + x + k] > pixels[y * 9 + x + k + 1] ? 1 : 0);
      hex += nibble.toString(16);
    }
  }
  return hex;
}

// Hashes are compared a hex digit (4 bits) at a time; tsconfig targets ES2017, so no BigInt.
export function hamming(a: string, b: string): number {
  let count = 0;
  for (let i = 0; i < 16; i++) {
    for (let d = parseInt(a[i], 16) ^ parseInt(b[i], 16); d; d >>= 1) count += d & 1;
  }
  return count;
}

export function isLikelySame(a: string, b: string, threshold = SAME_PHOTO_THRESHOLD): boolean {
  return hamming(a, b) <= threshold;
}
