import { AlertIcon } from "@/components/ui";
import type { Recall } from "@/lib/types";
import { companyName, day, recallReason } from "./model";

/** The recall's hazard from its own title, as the banner says it. Null when the title doesn't name one. */
export const hazardLine = (recall: Pick<Recall, "title">) => {
  const reason = recallReason(recall);
  return reason ? `${reason}. Stop using it now.` : null;
};

function Hazard({ text }: { text: string }) {
  return (
    <p role="note" className="flex gap-3 rounded-card bg-stop-soft px-4 py-3 text-body font-medium text-text sm:py-4">
      <AlertIcon className="mt-1 shrink-0 text-stop" />
      {text}
    </p>
  );
}

/**
 * What was recalled and why: on a laptop the left column (the CPSC number, the product, the hazard, CPSC's photo,
 * facts); on a phone one 64px row and the hazard, so the action stays above the fold. The price is the card's.
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
          <span className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-control bg-paper ring-1 ring-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={image.caption || `The recalled ${recall.product}`} className="block h-14 w-full object-contain mix-blend-multiply" />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-mono text-micro text-faint">CPSC {recall.id}</span>
          <p aria-hidden="true" className="line-clamp-2 text-ui leading-tight font-medium text-text">
            {recall.product}
          </p>
        </div>
      </div>

      {/* Tablets and laptops. */}
      <div className="flex flex-col gap-3 max-sm:hidden">
        <p className="font-mono text-micro text-faint">
          CPSC {recall.id} · Recalled {day(recall.recallDate)}
        </p>
        <p aria-hidden="true" className="max-w-[20ch] text-title font-semibold text-balance text-text">
          {recall.product}
        </p>
      </div>
      {hazard && <Hazard text={hazard} />}

      {image && (
        <figure className="flex flex-col gap-2 max-sm:hidden">
          {/* CPSC's own photo, hot-linked from cpsc.gov so it stays the official one. Multiplied into the plate, so its
              white studio background never reads as a slab brighter than the plate around it. */}
          <div className="self-start rounded-control bg-paper p-4 ring-1 ring-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={image.caption || `The recalled ${recall.product}`} className="block h-auto max-h-40 w-auto max-w-full object-contain mix-blend-multiply lg:max-h-72" />
          </div>
          {image.caption && <figcaption className="max-w-read text-ui text-faint">{image.caption}</figcaption>}
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
      <dd className="text-text">{value}</dd>
    </div>
  );
}
