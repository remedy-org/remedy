import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RecallScreen } from "@/components/claim/RecallScreen";
import { getAppStore, isDemoAllowed } from "@/lib/demo";
import { getRecallBySlug } from "@/lib/store";

export const metadata: Metadata = { title: "Run a claim" };

// /r/<slug>/try: the judges' demo. The same flow and checks, with sample photos in place of the camera.
export default async function TryPage({ params, searchParams }: PageProps<"/r/[recall]/try">) {
  const recall = await getRecallBySlug((await params).recall, await getAppStore());
  if (!recall || !isDemoAllowed(recall)) notFound();
  return <RecallScreen recall={recall} demo query={await searchParams} />;
}
