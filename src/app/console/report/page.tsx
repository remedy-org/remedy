import { formatDayET } from "@/components/console/format";
import { PrintButton } from "@/components/console/PrintButton";
import { ProgressReport } from "@/components/console/ProgressReport";
import { RecallPicker } from "@/components/console/RecallPicker";
import { Button, EmptyState } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { buildReport } from "../_lib/report";
import { loadClaims, loadWorkspace, pickRecall } from "../_lib/workspace";

export const metadata = { title: "CPSC report" };

export default async function ReportPage({ searchParams }: PageProps<"/console/report">) {
  const session = await requireSession("company", "/console/report");
  const wanted = (await searchParams).recall;
  const { store, recalls } = await loadWorkspace(session, wanted);
  const recall = pickRecall(recalls, wanted);

  if (!recall) {
    return (
      <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
        <EmptyState
          className="my-auto"
          title="No recall to report on"
          description="The progress report is drafted from a recall's claims. Import a recall first."
          action={<Button href="/console/recalls/new">Import a recall</Button>}
        />
      </main>
    );
  }

  const claims = await loadClaims(store, recall, session);
  const report = buildReport(claims, recall);

  return (
    // On the page's left gutter as every console page is: the title and its actions on one row, as the claims page
    // has them (print, and the recall picker), then the sheet at its reading width. The sheet names the recall and date.
    <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8 print:p-0">
      <div className="flex w-full max-w-[52rem] flex-col gap-8 print:block print:max-w-none">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 print:hidden">
          <div className="min-w-0">
            <h1 className="text-h2 font-medium">CPSC progress report</h1>
            <p className="mt-1 text-ui text-muted">Drafted from your claim records, laid out for the monthly report.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {recalls.length > 1 && <RecallPicker recalls={recalls.map((r) => ({ id: r.id, product: r.product }))} current={recall.id} basePath="/console/report" />}
            <PrintButton />
          </div>
        </div>
        <ProgressReport recall={recall} report={report} generated={`${formatDayET(new Date().toISOString())} (ET)`} />
      </div>
    </main>
  );
}
