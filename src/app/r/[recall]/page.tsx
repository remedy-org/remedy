import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { money, productNoun } from "@/components/claim/model";
import { RecallScreen } from "@/components/claim/RecallScreen";
import { getAppStore } from "@/lib/demo";
import { getRecallBySlug } from "@/lib/store";
import { SHARE_IMAGE } from "@/lib/shareImage";

export async function generateMetadata({ params }: PageProps<"/r/[recall]">): Promise<Metadata> {
  const recall = await getRecallBySlug((await params).recall, await getAppStore());
  if (!recall) return { title: "Recall not found" };
  const title = `Refund for ${recall.product}`;
  const description = `Get ${money(recall.refund)} back for your recalled ${productNoun(recall)}. Prove it’s destroyed on a live camera and Remedy pays you through PayPal.`;
  return {
    title,
    description,
    openGraph: { title: `${title} · Remedy`, description, siteName: "Remedy", type: "website", images: [SHARE_IMAGE] },
    twitter: { card: "summary_large_image", title: `${title} · Remedy`, description, images: [SHARE_IMAGE] },
  };
}

// /r/<slug>: the owner's way in, from the company's recall notice or a QR code on it.
export default async function RecallPage({ params, searchParams }: PageProps<"/r/[recall]">) {
  const recall = await getRecallBySlug((await params).recall, await getAppStore());
  if (!recall) notFound();
  return <RecallScreen recall={recall} demo={false} query={await searchParams} />;
}
