import { formatDay, recallDays, reportNumber } from "@/components/console/format";
import { PrintButton } from "@/components/console/PrintButton";
import { ProgressReport } from "@/components/console/ProgressReport";
import { RecallPicker } from "@/components/console/RecallPicker";
import { WorkspaceNote, onSharedRecall } from "@/components/console/WorkspaceNote";
import { Button, EmptyState } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { buildReport } from "../_lib/report";
import { loadClaims, loadWorkspace, pickRecall, viewerOf } from "../_lib/workspace";

export const metadata = { title: "CPSC report" };

export default async function ReportPage({ searchParams }: PageProps<"/console/report">) {
  const session = await viewerOf(await requireSession("company", "/console/report"));
  const wanted = (await searchParams).recall;
  const { store, recalls } = await loadWorkspace(session, wanted);
  const recall = pickRecall(recalls, wanted);

  if (!recall) {
    return (
      <main className="page flex flex-1 flex-col py-8">
        <EmptyState
          className="my-auto"
          title="No recall to report on"
          description="The progress report is drafted from a recall’s claims. Import a recall first."
          action={<Button href="/console/recalls/new">Import a recall</Button>}
        />
      </main>
    );
  }

  const claims = await loadClaims(store, recall, session);
  const report = buildReport(claims, recall);
  const now = new Date();
  const shared = onSharedRecall({ recall, recalls, company: session.name });
  // The filed copy's foot on every printed page: who files it (the company, on its own recall only), which recall, and
  // the page of how many.
  const filer = recall.owner !== null && session.name ? `${session.name} · ` : "";
  const css = (t: string) => JSON.stringify(t).replace(/</g, "\\3c ");
  // Printed, the sheet is white paper edge to edge: the page's own tint never shows around or under it, background
  // graphics on or off (the ruler keeps its colours, print-color-adjust in ProgressReport).
  const page = `@media print{html,body{background:#fff!important}}@page{margin:16mm 16mm 18mm;@bottom-left{content:${css(`${filer}CPSC ${recall.id} progress report`)};font:10px/1.4 system-ui,sans-serif;color:#555}@bottom-right{content:"Page " counter(page) " of " counter(pages);font:10px/1.4 system-ui,sans-serif;color:#555}}`;

  return (
    // The title and its actions on one row, as the claims page has them (print, and the recall picker), then the sheet
    // at its reading width, centred on the page as a document is. The sheet names the recall and date.
    <main className="page flex flex-1 flex-col py-8 print:p-0">
      <style>{page}</style>
      <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-8 print:block print:max-w-none">
        <div className="flex flex-col gap-3 print:hidden">
          {/* What the shared recall is, as on Claims and Insights; the sheet says it too, in print. */}
          <WorkspaceNote recall={recall} recalls={recalls} company={session.name} />
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div className="min-w-0">
              <h1 className="text-h2 font-medium">CPSC progress report</h1>
              <p className="mt-1 text-ui text-muted">Drafted from this recall&rsquo;s claim records, with the figures the monthly progress report asks for.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {recalls.length > 1 && <RecallPicker recalls={recalls.map((r) => ({ id: r.id, product: r.product }))} current={recall.id} basePath="/console/report" />}
              <PrintButton />
            </div>
          </div>
        </div>
        <ProgressReport
          recall={recall}
          report={report}
          generated={formatDay(now.toISOString())}
          daysIn={recallDays(recall.recallDate, now)}
          reportNo={reportNumber(recall.recallDate, now)}
          shared={shared}
        />
      </div>
    </main>
  );
}
