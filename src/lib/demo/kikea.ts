import cpsc27071 from "../__fixtures__/cpsc-27071.json";
import { CpscRecord, toRecall } from "../cpsc";
import type { CheckSpec, Recall } from "../types";

// The demo recall every workspace starts with: CPSC 27-071, Kikea Store's X-VESOLJE nursing pillows.
export const DEMO_RECALL_ID = "27-071";
export const DEMO_SLUG = "kikea-x-vesolje";

// Word for word eval/specs/kikea-tagged.json, the spec the demo claims' photos were checked against. CPSC says the pillow
// carries no label or markings, so the owner ties on a paper tag hand-written with X-VESOLJE and their one-time code; the
// pillow itself is matched on its print, and only the three recalled prints count.
export const DEMO_SPEC: CheckSpec = {
  recall: "Kikea Store X-VESOLJE nursing pillows, model NP001 (CPSC 27-071)",
  source:
    "https://www.cpsc.gov/Recalls/2027/Kikea-Store-Recalls-X-VESOLJE-Nursing-Pillows-Due-to-Risk-of-Serious-Injury-or-Death-from-Suffocation-Violate-Mandatory-Standards-for-Nursing-Pillows",
  product:
    "C-shaped nursing pillow in one of the three recalled prints: white with blue flowers and green leaves, dark brown with multicoloured feathers, or multicoloured puzzle pieces. A pillow in any other print or a plain colour is not this product. The pillow carries no label or markings of its own, so the owner ties on a paper tag hand-written with X-VESOLJE and their one-time code",
  label_must_show: ["X-VESOLJE, hand-written on a paper tag tied to the pillow (the pillow itself carries no label)"],
  proof_steps: ["The pillow is cut fully in half, so it can no longer be used", "The X-VESOLJE tag is on the cut pillow"],
  note: "CPSC says the pillow carries no markings or labels, so the owner ties on a paper tag reading X-VESOLJE and the claim's one-time code. The prints are described from the CPSC photo. The notice asks for no claim number, so the one-time code is checked on its own.",
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
