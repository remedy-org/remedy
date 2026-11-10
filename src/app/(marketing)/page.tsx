import type { Metadata } from "next";
import { Companies } from "@/components/home/Companies";
import { Footer } from "@/components/home/Footer";
import { Hero } from "@/components/home/Hero";
import { Nav } from "@/components/home/Nav";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Proof } from "@/components/home/Proof";
import { SHARE_IMAGE } from "@/lib/shareImage";

const description =
  "Remedy connects recall-photo evidence, clear decisions, and eligible refunds through PayPal. Owners submit photos; companies review uncertain claims and track every payment.";
const share = "Remedy · Recall refunds, without the inbox";

export const metadata: Metadata = {
  title: { absolute: share },
  openGraph: { title: share, description, siteName: "Remedy", type: "website", images: [SHARE_IMAGE] },
  twitter: { card: "summary_large_image", title: share, description, images: [SHARE_IMAGE] },
};

// The read-only previews share the console's sample dataset and date model.
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
      description: "Remedy connects product-recall evidence reviews and eligible refunds through PayPal.",
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
        "Remedy brings recall-photo evidence, deterministic claim decisions, human review, and PayPal Payouts into one workflow. Companies get a claims console, recall analytics, and a CPSC progress-report draft. The public demonstration uses PayPal sandbox payments and prepared photographs.",
      featureList: [
        "Capture-session photo evidence with a one-time code",
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

// A product-led story with ordinary document scrolling and read-only sample previews.
export default function Home() {
  return (
    <>
      <Nav />
      {/* Keep wide product previews inside the page while preserving normal document scrolling. */}
      <main id="main" tabIndex={-1} className="overflow-x-clip outline-none">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }} />
        <Hero />
        <HowItWorks />
        <Companies />
        <Proof />
      </main>
      <Footer />
    </>
  );
}
