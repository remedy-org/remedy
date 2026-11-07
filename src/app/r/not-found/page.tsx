import type { Metadata } from "next";
import { FlowShell } from "@/components/claim/FlowShell";
import { NotFoundCard } from "@/components/claim/NotFoundCard";

export const metadata: Metadata = { title: "Recall not found" };

// Where /api/claims/start sends an unknown recall. Static, so it never matches /r/[recall] and reads no recall.
export default function RecallNotFound() {
  return (
    <FlowShell>
      <NotFoundCard />
    </FlowShell>
  );
}
