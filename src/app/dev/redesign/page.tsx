import { notFound } from "next/navigation";
import { ClaimsGridPreview } from "@/components/console/ClaimsGridPreview";
import { ConsoleHeader } from "@/components/console/ConsoleHeader";
import { previewProps, reportPreview } from "@/components/console/preview";
import { ProgressReport } from "@/components/console/ProgressReport";
import { InsightsLoader } from "@/components/insights/InsightsLoader";
import { insightsPreviewForStudio } from "@/components/insights/preview";

export const metadata = { title: "Design review fixtures", robots: { index: false } };

// In-memory presentation review. No store, session, recovery, model or PayPal calls.
export default async function DesignReview({ searchParams }: PageProps<"/dev/redesign">) {
  if (process.env.NODE_ENV === "production") notFound();
  const view = (await searchParams).view;
  const props = previewProps(500);
  return <>
    <ConsoleHeader session={null} />
    <main id="main" tabIndex={-1} className={view === "insights" ? "py-10 outline-none" : "page py-10 outline-none"}>
      <p className={`${view === "insights" ? "page " : ""}mb-3 text-ui text-accent-text`}>Design review · in-memory fixtures</p>
      <h1 className={`${view === "insights" ? "page " : ""}mb-8 text-h2 font-medium`}>{view === "insights" ? "Recall insights" : view === "report" ? "Progress report" : "Claims and evidence"}</h1>
      {view === "insights" ? <InsightsLoader data={insightsPreviewForStudio()} /> : view === "report" ? <div className="flex justify-center"><ProgressReport {...reportPreview()} /></div> : <ClaimsGridPreview {...props} />}
    </main>
  </>;
}
