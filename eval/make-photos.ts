// Makes the eval cases that carry a one-time code, with an OpenAI image model: no photo from the web can have one.
// Each case gets its photos plus a case.json with the answer key. Look at every image before trusting its key:
// image models sometimes misspell text, and the key must describe what is actually in the picture.
// Run: npm run eval:photos [-- c01-pillow-cut-daylight ...]
// With no names it makes every case that has no case.json yet.

import OpenAI, { toFile } from "openai";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import type { Outcome } from "../src/lib/types";

type Want = string | string[];
interface Photo {
  prompt: string;
  from?: string[];
}
interface GenCase {
  name: string;
  code: string;
  expect: Outcome | Outcome[];
  spec: string;
  truth: { label?: Want; steps?: Want[]; code?: Want; screen?: Want };
  note: string;
  photos?: Photo[];
  // Reuse another case's 01.jpg instead of making a photo.
  copy?: string;
}

const client = new OpenAI();
const MODEL = "gpt-image-2.6-sunburst";
// USD per million tokens, from developers.openai.com/api/docs/guides/image-generation (7 Nov 2026).
const RATE = { out: 30, imageIn: 8, textIn: 5 };
const PHONE = "It is an ordinary smartphone photo taken at home: natural light, slightly imperfect framing, real textures, no studio look, and no writing anywhere except what is described.";
const STANDIN = "eval/specs/standin-pillow.json";
const DONE = { label: "yes", steps: ["done", "done"], code: "yes", screen: "no" };
const tag = (code: string, pen = "black marker") =>
  `A white paper luggage tag is tied to it with string. On the tag, in ${pen} handwriting, the first line reads "X-VESOLJE" and the second line reads "${code}", both clearly legible.`;
// The demo claims' tag: tied to one half, in an owner's slightly messy marker, the code always readable.
const ownerTag = (code: string, detail = "") =>
  `A small white paper luggage tag is tied to one piece with thin string, facing the camera. On the tag, in slightly messy black marker handwriting, the first line reads "X-VESOLJE" and the second line reads "${code}"${detail ? `; ${detail}` : ""}. Every character is legible.`;
const dir = (name: string) => join("eval/photos", name);
// The demo recall's own pillow: the CPSC photo's prints, with the tag the spec asks for (no label: CPSC says it has none).
const KIKEA = "eval/specs/kikea-tagged.json";
const KIKEA_REFS = ["w09-kikea-product-photo/01.png", "h02-kikea-feathers-cut/01.jpg"];
const MIXED = "Ordinary mixed indoor light: a ceiling light and a lamp, a little uneven, with soft shadows; not a studio photo. Slightly imperfect framing, real textures, and no writing anywhere except on the tag.";
const PRINTS = {
  leftmost: "white with small blue flowers and green leaves",
  middle: "dark brown with small multicoloured feathers",
  rightmost: "multicoloured jigsaw puzzle pieces in red, blue, teal, yellow and brown",
};
const kikea = (which: keyof typeof PRINTS, scene: string, tagText: string) =>
  `An ordinary smartphone photo, taken at home, of the ${which} pillow in the first picture (${PRINTS[which]}): the same C shape and the same print, ${scene}. It has been cut fully in half with scissors, like the pillow in the second picture: two separate pieces with a gap between them, white polyester stuffing spilling out of both cut ends. ${tagText} ${MIXED}`;

const CASES: GenCase[] = [
  {
    name: "c01-pillow-cut-daylight", code: "K7Q", expect: "pass", spec: STANDIN, truth: DONE,
    note: "Stand-in pillow cut in half in daylight, tag with the label and the right code.",
    photos: [{ prompt: `A plain grey C-shaped nursing pillow lies on a wooden floor in daylight, cut fully in half with scissors: two separate pieces, white stuffing spilling out of both cut ends, a pair of scissors beside them. ${tag("K7Q")} ${PHONE}` }],
  },
  {
    name: "c02-pillow-cut-lamplight", code: "M4T", expect: "pass", spec: STANDIN, truth: DONE,
    note: "Same claim at night under a warm lamp, tag turned at an angle.",
    photos: [{ prompt: `A navy blue C-shaped nursing pillow lies on a beige carpet at night under a warm table lamp, cut fully in half: two separate pieces, stuffing coming out of the cut ends. ${tag("M4T")} The tag is turned at a slight angle to the camera. ${PHONE}` }],
  },
  {
    name: "c03-pillow-two-photos", code: "R8D", expect: "pass", spec: STANDIN, truth: DONE,
    note: "Two photos: the tag close up, then the cut pillow with the same tag.",
    photos: [
      { prompt: `A close-up of a white paper luggage tag tied with string to the fabric of a light green nursing pillow. On the tag, in black marker handwriting, the first line reads "X-VESOLJE" and the second line reads "R8D". ${PHONE}` },
      { from: ["c03-pillow-two-photos/01.jpg"], prompt: `A wider photo of the same light green C-shaped nursing pillow with the same tag, now cut once through the middle on a tiled kitchen floor: exactly two pieces, each with one cut end with stuffing coming out and one rounded, closed end, scissors nearby. Keep the tag and its writing exactly the same; it is small but readable. ${PHONE}` },
    ],
  },
  {
    // The first c03 came out with three cut ends on two pieces, which one cut can't make. Kept as a trap.
    // Remaking it may not reproduce the flaw: check by eye.
    name: "c14-two-photos-extra-cut", code: "R8D", expect: ["hold", "reject"], spec: STANDIN, truth: { ...DONE, steps: [["unclear", "not_done"], "done"] },
    note: "Made as c03, but photo 2 came out with three cut ends on two pieces, which one cut cannot make. Kept as an AI-artifact trap; Astra spotted it first.",
    photos: [
      { prompt: `A close-up of a white paper luggage tag tied with string to the fabric of a light green nursing pillow. On the tag, in black marker handwriting, the first line reads "X-VESOLJE" and the second line reads "R8D". ${PHONE}` },
      { from: ["c14-two-photos-extra-cut/01.jpg"], prompt: `A wider photo of the same light green C-shaped nursing pillow with the same tag, now cut fully in half on a tiled kitchen floor: two separate pieces, stuffing out, scissors nearby. Keep the tag and its writing exactly the same; it is small but readable. ${PHONE}` },
    ],
  },
  {
    name: "c04-pillow-not-cut", code: "B2P", expect: "reject", spec: STANDIN, truth: { ...DONE, steps: ["not_done", "done"] },
    note: "Right label and code, but the pillow is whole.",
    photos: [{ prompt: `A grey C-shaped nursing pillow lies whole and undamaged on a made bed. ${tag("B2P")} ${PHONE}` }],
  },
  {
    name: "c05-pillow-code-scrawled", code: "K7Q", expect: ["pass", "hold"], spec: STANDIN, truth: DONE,
    note: "Code scrawled fast in ballpoint, tag half in shadow but readable.",
    photos: [{ prompt: `A beige C-shaped nursing pillow lies on a bathroom floor, cut fully in half: two separate pieces with stuffing out. ${tag("K7Q", "quick, slanted blue ballpoint")} The tag is half in shadow, but every character can still be read. ${PHONE}` }],
  },
  {
    name: "c06-steamfast-tag", code: "K7Q", expect: "pass", spec: "eval/specs/steamfast-steamer.json", truth: DONE,
    note: "Edit of the Steamfast example photo (w03): on a counter, annotations removed, code tag added.",
    photos: [{ from: ["w03-steamfast-photo-only/01.jpg"], prompt: `Turn this product picture into an ordinary smartphone photo of the same steamer lying on a kitchen counter. Remove both red rectangles. Keep the label and every character on it exactly as it is, and keep the cut black power cord. Add a small white paper tag taped to the steamer just below the label, with "K7Q" handwritten on it in black marker.` }],
  },
  {
    name: "c07-hothands-marker", code: "K7Q", expect: "pass", spec: "eval/specs/hothands-warmer.json", truth: DONE,
    note: "Edit of the CPSC HotHands label photo (w08): on a desk, annotations removed, \"RECALLED K7Q\" in marker, as the recall asks.",
    photos: [{ from: ["w08-hothands-product-photos/02.png"], prompt: `Turn this product picture into an ordinary smartphone photo of the same hand warmer lying on a wooden desk. Remove the red arrows, the red boxes and the red words "Model Number" and "Batch Number". Keep every character of the printed grey label exactly as it is, including "Model: H163650" and "E225". In the blank upper half of the warmer, add "RECALLED K7Q" handwritten in black permanent marker.` }],
  },
  {
    name: "c08-kikea-cut", code: "K7Q", expect: "pass", spec: "eval/specs/kikea-pillow.json", truth: { label: "yes", steps: ["done"], code: "yes", screen: "no" },
    note: "Edit of the CPSC Kikea photo (w09): the leaf-pattern pillow cut in half, code tag beside it.",
    photos: [{ from: ["w09-kikea-product-photo/01.png"], prompt: `An ordinary smartphone photo on a living-room rug of the leftmost pillow in this picture (C-shaped, white with blue flowers and green leaves), now cut fully in half with scissors: two separate pieces with stuffing spilling out. Beside it lies a white paper tag with "K7Q" handwritten on it in black marker. Only that one pillow appears.` }],
  },
  {
    name: "c09-written-K7O", code: "K7Q", expect: "reject", spec: STANDIN, truth: { ...DONE, code: "no" },
    note: "Tag says K7O (letter O), the claim expects K7Q.",
    photos: [{ prompt: `A dark green C-shaped nursing pillow lies on a wooden floor, cut fully in half: two separate pieces, stuffing spilling out. A white paper luggage tag is tied to it with string. On the tag, in black marker handwriting, the first line reads "X-VESOLJE" and the second line reads "K7O", where the last character is a round capital letter O with no tail. ${PHONE}` }],
  },
  {
    name: "c10-photo-of-screen", code: "K7Q", expect: ["reject", "hold"], spec: STANDIN, truth: { code: "yes", screen: "yes" },
    note: "c01 shown on a laptop and photographed with a phone.",
    photos: [{ from: ["c01-pillow-cut-daylight/01.jpg"], prompt: `A smartphone photo of a laptop screen that is showing this exact picture full screen. The laptop's bezel and part of its keyboard are visible, with some glare and moiré on the screen.` }],
  },
  // Held out: written after the round-1 spec and key fixes, to check those fixes on photos the fixes never saw.
  {
    name: "h01-hothands-in-hand", code: "H3W", expect: "pass", spec: "eval/specs/hothands-warmer.json", truth: DONE,
    note: "Held out. Edit of the CPSC HotHands label photo (w08), held in a hand outdoors.",
    photos: [{ from: ["w08-hothands-product-photos/02.png"], prompt: `Turn this product picture into an ordinary smartphone photo of the same hand warmer held in someone's hand outdoors on a cloudy day. Remove the red arrows, the red boxes and the red words "Model Number" and "Batch Number". Keep every character of the printed grey label exactly as it is. In the blank upper half of the warmer, add "RECALLED H3W" handwritten in black marker.` }],
  },
  {
    name: "h02-kikea-feathers-cut", code: "T6M", expect: "pass", spec: "eval/specs/kikea-pillow.json", truth: { label: "yes", steps: ["done"], code: "yes", screen: "no" },
    note: "Held out. Edit of the CPSC Kikea photo (w09): the feather-print pillow, cut on a bed.",
    photos: [{ from: ["w09-kikea-product-photo/01.png"], prompt: `An ordinary smartphone photo on an unmade bed of the middle pillow in this picture (C-shaped, dark brown with multicoloured feathers), now cut fully in half with scissors: two separate pieces with stuffing spilling out. Beside it lies a white paper tag with "T6M" handwritten on it in black marker. Only that one pillow appears.` }],
  },
  {
    name: "h03-standin-wrong-label", code: "N5K", expect: ["reject", "hold"], spec: STANDIN, truth: { ...DONE, label: "no" },
    note: "Held out. Cut stand-in with the right code, but the tag says X-VESOLIE (I, not J).",
    photos: [{ prompt: `A grey C-shaped nursing pillow lies on a wooden floor, cut fully in half: two separate pieces, stuffing spilling out. A white paper luggage tag is tied to it with string. On the tag, in neat black marker capitals, the first line reads "X-VESOLIE" (the letter before the E is a capital I, not a J) and the second line reads "N5K". ${PHONE}` }],
  },
  {
    name: "h04-steamfast-wrong-model", code: "W2H", expect: "reject", spec: "eval/specs/steamfast-steamer.json", truth: { ...DONE, label: "no" },
    note: "Held out. Edit of the Steamfast photo (w03) with the model changed to SF-430, which isn't recalled.",
    photos: [{ from: ["w03-steamfast-photo-only/01.jpg"], prompt: `Turn this product picture into an ordinary smartphone photo of the same steamer lying on an ironing board. Remove both red rectangles. On the label, change only the model line so it reads "MODEL: SF-430 COMPACT FABRIC STEAMER"; keep every other character exactly as it is. Keep the cut black power cord. Add a small white paper tag taped just below the label with "W2H" handwritten on it in black marker.` }],
  },
  {
    name: "h05-pillow-slit-only", code: "J4C", expect: ["reject", "hold"], spec: STANDIN, truth: { ...DONE, steps: [["not_done", "unclear"], "done"] },
    note: "Held out. Right tag and code, but the pillow only has a short slit; it is not cut in half.",
    photos: [{ prompt: `A grey C-shaped nursing pillow lies whole on a sofa, with one short slit about 10 cm long in its side and a little stuffing poking out of the slit; it is otherwise intact and in one piece. ${tag("J4C")} ${PHONE}` }],
  },
  // The demo recall's claims (src/lib/demo/claims.ts): the recalled pillow itself, in one of its three prints, cut in half
  // and tagged. Edits of the CPSC photo (w09) for the print, with h02 for how a cut one looks.
  {
    name: "k01-feathers-M4T", code: "M4T", expect: "pass", spec: KIKEA, truth: DONE,
    note: "RM-0442, the genuine claim: the feather print cut in half, tag with X-VESOLJE and M4T.",
    photos: [{ from: KIKEA_REFS, prompt: kikea("middle", "lying on a beige living-room rug in the evening, a pair of kitchen scissors beside it", ownerTag("M4T")) }],
  },
  {
    name: "k02-floral-K7Q", code: "K7P", expect: "reject", spec: KIKEA, truth: { ...DONE, code: "no" },
    note: "RM-0118: the floral print cut in half, but the tag reads K7Q (Q is never issued) and the claim's code is K7P.",
    photos: [{ from: KIKEA_REFS, prompt: kikea("leftmost", "lying on a grey tiled kitchen floor", ownerTag("K7Q", "the last character is a capital Q with a clear tail")) }],
  },
  {
    name: "k03-feathers-half-H9D", code: "H9D", expect: ["hold", "reject"], spec: KIKEA, truth: { ...DONE, steps: [["unclear", "not_done"], "done"] },
    note: "RM-9629: the feather print, but only one cut half is in the frame, so the photo can't show it was cut fully in half.",
    photos: [{
      from: KIKEA_REFS,
      prompt: `An ordinary smartphone photo, taken at home, of one piece of the middle pillow in the first picture (dark brown with small multicoloured feathers), same print. The pillow has been cut with scissors and only one of its pieces is in the photo: a close shot of that one piece lying on a sofa cushion, its cut end toward the camera with white polyester stuffing coming out; whatever else there is lies outside the frame. ${ownerTag("H9D")} ${MIXED}`,
    }],
  },
  {
    name: "k04-puzzle-joined-F3X", code: "F3X", expect: ["hold", "reject"], spec: KIKEA, truth: { ...DONE, steps: [["unclear", "not_done"], "done"] },
    note: "RM-6276 (and its repost RM-2125): the puzzle print cut most of the way across, the two halves still joined by a strip of uncut fabric.",
    photos: [{
      from: KIKEA_REFS,
      prompt: `An ordinary smartphone photo, taken at home, of the rightmost pillow in the first picture (multicoloured jigsaw puzzle pieces in red, blue, teal, yellow and brown), same C shape and print, lying on a wooden bedroom floor. It has been cut with scissors across the middle, but not all the way: the two halves are still joined by a strip of uncut fabric about 5 cm wide along the inner edge of the C, and white stuffing spills out of the cut. ${ownerTag("F3X")} ${MIXED}`,
    }],
  },
  {
    name: "k05-puzzle-J4R", code: "J4R", expect: "pass", spec: KIKEA, truth: DONE,
    note: "RM-9475: the puzzle print cut in half on a bed, tag with X-VESOLJE and J4R; the claim is blocked before the photo check (unverified account).",
    photos: [{ from: KIKEA_REFS, prompt: kikea("rightmost", "lying on an unmade bed, a window to one side", ownerTag("J4R")) }],
  },
  {
    name: "k07-feathers-tag-loose-H9D", code: "H9D", expect: ["hold", "reject"], spec: KIKEA, truth: { ...DONE, steps: ["done", ["unclear", "not_done"]] },
    note: "The feather print cut in half, but the tag lies loose beside it, its string untied, so the photo can't show it was on this pillow.",
    photos: [{
      from: KIKEA_REFS,
      prompt: kikea("middle", "lying on a grey sofa", `A small white paper luggage tag lies loose on the sofa a hand's width from the pillow, not tied to anything, its untied string trailing. On the tag, in slightly messy black marker handwriting, the first line reads "X-VESOLJE" and the second line reads "H9D". Every character is legible.`),
    }],
  },
  {
    name: "k08-feathers-smudged-H9D", code: "H9D", expect: ["hold", "reject"], spec: KIKEA, truth: { ...DONE, code: ["unclear", "no"] },
    note: "The feather print cut in half, but the tag's last character is smudged by a thumb, so the code can't be read for sure.",
    photos: [{ from: KIKEA_REFS, prompt: kikea("middle", "lying on a wooden floor by a radiator", ownerTag("H9D", "the marker on the last character has been smudged by a thumb into a soft grey smear, so it could be a D or an O")) }],
  },
  {
    name: "k09-floral-tag-tucked-H9D", code: "H9D", expect: ["hold", "reject"], spec: KIKEA, truth: { ...DONE, code: ["unclear", "no"] },
    note: "The floral print cut in half, the tag tied on, but its second line runs under the pillow's edge: only the H of H9D shows.",
    photos: [{
      from: KIKEA_REFS,
      prompt: kikea("leftmost", "lying on a pale bedspread", `A small white paper luggage tag is tied to one piece with thin string. The tag has slipped partly under the edge of that piece: its first line, "X-VESOLJE" in slightly messy black marker, is fully visible, but of its second line only the first character, a hand-written "H", shows; the rest of that line is hidden under the pillow's fabric.`),
    }],
  },
  {
    name: "k10-puzzle-far-dim-H9D", code: "H9D", expect: ["hold", "reject"], spec: KIKEA, truth: { ...DONE, code: ["unclear", "no"] },
    note: "The puzzle print cut in half, shot from standing height in a dim room: the tag is small and its writing too soft to read character by character.",
    photos: [{
      from: KIKEA_REFS,
      prompt: `An ordinary smartphone photo taken from standing height, looking down from about two metres, of the rightmost pillow in the first picture (multicoloured jigsaw puzzle pieces in red, blue, teal, yellow and brown) lying in the middle of a large living-room rug, cut fully in half: two separate pieces, stuffing out of the cut ends. A small white paper tag is tied to one piece with string; it is small in the frame, and its two hand-written lines are too small and soft to make out character by character. The room is dim, lit by one lamp in the evening, and the photo is slightly blurred by camera shake. Real textures, no studio look, no other writing anywhere.`,
    }],
  },
  {
    name: "k11-feathers-J4R", code: "J4R", expect: "pass", spec: KIKEA, truth: DONE,
    note: "RM-9475: the feather print cut in half on a bedroom floor, tag with X-VESOLJE and J4R; the claim is blocked before the photo check (unverified account).",
    photos: [{ from: KIKEA_REFS, prompt: kikea("middle", "lying on a dark wooden bedroom floor beside the foot of a bed, grey morning light from a window mixing with a ceiling light", ownerTag("J4R")) }],
  },
  {
    name: "k06-floral-screen-C7W", code: "C7W", expect: ["reject", "hold"], spec: KIKEA, truth: { code: "yes", screen: "yes" },
    note: "A photo of a laptop screen showing the floral print cut in half, tag with X-VESOLJE and C7W.",
    photos: [{
      from: KIKEA_REFS,
      prompt: `A smartphone photo of a laptop screen on a desk. The screen shows, full screen, a photo of the leftmost pillow in the first picture (white with small blue flowers and green leaves) cut fully in half, white stuffing out of the cut ends. ${ownerTag("C7W")} The laptop's bezel and part of its keyboard are visible, with a lamp's glare and faint moiré on the screen. ${MIXED}`,
    }],
  },
  { name: "c11-wrong-code-K7P", copy: "c01-pillow-cut-daylight", code: "K7P", expect: "reject", spec: STANDIN, truth: { ...DONE, code: "no" }, note: "c01's photo (K7Q written), but this claim's code is K7P." },
  { name: "c12-wrong-code-K1Q", copy: "c06-steamfast-tag", code: "K1Q", expect: "reject", spec: "eval/specs/steamfast-steamer.json", truth: { ...DONE, code: "no" }, note: "c06's photo (K7Q written), but this claim's code is K1Q." },
  { name: "c13-wrong-code-K7G", copy: "c07-hothands-marker", code: "K7G", expect: "reject", spec: "eval/specs/hothands-warmer.json", truth: { ...DONE, code: "no" }, note: "c07's photo (K7Q written), but this claim's code is K7G." },
];

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };
let cost = 0;

async function makePhoto({ prompt, from }: Photo): Promise<Buffer> {
  const common = { model: MODEL, prompt, size: "1024x1536", quality: "high", output_format: "jpeg" } as const;
  const result = from
    ? await client.images.edit({ ...common, image: await Promise.all(from.map((p) => toFile(readFileSync(dir(p)), basename(p), { type: MIME[extname(p)] }))) })
    : await client.images.generate(common);
  const u = result.usage;
  if (u) {
    const imageIn = u.input_tokens_details?.image_tokens ?? 0;
    cost += (u.output_tokens * RATE.out + imageIn * RATE.imageIn + (u.input_tokens - imageIn) * RATE.textIn) / 1e6;
  }
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("no image in the response");
  return Buffer.from(b64, "base64");
}

async function main() {
  const wanted = process.argv.slice(2);
  const made: Record<string, Promise<void>> = {};
  for (const c of CASES) {
    if (wanted.length ? !wanted.includes(c.name) : existsSync(join(dir(c.name), "case.json"))) continue;
    // Cases built on another case's photo wait for that case first.
    const needs = [c.copy, ...(c.photos || []).flatMap((p) => p.from || []).map((p) => p.split("/")[0])].filter((n): n is string => Boolean(n && made[n]));
    made[c.name] = Promise.all(needs.map((n) => made[n])).then(async () => {
      mkdirSync(dir(c.name), { recursive: true });
      if (c.copy) copyFileSync(join(dir(c.copy), "01.jpg"), join(dir(c.name), "01.jpg"));
      for (const [i, p] of (c.photos || []).entries()) writeFileSync(join(dir(c.name), `0${i + 1}.jpg`), await makePhoto(p));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { name, copy, photos, ...rest } = c;
      writeFileSync(join(dir(name), "case.json"), JSON.stringify({ ...rest, made: copy ? `copy of ${copy}` : MODEL }, null, 2));
      console.log(`made ${name}`);
    }).catch((e) => console.log(`FAILED ${c.name}: ${e instanceof Error ? e.message : e}`));
  }
  await Promise.all(Object.values(made));
  console.log(`Image cost: about $${cost.toFixed(2)}.`);
}

main();
