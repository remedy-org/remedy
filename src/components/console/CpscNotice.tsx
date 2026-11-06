import type { CpscSummary } from "@/app/console/_lib/recalls";
import { ExhibitLabel } from "@/components/ui";
import { formatCount, formatDate } from "./format";

/** CPSC's own record, as read: what is recalled, how many, and what the notice asks owners to do. */
export function CpscNotice({ notice }: { notice: CpscSummary }) {
  return (
    <article className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
      <ExhibitLabel leader="right" leaderLength={24}>
        CPSC {notice.id} · {formatDate(notice.recallDate)}
      </ExhibitLabel>
      <h2 className="text-body font-semibold text-balance">{notice.title}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-ui">
        <dt className="text-muted">Product</dt>
        <dd>{notice.product || "Not named"}</dd>
        {notice.firm && (
          <>
            <dt className="text-muted">Firm</dt>
            <dd>{notice.firm}</dd>
          </>
        )}
        <dt className="text-muted">Units</dt>
        <dd className="tabular-nums">{notice.unitsSold ? formatCount(notice.unitsSold) : "CPSC gives no count"}</dd>
      </dl>
      {notice.remedy && (
        <div className="flex flex-col gap-1 border-t border-line pt-4">
          <p className="text-ui text-muted">The notice asks owners to</p>
          <blockquote className="border-l border-line-strong pl-3 text-ui text-text">{notice.remedy}</blockquote>
        </div>
      )}
      <a href={notice.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center self-start text-ui font-medium text-text underline underline-offset-4 hover:text-accent-text">
        Read the notice on cpsc.gov
      </a>
    </article>
  );
}
