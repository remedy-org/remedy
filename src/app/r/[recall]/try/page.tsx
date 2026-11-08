import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RecallScreen } from "@/components/claim/RecallScreen";
import { getAppStore, isDemoAllowed } from "@/lib/demo";
import { getRecallBySlug } from "@/lib/store";

const description = "Run four claims on a live recall. Remedy pays the genuine one through PayPal and stops the three fakes.";
export const metadata: Metadata = {
  title: "Try a claim",
  description,
  openGraph: { title: "Try a claim · Remedy", description, siteName: "Remedy", type: "website" },
  twitter: { card: "summary_large_image", title: "Try a claim · Remedy", description },
};

// /r/<slug>/try: the demo. The same flow and checks, with the demo claims' photos in place of the camera.
export default async function TryPage({ params, searchParams }: PageProps<"/r/[recall]/try">) {
  const recall = await getRecallBySlug((await params).recall, await getAppStore());
  if (!recall || !isDemoAllowed(recall)) notFound();
  return <RecallScreen recall={recall} demo query={await searchParams} />;
}
