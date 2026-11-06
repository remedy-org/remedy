import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RecallScreen } from "@/components/claim/RecallScreen";
import { getAppStore } from "@/lib/demo";
import { getRecallBySlug } from "@/lib/store";

export async function generateMetadata({ params }: PageProps<"/r/[recall]">): Promise<Metadata> {
  const recall = await getRecallBySlug((await params).recall, await getAppStore());
  return { title: recall ? `Refund for ${recall.product}` : "Recall not found" };
}

// /r/<slug>: the owner's way in, from the company's recall notice or a QR code on it.
export default async function RecallPage({ params, searchParams }: PageProps<"/r/[recall]">) {
  const recall = await getRecallBySlug((await params).recall, await getAppStore());
  if (!recall) notFound();
  return <RecallScreen recall={recall} demo={false} query={await searchParams} />;
}
