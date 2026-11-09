import type { Recall } from "@/lib/types";
import { companyName, cutInHalf, money, productNoun, taggedThing } from "./model";

// The consent screen's words, in one place: the claim page (ConsentCard), /signin and the homepage's copy of the screen
// (How it works, chapter 01) all read them from here, so the picture can never drift from the page. No server imports:
// the homepage's chapter is a client component.

/**
 * What Remedy reads from a PayPal login, said once under every Log in with PayPal (the claim page, /signin, How it
 * works). True to lib/paypal/identity.ts: the userinfo call returns the payer ID, the verified flag, the name and the
 * email, and the scopes ask for nothing else.
 */
export const PAYPAL_CONSENT = "Remedy sees your PayPal name, email, account ID and whether it’s verified, never your password, balance or cards.";

/** "cut pillow" -> "pillow": the thing the owner photographs, in one word. */
const thingOf = (recall: Recall) => (taggedThing(recall.spec)?.split(" ").pop() ?? productNoun(recall).split(" ").pop() ?? "product").toLowerCase();

/**
 * The real owner's consent screen in four lines: the offer (the page's headline), what Remedy is in one neutral line under
 * it, how in one line, and the code's clock over the button. `minutes`: the camera session's length (lib/ids.ts CAPTURE_SESSION_MINUTES, passed in so this file
 * stays free of node:crypto).
 */
export function consentLines(recall: Recall, minutes: number) {
  const company = companyName(recall);
  const thing = thingOf(recall);
  const cut = cutInHalf(recall.spec);
  return {
    title: `${money(recall.refund)} back for your ${productNoun(recall)}`,
    // What Remedy is, for an owner who has never heard of it: the product in one line, naming no company (DESIGN.md:95).
    about: "Remedy pays recall refunds through PayPal, straight to the account you log in with.",
    // How fast, in the one wording the site uses for it (the footer, the metadata): an auto-paid claim is sent the moment
    // its checks pass and PayPal confirms it within the minute (RM-0442: sent at 15 s, confirmed at 55 s).
    how: `${cut ? `Cut the ${thing} in half` : `Destroy the ${thing} as the notice says`}, photograph it with the code we give you, and your refund lands in your PayPal ${recall.autoPay ? "within a minute" : `once ${company} approves it`}.`,
    // What the tap commits to: the code's clock starts on the next screen, so the cutting and the marker come first.
    clock: `Your code is good for ${minutes} minutes, so ${cut ? `cut the ${thing}` : `destroy the ${thing}`} and have paper and a marker ready first.`,
  };
}
