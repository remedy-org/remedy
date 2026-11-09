import type { Metadata } from "next";
import { NotFoundCard } from "@/components/claim/NotFoundCard";
import { FlowShell } from "@/components/claim/FlowShell";

// Any /r/<slug> that isn’t a recall (and /r/not-found, where /api/claims/start sends one): a 404, which Next marks noindex.
export const metadata: Metadata = { title: "Recall not found", description: "This recall link doesn’t exist on Remedy." };

export default function NotFound() {
  return (
    <FlowShell>
      <NotFoundCard />
    </FlowShell>
  );
}
