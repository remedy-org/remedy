import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseUsage } from "openai/resources/responses/responses";
import sharp from "sharp";
import { env } from "../env";
import { Verdict, type CheckSpec } from "../types";

// This exact wording (docs/EVAL.md) was evaluated over 36 claims x 4 models.
export const SYSTEM = `You examine photos submitted as proof for a product-recall refund. Money is paid only if the photos prove the claim, so be strict and literal.
- Report only what is visible. Quote any text you can read exactly as written. If you can't see something clearly, say "unclear"; never assume.
- Check each proof step separately against the photos.
- The claimant was asked to hand-write a one-time code on the product or its tag before taking the photos. Compare what's written with the expected code, character by character. If no code is written anywhere in the photos, it does not match: answer "no".
- Note anything suggesting the image is a photo of a screen or a print, or that the photos show different items.`;

// Same text as the spike's check(); a null code turns the code check off.
export function buildPrompt(spec: CheckSpec, code: string | null): string {
  const label = spec.label_must_show.length
    ? `The label must show: ${spec.label_must_show.join(", ")}.`
    : "This product has no label: judge whether it is the recalled product from its shape and pattern.";
  return `Recalled product: ${spec.product}. ${label}
Proof steps to check, in this order:
${spec.proof_steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}
${code ? `Expected one-time code: ${code}` : 'This claim has no one-time code; answer "unclear" for the code.'}`;
}

// The models read at most 1568 px on the long side; phone photos are bigger. Never upscale.
// rotate() applies the EXIF orientation, so a phone photo isn't sent sideways.
export async function prepareImage(image: Buffer): Promise<Buffer> {
  return sharp(image).rotate().resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
}

export interface VisionResult {
  verdict: Verdict;
  usage: ResponseUsage | null;
  model: string;
  seconds: number;
}

// The model describes; rule.ts decides.
export async function runVisionCheck({
  images,
  spec,
  code,
  client = new OpenAI({ apiKey: env().OPENAI_API_KEY }),
}: {
  images: Buffer[];
  spec: CheckSpec;
  code: string | null;
  client?: OpenAI;
}): Promise<VisionResult> {
  if (images.length < 1 || images.length > 3) throw new Error(`Expected 1-3 photos, got ${images.length}`);
  const { VISION_MODEL, VISION_EFFORT } = env();
  const started = Date.now();
  const jpegs = await Promise.all(images.map(prepareImage));
  // "original" detail keeps small label text readable.
  const response = await client.responses.parse({
    model: VISION_MODEL,
    reasoning: { effort: VISION_EFFORT },
    input: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          ...jpegs.map((j) => ({ type: "input_image" as const, image_url: `data:image/jpeg;base64,${j.toString("base64")}`, detail: "original" as const })),
          { type: "input_text" as const, text: buildPrompt(spec, code) },
        ],
      },
    ],
    text: { format: zodTextFormat(Verdict, "verdict") },
  });
  if (!response.output_parsed) throw new Error(`unparsed output, status=${response.status}`);
  return { verdict: response.output_parsed, usage: response.usage ?? null, model: response.model, seconds: (Date.now() - started) / 1000 };
}
