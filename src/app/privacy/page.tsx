import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Remedy reads, stores and shares when you file or run a recall claim.",
};

// Each line matches a real data flow: the PayPal login (api/auth/paypal), the photo check (lib/vision/check, OpenAI),
// the console's evidence panel, Vercel Blob storage, and the cookies set by the auth routes, proxy.ts and api/claims/round.
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      updated="8 Nov 2026"
      sections={[
        {
          title: "What Remedy reads from PayPal",
          body: "When you log in with PayPal, Remedy reads your name, email, PayPal account ID and whether PayPal has verified the account. Remedy never sees your PayPal password, balance or cards.",
        },
        {
          title: "Your photos",
          body: "You take your photos in the claim page's own camera. Remedy sends them to OpenAI's vision model to describe what they show, and a fixed rule decides your claim. Beyond that, only the company running the recall sees them.",
        },
        {
          title: "What the company sees",
          body: "The company running the recall sees your claim, your photos, the result of every check and the last four characters of your PayPal account ID.",
        },
        { title: "Where it is stored", body: "Claims and photos are stored with Vercel, which hosts Remedy." },
        {
          title: "Cookies",
          body: "Remedy sets cookies only to keep you logged in, to secure the PayPal login and to keep your place in a demo. Your theme choice is saved in your browser.",
        },
        { title: "Payouts", body: "Refunds are sent through PayPal Payouts. PayPal's own privacy statement covers your PayPal account." },
      ]}
    />
  );
}
