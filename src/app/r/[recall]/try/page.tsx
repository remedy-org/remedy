import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RecallScreen } from "@/components/claim/RecallScreen";
import { getAppStore, isDemoAllowed } from "@/lib/demo";
import { getSession } from "@/lib/session";
import { getRecallBySlug } from "@/lib/store";

const description = "Send four claims on a real recall. Remedy pays the genuine one through PayPal and stops the three fakes.";
export const metadata: Metadata = {
  title: "Try a claim",
  description,
  openGraph: { title: "Try a claim · Remedy", description, siteName: "Remedy", type: "website" },
  twitter: { card: "summary_large_image", title: "Try a claim · Remedy", description },
};

// /r/<slug>/try: the demo. The same flow and checks, with the demo claims' photos in place of the camera. Logged in
// already, there is nothing to consent to: straight on to the claims, with any limit notice the query carries.
export default async function TryPage({ params, searchParams }: PageProps<"/r/[recall]/try">) {
  const recall = await getRecallBySlug((await params).recall, await getAppStore());
  if (!recall || !isDemoAllowed(recall)) notFound();
  const query = await searchParams;
  if (await getSession("owner")) {
    const keep = new URLSearchParams(Object.entries(query).flatMap(([k, v]) => (typeof v === "string" && k !== "auth_error" ? [[k, v]] : [])));
    redirect(`/r/${recall.slug}/try/samples${keep.size ? `?${keep}` : ""}`);
  }
  return <RecallScreen recall={recall} demo query={query} />;
}
