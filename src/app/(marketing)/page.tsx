import type { Metadata } from "next";
import { Checks } from "@/components/home/Checks";
import { Companies } from "@/components/home/Companies";
import { Footer } from "@/components/home/Footer";
import { Hero } from "@/components/home/Hero";
import { Nav } from "@/components/home/Nav";
import { Problem } from "@/components/home/Problem";
import { Proof } from "@/components/home/Proof";

const description =
  "Remedy turns any CPSC recall into a live refund program. Owners prove the product destroyed on a live camera, five checks stop the fakes, and PayPal pays the refund within a minute.";
const share = "Remedy · Recall refunds, paid in a minute";

export const metadata: Metadata = {
  title: { absolute: share },
  openGraph: { title: share, description, siteName: "Remedy", type: "website" },
  twitter: { card: "summary_large_image", title: share, description },
};

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
      description: "Remedy pays product-recall refunds through PayPal once a live-camera photo proves the product destroyed.",
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
        "Remedy turns any CPSC recall into a live refund program. Owners prove the product destroyed on a live camera with a one-time code, five fraud checks and a fixed rule decide, and PayPal Payouts sends the refund within a minute. Companies get a claims console, recall analytics and a CPSC progress report.",
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

// Nav, the hero with How it works (Hero renders <section id="how">), then Problem, Fraud checks, Results, For companies.
export default function Home() {
  return (
    <>
      <Nav />
      {/* clip, not hidden: the light table runs past the edges without a horizontal scrollbar or breaking sticky. */}
      <main id="main" tabIndex={-1} className="scroll-mt-16 overflow-x-clip outline-none">
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
