import cpsc27071 from "../__fixtures__/cpsc-27071.json";
import { CpscRecord, toRecall } from "../cpsc";
import type { CheckSpec, Recall } from "../types";

// The demo recall every workspace starts with: CPSC 27-071, Kikea Store's X-VESOLJE nursing pillows.
export const DEMO_RECALL_ID = "27-071";
export const DEMO_SLUG = "kikea-x-vesolje";

// eval/specs/kikea-pillow.json under the spec rules (docs/EVAL.md), widened to the demo stand-in. CPSC says the pillow has
// no label, and the real pillow isn't available, so the demo claims (and the one real capture) use a stand-in pillow
// carrying a hand-written X-VESOLJE tag. Label and steps are the stand-in spec's wording, which the eval ran on.
export const DEMO_SPEC: CheckSpec = {
  recall: "Kikea Store X-VESOLJE nursing pillows, model NP001 (CPSC 27-071)",
  source: "https://www.cpsc.gov/Recalls/2027/Kikea-Store-Recalls-X-VESOLJE-Nursing-Pillows-Due-to-Risk-of-Serious-Injury-or-Death-from-Suffocation-Violate-Mandatory-Standards-for-Nursing-Pillows",
  product:
    "C-shaped nursing pillow, sold in three prints: white with blue flowers and green leaves, dark brown with multicoloured feathers, or multicoloured puzzle pieces. In this demo recall a plain C-shaped stand-in pillow of any colour counts when it carries the X-VESOLJE tag",
  label_must_show: ["X-VESOLJE, hand-written on a paper tag tied to the pillow (this demo stand-in's label)"],
  proof_steps: ["The pillow is cut fully in half, so it can no longer be used", "The X-VESOLJE tag is on the cut pillow"],
  note: "CPSC says the pillow has no markings or labels, and the real pillow isn't available, so this demo recall accepts a stand-in pillow with a hand-written X-VESOLJE tag; say so on screen. The prints are described from the CPSC photo. The notice asks for no claim number, so the one-time code is checked on its own.",
};

export function demoRecall(now = new Date()): Recall {
  return toRecall(CpscRecord.parse(cpsc27071), {
    refund: { value: "29.99", currency: "USD" },
    spec: DEMO_SPEC,
    slug: DEMO_SLUG,
    owner: null,
    autoPay: true,
    now,
  });
}
