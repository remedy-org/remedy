import type { Metadata } from "next";
import { ClaimScreen } from "@/components/claim/ClaimScreen";

export async function generateMetadata({ params }: PageProps<"/r/[recall]/claim/[id]">): Promise<Metadata> {
  return { title: `Claim ${(await params).id}` };
}

export default async function ClaimPage({ params }: PageProps<"/r/[recall]/claim/[id]">) {
  const { recall, id } = await params;
  return <ClaimScreen slug={recall} id={id} demo={false} />;
}
