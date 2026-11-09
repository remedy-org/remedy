import type { Metadata } from "next";
import { FlowShell } from "@/components/claim/FlowShell";
import { NotFoundCard } from "@/components/claim/NotFoundCard";

const description = "This Remedy page doesn’t exist.";
export const metadata: Metadata = {
  title: "Not found",
  description,
  openGraph: { title: "Not found · Remedy", description, siteName: "Remedy", type: "website" },
  twitter: { card: "summary", title: "Not found · Remedy", description },
};

/** Any URL nothing else matches: the claim flow's frame and card, in the site's palette and type. */
export default function NotFound() {
  return (
    <FlowShell>
      <NotFoundCard title="We can’t find this page" description="The link may be mistyped, or the page has moved. The link or QR code on a recall notice opens its claim." />
    </FlowShell>
  );
}
