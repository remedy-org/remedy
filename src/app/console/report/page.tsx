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
    // The sheet and a narrow rail beside it, on the page's left gutter as every console page is: the rail carries the
    // print action (and the recall picker), aligned to the sheet's top edge. The sheet itself names the recall and date.
    <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8 print:p-0">
      <div className="grid w-full max-w-[52rem] gap-6 lg:max-w-[70rem] lg:grid-cols-[minmax(0,52rem)_minmax(0,1fr)] lg:gap-12 print:block print:max-w-none">
        <div className="lg:col-span-2 print:hidden">
          <h1 className="text-h2 font-medium">CPSC progress report</h1>
          <p className="mt-1 text-ui text-muted">A draft from your claim records, laid out for the monthly report.</p>
        </div>
        <ProgressReport recall={recall} report={report} generated={`${formatDayET(new Date().toISOString())} (ET)`} />
        <aside className="flex flex-col gap-5 text-ui lg:sticky lg:top-6 lg:self-start print:hidden">
          <PrintButton />
          {recalls.length > 1 && <RecallPicker recalls={recalls.map((r) => ({ id: r.id, product: r.product }))} current={recall.id} basePath="/console/report" />}
        </aside>
      </div>
    </main>
  );
}
