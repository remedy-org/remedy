import type { CpscSummary } from "@/app/console/_lib/recalls";
import { formatCount, formatDate } from "./format";

/** CPSC's own record, as read: what is recalled, how many, and what the notice asks owners to do. */
export function CpscNotice({ notice }: { notice: CpscSummary }) {
  return (
    <article className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
      <div>
        <p className="mb-3 font-display text-micro text-accent-text">Source notice</p>
        <h2 className="font-display text-body font-medium text-balance">{notice.title}</h2>
        <p className="mt-1 text-ui text-muted">
          CPSC <span className="font-mono">{notice.id}</span> · Recalled {formatDate(notice.recallDate)}
        </p>
      </div>
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
        <dd>{notice.unitsSold ? `About ${formatCount(notice.unitsSold)}` : "CPSC gives no count"}</dd>
      </dl>
      {notice.remedy && (
        <div className="flex flex-col gap-1 border-t border-line pt-4">
          <p className="text-ui text-muted">The notice asks owners to</p>
          <blockquote className="mt-2 border-l-2 border-accent-text pl-3 text-ui text-text">{notice.remedy}</blockquote>
        </div>
      )}
      <a href={notice.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center self-start text-ui font-medium text-text underline decoration-line-strong underline-offset-4 hover:decoration-text">
        Read the notice on cpsc.gov
      </a>
    </article>
  );
}
