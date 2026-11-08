import type { Metadata } from "next";
import { ClaimScreen } from "@/components/claim/ClaimScreen";

export async function generateMetadata({ params }: PageProps<"/r/[recall]/try/[id]">): Promise<Metadata> {
  return { title: `Claim ${(await params).id}` };
}

export default async function DemoClaimPage({ params }: PageProps<"/r/[recall]/try/[id]">) {
  const { recall, id } = await params;
  return <ClaimScreen slug={recall} id={id} demo />;
}
