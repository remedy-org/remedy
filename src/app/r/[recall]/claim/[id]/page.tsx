import type { Metadata } from "next";
import { ClaimScreen } from "@/components/claim/ClaimScreen";

export const metadata: Metadata = { title: "Your claim" };

export default async function ClaimPage({ params }: PageProps<"/r/[recall]/claim/[id]">) {
  const { recall, id } = await params;
  return <ClaimScreen slug={recall} id={id} demo={false} />;
}
