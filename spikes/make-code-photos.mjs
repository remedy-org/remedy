// Makes the spike 2 cases that carry a one-time code, with an OpenAI image model: no photo from the web can have one.
// Each case gets its photos plus a case.json with the answer key. Look at every image before trusting its key:
// image models sometimes misspell text, and the key must describe what is actually in the picture.
// Run: node --env-file=.env spikes/make-code-photos.mjs [c01-pillow-cut-daylight ...]
// With no names it makes every case that has no case.json yet.

import OpenAI, { toFile } from "openai";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

const client = new OpenAI();
const MODEL = "gpt-image-2.6-sunburst";
// USD per million tokens, from developers.openai.com/api/docs/guides/image-generation (7 Nov 2026).
const RATE = { out: 30, imageIn: 8, textIn: 5 };
const PHONE = "It is an ordinary smartphone photo taken at home: natural light, slightly imperfect framing, real textures, no studio look, and no writing anywhere except what is described.";
const STANDIN = "spikes/specs/standin-pillow.json";
const DONE = { label: "yes", steps: ["done", "done"], code: "yes", screen: "no" };
const tag = (code, pen = "black marker") =>
  `A white paper luggage tag is tied to it with string. On the tag, in ${pen} handwriting, the first line reads "X-VESOLJE" and the second line reads "${code}", both clearly legible.`;
const dir = (name) => join("spikes/photos", name);

const CASES = [
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
    name: "c06-steamfast-tag", code: "K7Q", expect: "pass", spec: "spikes/specs/steamfast-steamer.json", truth: DONE,
    note: "Edit of the Steamfast example photo (w03): on a counter, annotations removed, code tag added.",
    photos: [{ from: ["w03-steamfast-photo-only/01.jpg"], prompt: `Turn this product picture into an ordinary smartphone photo of the same steamer lying on a kitchen counter. Remove both red rectangles. Keep the label and every character on it exactly as it is, and keep the cut black power cord. Add a small white paper tag taped to the steamer just below the label, with "K7Q" handwritten on it in black marker.` }],
  },
  {
    name: "c07-hothands-marker", code: "K7Q", expect: "pass", spec: "spikes/specs/hothands-warmer.json", truth: DONE,
    note: "Edit of the CPSC HotHands label photo (w08): on a desk, annotations removed, \"RECALLED K7Q\" in marker, as the recall asks.",
    photos: [{ from: ["w08-hothands-product-photos/02.png"], prompt: `Turn this product picture into an ordinary smartphone photo of the same hand warmer lying on a wooden desk. Remove the red arrows, the red boxes and the red words "Model Number" and "Batch Number". Keep every character of the printed grey label exactly as it is, including "Model: H163650" and "E225". In the blank upper half of the warmer, add "RECALLED K7Q" handwritten in black permanent marker.` }],
  },
  {
    name: "c08-kikea-cut", code: "K7Q", expect: "pass", spec: "spikes/specs/kikea-pillow.json", truth: { label: "yes", steps: ["done"], code: "yes", screen: "no" },
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
    name: "h01-hothands-in-hand", code: "H3W", expect: "pass", spec: "spikes/specs/hothands-warmer.json", truth: DONE,
    note: "Held out. Edit of the CPSC HotHands label photo (w08), held in a hand outdoors.",
    photos: [{ from: ["w08-hothands-product-photos/02.png"], prompt: `Turn this product picture into an ordinary smartphone photo of the same hand warmer held in someone's hand outdoors on a cloudy day. Remove the red arrows, the red boxes and the red words "Model Number" and "Batch Number". Keep every character of the printed grey label exactly as it is. In the blank upper half of the warmer, add "RECALLED H3W" handwritten in black marker.` }],
  },
  {
    name: "h02-kikea-feathers-cut", code: "T6M", expect: "pass", spec: "spikes/specs/kikea-pillow.json", truth: { label: "yes", steps: ["done"], code: "yes", screen: "no" },
    note: "Held out. Edit of the CPSC Kikea photo (w09): the feather-print pillow, cut on a bed.",
    photos: [{ from: ["w09-kikea-product-photo/01.png"], prompt: `An ordinary smartphone photo on an unmade bed of the middle pillow in this picture (C-shaped, dark brown with multicoloured feathers), now cut fully in half with scissors: two separate pieces with stuffing spilling out. Beside it lies a white paper tag with "T6M" handwritten on it in black marker. Only that one pillow appears.` }],
  },
  {
    name: "h03-standin-wrong-label", code: "N5K", expect: ["reject", "hold"], spec: STANDIN, truth: { ...DONE, label: "no" },
    note: "Held out. Cut stand-in with the right code, but the tag says X-VESOLIE (I, not J).",
    photos: [{ prompt: `A grey C-shaped nursing pillow lies on a wooden floor, cut fully in half: two separate pieces, stuffing spilling out. A white paper luggage tag is tied to it with string. On the tag, in neat black marker capitals, the first line reads "X-VESOLIE" (the letter before the E is a capital I, not a J) and the second line reads "N5K". ${PHONE}` }],
  },
  {
    name: "h04-steamfast-wrong-model", code: "W2H", expect: "reject", spec: "spikes/specs/steamfast-steamer.json", truth: { ...DONE, label: "no" },
    note: "Held out. Edit of the Steamfast photo (w03) with the model changed to SF-430, which isn't recalled.",
    photos: [{ from: ["w03-steamfast-photo-only/01.jpg"], prompt: `Turn this product picture into an ordinary smartphone photo of the same steamer lying on an ironing board. Remove both red rectangles. On the label, change only the model line so it reads "MODEL: SF-430 COMPACT FABRIC STEAMER"; keep every other character exactly as it is. Keep the cut black power cord. Add a small white paper tag taped just below the label with "W2H" handwritten on it in black marker.` }],
  },
  {
    name: "h05-pillow-slit-only", code: "J4C", expect: ["reject", "hold"], spec: STANDIN, truth: { ...DONE, steps: [["not_done", "unclear"], "done"] },
    note: "Held out. Right tag and code, but the pillow only has a short slit; it is not cut in half.",
    photos: [{ prompt: `A grey C-shaped nursing pillow lies whole on a sofa, with one short slit about 10 cm long in its side and a little stuffing poking out of the slit; it is otherwise intact and in one piece. ${tag("J4C")} ${PHONE}` }],
  },
  { name: "c11-wrong-code-K7P", copy: "c01-pillow-cut-daylight", code: "K7P", expect: "reject", spec: STANDIN, truth: { ...DONE, code: "no" }, note: "c01's photo (K7Q written), but this claim's code is K7P." },
  { name: "c12-wrong-code-K1Q", copy: "c06-steamfast-tag", code: "K1Q", expect: "reject", spec: "spikes/specs/steamfast-steamer.json", truth: { ...DONE, code: "no" }, note: "c06's photo (K7Q written), but this claim's code is K1Q." },
  { name: "c13-wrong-code-K7G", copy: "c07-hothands-marker", code: "K7G", expect: "reject", spec: "spikes/specs/hothands-warmer.json", truth: { ...DONE, code: "no" }, note: "c07's photo (K7Q written), but this claim's code is K7G." },
];

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };
let cost = 0;

async function makePhoto({ prompt, from }) {
  const common = { model: MODEL, prompt, size: "1024x1536", quality: "high", output_format: "jpeg" };
  const result = from
    ? await client.images.edit({ ...common, image: await Promise.all(from.map((p) => toFile(readFileSync(dir(p)), basename(p), { type: MIME[extname(p)] }))) })
    : await client.images.generate(common);
  const u = result.usage;
  const imageIn = u.input_tokens_details?.image_tokens ?? 0;
  cost += (u.output_tokens * RATE.out + imageIn * RATE.imageIn + (u.input_tokens - imageIn) * RATE.textIn) / 1e6;
  return Buffer.from(result.data[0].b64_json, "base64");
}

const wanted = process.argv.slice(2);
const made = {};
for (const c of CASES) {
  if (wanted.length ? !wanted.includes(c.name) : existsSync(join(dir(c.name), "case.json"))) continue;
  // Cases built on another case's photo wait for that case first.
  const needs = [c.copy, ...(c.photos || []).flatMap((p) => p.from || []).map((p) => p.split("/")[0])].filter((n) => made[n]);
  made[c.name] = Promise.all(needs.map((n) => made[n])).then(async () => {
    mkdirSync(dir(c.name), { recursive: true });
    if (c.copy) copyFileSync(join(dir(c.copy), "01.jpg"), join(dir(c.name), "01.jpg"));
    for (const [i, p] of (c.photos || []).entries()) writeFileSync(join(dir(c.name), `0${i + 1}.jpg`), await makePhoto(p));
    const { name, copy, photos, ...rest } = c;
    writeFileSync(join(dir(name), "case.json"), JSON.stringify({ ...rest, made: copy ? `copy of ${copy}` : MODEL }, null, 2));
    console.log(`made ${name}`);
  }).catch((e) => console.log(`FAILED ${c.name}: ${e.message}`));
}
await Promise.all(Object.values(made));
console.log(`Image cost: about $${cost.toFixed(2)}.`);
