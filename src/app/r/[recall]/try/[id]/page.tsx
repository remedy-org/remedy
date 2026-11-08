import type { Metadata } from "next";
import { ClaimScreen } from "@/components/claim/ClaimScreen";

export const metadata: Metadata = { title: "Your claim" };

export default async function DemoClaimPage({ params }: PageProps<"/r/[recall]/try/[id]">) {
  const { recall, id } = await params;
  return <ClaimScreen slug={recall} id={id} demo />;
}
