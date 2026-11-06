import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { recallId, type CpscRecord } from "./cpsc";
import { env } from "./env";
import { CheckSpec } from "./types";

// The rules come from docs/EVAL.md ("Rules for the spec generator"); round 1 of spike 2 showed what breaks
// without them. The fifth rule (codes with no look-alikes) is enforced in codes.ts, not here.
export const SPEC_SYSTEM = `You turn a CPSC recall notice into a check spec: what a refund claimant's photos must show to prove they have the recalled product and have destroyed it as the notice asks. A vision model checks the photos against your spec, and money is paid only if every item is visibly confirmed, so every item must be something a photo can show.
- Ask only for what a photo can show: "in marker", not "in permanent marker". Never ask for weight, smell, permanence, a receipt or anything else a photo can't prove.
- Say where each identifier sits on the label, as the notice's text or diagram does ("the batch code at the bottom right").
- Describe the product's look from the notice's photos, not only its text: shape, colours, prints and distinctive parts.
- Wherever the notice asks for a claim number, say the one-time code is the claim number, e.g. "the one-time code (this claim's number) is written in marker on the product".
- recall: a short name for the recall: brand, product and model.
- product: what the product is and how it looks, in one phrase.
- label_must_show: the identifiers the photos must show, such as model numbers, batch codes or date codes, each with where it sits. If the notice says the product has no markings or labels, leave it empty: the product is then matched on its look.
- proof_steps: the destruction step the notice's remedy asks for, then one step for each label that must be visible. One fact per step, short and literal, in the notice's terms.
- note: anything you changed from the notice's wording, and why. Empty if nothing changed.`;

// recall and source are set from the record, not by the model.
const SpecDraft = z.object({
  recall: z.string(),
  product: z.string(),
  label_must_show: z.array(z.string()),
  proof_steps: z.array(z.string()),
  note: z.string(),
});

export function buildSpecPrompt(r: CpscRecord): string {
  const lines = [
    `Recall ${recallId(r)}: ${r.Title}`,
    `Description: ${r.Description}`,
    ...r.Products.map((p) => `Product: ${[p.Name, p.Model && `model ${p.Model}`, p.Description, p.NumberOfUnits && `${p.NumberOfUnits} units`].filter(Boolean).join("; ")}`),
    ...r.Manufacturers.map((m) => `Manufacturer: ${m.Name}`),
    ...r.Hazards.map((h) => `Hazard: ${h.Name}`),
    ...r.Remedies.map((x) => `Remedy: ${x.Name}`),
    ...r.Images.map((i, n) => `Photo ${n + 1}: ${i.Caption ?? "(no caption)"}`),
  ];
  return lines.join("\n");
}

// A draft for the company to review before the recall goes live, never used unseen.
export async function draftSpec(r: CpscRecord, { client = new OpenAI({ apiKey: env().OPENAI_API_KEY }) }: { client?: OpenAI } = {}): Promise<CheckSpec> {
  const { VISION_MODEL, VISION_EFFORT } = env();
  const response = await client.responses.parse({
    model: VISION_MODEL,
    reasoning: { effort: VISION_EFFORT },
    input: [
      { role: "system", content: SPEC_SYSTEM },
      {
        role: "user",
        content: [
          ...r.Images.map((i) => ({ type: "input_image" as const, image_url: i.URL, detail: "original" as const })),
          { type: "input_text" as const, text: buildSpecPrompt(r) },
        ],
      },
    ],
    text: { format: zodTextFormat(SpecDraft, "check_spec") },
  });
  const draft = response.output_parsed;
  if (!draft) throw new Error(`unparsed output, status=${response.status}`);
  return CheckSpec.parse({
    recall: `${draft.recall} (CPSC ${recallId(r)})`,
    source: r.URL,
    product: draft.product,
    label_must_show: draft.label_must_show,
    proof_steps: draft.proof_steps,
    ...(draft.note ? { note: draft.note } : {}),
  });
}
