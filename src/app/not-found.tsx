import type { Metadata } from "next";
import { FlowShell } from "@/components/claim/FlowShell";
import { NotFoundCard } from "@/components/claim/NotFoundCard";

export const metadata: Metadata = { title: "Not found" };

/** Any URL nothing else matches: the claim flow's frame and card, in the site's palette and type. */
export default function NotFound() {
  return (
    <FlowShell bare>
      <div className="mx-auto w-full max-w-claim pt-8 sm:pt-16">
        <NotFoundCard description="This link may be mistyped, or the page has moved. A recall's claim link is on the company's recall notice." />
      </div>
    </FlowShell>
  );
}
