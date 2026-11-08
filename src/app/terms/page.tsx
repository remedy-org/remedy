import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms for filing a recall claim and running a recall on Remedy.",
};

// "Payouts" holds the site's one mention of PayPal's sandbox (DESIGN.md, Voice and emphasis).
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      updated="8 Nov 2026"
      sections={[
        {
          title: "What Remedy does",
          body: "Remedy runs refund claims for product recalls. When an owner's photo passes every check, Remedy pays the refund through PayPal Payouts.",
        },
        {
          title: "Claims",
          body: "One claim per verified PayPal account, per recall. A fixed rule decides each claim: a failed check rejects it, an unclear answer holds it for a person at the company, and the company can approve or reject a held claim. Remedy limits how many claims each account can make in a day.",
        },
        {
          title: "Payouts",
          body: "During the pilot, payouts on remedy-recalls.vercel.app run in PayPal's sandbox, so no real money moves.",
        },
        {
          title: "PayPal",
          body: "Remedy uses Log in with PayPal and PayPal Payouts. PayPal's own terms apply to your PayPal account. PayPal is a trademark of PayPal, Inc.",
        },
      ]}
    />
  );
}
