import { formatDate } from "@/components/console/format";
import { PartialNotice } from "@/components/console/PartialNotice";
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
  const { store, recalls } = await loadWorkspace(session);
  const recall = pickRecall(recalls, (await searchParams).recall);

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

  const { claims, unreadable } = await loadClaims(store, recall.id);
  const report = buildReport(claims, recall);

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 print:p-0">
      <div className="mx-auto flex w-full max-w-[52rem] flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-h2 font-semibold">CPSC progress report</h1>
          <p className="mt-1 text-ui text-muted">A draft from your claim records, laid out for the monthly report. Check it, then print or save it as a PDF.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {recalls.length > 1 && <RecallPicker recalls={recalls.map((r) => ({ id: r.id, product: r.product }))} current={recall.id} basePath="/console/report" />}
          <PrintButton />
        </div>
      </div>
      <div className="mx-auto w-full max-w-[52rem] print:hidden">
        <PartialNotice what="claims" ids={unreadable} total={claims.length + unreadable.length} />
      </div>
      <ProgressReport recall={recall} report={report} generated={formatDate(new Date().toISOString())} />
    </main>
  );
}
