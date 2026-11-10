import type { Metadata } from "next";
import { Checks } from "@/components/home/Checks";
import { Companies } from "@/components/home/Companies";
import { Footer } from "@/components/home/Footer";
import { Hero } from "@/components/home/Hero";
import { Nav } from "@/components/home/Nav";
import { Problem } from "@/components/home/Problem";
import { Proof } from "@/components/home/Proof";
import { SHARE_IMAGE } from "@/lib/shareImage";

const description =
  "Remedy connects recall evidence and PayPal payouts. Owners submit photos with a one-time code; five checks and a fixed rule route each claim to payment, review or rejection.";
const share = "Remedy · Recall refunds, paid in a minute";

export const metadata: Metadata = {
  title: { absolute: share },
  openGraph: { title: share, description, siteName: "Remedy", type: "website", images: [SHARE_IMAGE] },
  twitter: { card: "summary_large_image", title: share, description, images: [SHARE_IMAGE] },
};

// Drawn ahead of time and again every hour: the For companies tour, its Insights and its report draft read the console's
// dataset, whose claims move to the visit's day (lib/demo/dataset.ts), so their dates stay the console's.
export const revalidate = 3600;

// The production site, so search engines and agents get one canonical identity whichever host serves the page.
const SITE = "https://remedy-recalls.vercel.app";
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}/#organization`,
      name: "Remedy",
      url: SITE,
      logo: `${SITE}/apple-icon.png`,
      description: "Remedy connects product-recall evidence checks and refunds through PayPal.",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE}/#software`,
      name: "Remedy",
      url: SITE,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      publisher: { "@id": `${SITE}/#organization` },
      description:
        "Owners submit recall evidence with a one-time code. Five checks and a fixed rule route claims to payment, human review or rejection. PayPal confirms payout status. Companies get a claims console, recall analytics and a CPSC progress report draft.",
      featureList: [
        "Live-camera proof of destruction with a one-time code",
        "Five fraud checks, the first three before any AI",
        "Payouts through PayPal Payouts",
        "Claims console on AG Grid",
        "Recall analytics on AG Studio",
        "CPSC progress report draft",
        "Import a recall from its CPSC notice",
      ],
    },
  ],
};

// Nav, the hero with How it works (Hero renders the #how marker), then Problem, Fraud checks, Results, For companies.
export default function Home() {
  return (
    <>
      <Nav />
      {/* clip, not hidden: the light table runs past the edges without a horizontal scrollbar or breaking sticky. */}
      <main id="main" tabIndex={-1} className="overflow-x-clip outline-none">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }} />
        <Hero />
        <Problem />
        <Checks />
        <Proof />
        <Companies />
      </main>
      <Footer />
    </>
  );
}
