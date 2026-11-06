import { ExhibitLabel } from "@/components/ui";
import type { Recall } from "@/lib/types";
import { companyName, day, money, recallReason } from "./model";

/** What was recalled and why: the left column of the recall screen on a laptop, a compact header on a phone. */
export function RecallBrief({ recall }: { recall: Recall }) {
  const reason = recallReason(recall);
  const image = recall.images[0];
  return (
    <section aria-labelledby="recall-title" className="flex flex-col gap-6">
      <ExhibitLabel leader="none" as="p">
        CPSC {recall.id} · Recalled {day(recall.recallDate)}
      </ExhibitLabel>
      <div className="flex flex-col gap-3">
        <h1 id="recall-title" className="max-w-[24ch] text-h2 font-semibold text-balance">
          {recall.product}
        </h1>
        {reason && <p className="max-w-read text-body text-muted">{reason}. Stop using it now.</p>}
      </div>

      {image && (
        <figure className="hidden flex-col gap-2 lg:flex">
          <div className="overflow-hidden rounded-card border border-line bg-[oklch(1_0_0)]">
            {/* CPSC's own photo, hot-linked from cpsc.gov so it stays the official one. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={image.caption || `The recalled ${recall.product}`} className="block h-auto max-h-80 w-full object-contain" />
          </div>
          {image.caption && <figcaption className="text-ui text-faint">{image.caption}</figcaption>}
        </figure>
      )}

      <dl className="grid grid-cols-2 border-t border-line text-ui sm:grid-cols-3">
        <Fact label="Refund" value={money(recall.refund)} strong />
        <Fact label="Units recalled" value={recall.units || "Not stated"} />
        <Fact label="Sold by" value={companyName(recall)} className="hidden sm:flex" />
      </dl>
      <a href={recall.url} className="text-ui text-muted underline decoration-line-strong underline-offset-4 hover:text-text" rel="noopener noreferrer" target="_blank">
        Read the recall notice on cpsc.gov
      </a>
    </section>
  );
}

function Fact({ label, value, strong, className }: { label: string; value: string; strong?: boolean; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 border-b border-line py-3 pr-4 ${className ?? ""}`}>
      <dt className="text-faint">{label}</dt>
      <dd className={strong ? "font-mono text-body font-medium text-text tabular-nums" : "text-text tabular-nums"}>{value}</dd>
    </div>
  );
}
