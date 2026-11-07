import { AlertIcon, ExhibitLabel, Money, Paper } from "@/components/ui";
import type { Recall } from "@/lib/types";
import { companyName, day, recallReason } from "./model";

/** The recall's hazard from its own title, as the banner says it. Null when the title doesn't name one. */
export const hazardLine = (recall: Pick<Recall, "title">) => {
  const reason = recallReason(recall);
  return reason ? `${reason}. Stop using it now.` : null;
};

function Hazard({ text }: { text: string }) {
  return (
    <p role="note" className="flex gap-3 rounded-card bg-stop-soft px-4 py-3 text-body font-semibold text-text sm:py-4">
      <AlertIcon className="mt-1 shrink-0 text-stop" />
      {text}
    </p>
  );
}

/**
 * What was recalled and why: on a laptop the left column (notice line, product, hazard banner, the CPSC photo on a paper
 * plate, facts); on a phone one 64px row with the refund, then the hazard banner, so the action stays above the fold.
 */
export function RecallBrief({ recall }: { recall: Recall }) {
  const hazard = hazardLine(recall);
  const image = recall.images[0];
  const company = companyName(recall);
  return (
    <section aria-labelledby="recall-title" className="flex flex-col gap-4 sm:gap-6">
      <h1 id="recall-title" className="sr-only">
        {recall.product}
      </h1>
      {/* Phones: one row. */}
      <div className="flex h-16 items-center gap-3 sm:hidden">
        {image && (
          <Paper variant="sheet" padding="none" tilt={-1.5} className="w-24 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={image.caption || `The recalled ${recall.product}`} className="block h-14 w-full rounded-control object-contain mix-blend-multiply" />
          </Paper>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="micro truncate text-faint">CPSC {recall.id}</span>
          <p aria-hidden="true" className="line-clamp-2 text-ui leading-tight font-semibold text-text">
            {recall.product}
          </p>
        </div>
        <Money value={Number(recall.refund.value)} currency={recall.refund.currency} size="inline" className="shrink-0 text-body font-semibold text-text" />
      </div>

      {/* Tablets and laptops. */}
      <ExhibitLabel leader="none" as="p" className="max-sm:hidden">
        CPSC {recall.id} · Recalled {day(recall.recallDate)}
      </ExhibitLabel>
      <p aria-hidden="true" className="max-w-[20ch] text-title font-semibold text-balance max-sm:hidden">
        {recall.product}
      </p>
      {hazard && <Hazard text={hazard} />}

      {image && (
        <figure className="flex flex-col gap-3 pt-2 max-sm:hidden">
          <Paper variant="sheet" padding="sm" tilt={-1.5} className="self-start">
            {/* CPSC's own photo, hot-linked from cpsc.gov so it stays the official one. Multiplied into the paper, so its
                white studio background never reads as a slab brighter than the paper around it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={image.caption || `The recalled ${recall.product}`} className="block h-auto max-h-40 w-auto max-w-full object-contain mix-blend-multiply lg:max-h-80" />
          </Paper>
          <figcaption className="flex flex-col gap-1.5 pl-1">
            <ExhibitLabel leaderLength={24}>Exhibit · recalled product</ExhibitLabel>
            {image.caption && <span className="max-w-read text-ui text-faint">{image.caption}</span>}
          </figcaption>
        </figure>
      )}

      <dl className="grid grid-cols-2 border-t border-line text-ui max-sm:hidden">
        <Fact label="Units recalled" value={recall.units || "Not stated"} />
        <Fact label="Sold by" value={company} />
      </dl>
      <a href={recall.url} className="self-start text-ui text-muted underline decoration-line-strong underline-offset-4 hover:text-text max-sm:hidden" rel="noopener noreferrer" target="_blank">
        Read the recall notice on cpsc.gov
      </a>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line py-3 pr-4">
      <dt className="text-faint">{label}</dt>
      <dd className="text-text tabular-nums">{value}</dd>
    </div>
  );
}
