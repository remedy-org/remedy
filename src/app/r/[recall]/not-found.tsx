import type { Metadata } from "next";
import { NotFoundCard } from "@/components/claim/NotFoundCard";
import { FlowShell } from "@/components/claim/FlowShell";

// Any /r/<slug> that isn’t a recall (and /r/not-found, where /api/claims/start sends one): a 404, which Next marks noindex.
const description = "This recall link doesn’t exist on Remedy.";
export const metadata: Metadata = {
  title: "Recall not found",
  description,
  openGraph: { title: "Recall not found · Remedy", description, siteName: "Remedy", type: "website" },
  twitter: { card: "summary", title: "Recall not found · Remedy", description },
};

export default function NotFound() {
  return (
    <FlowShell>
      <NotFoundCard />
    </FlowShell>
  );
}
