import type { Recall } from "@/lib/types";
import { companyName, day, recallReason } from "./model";

/** The recall's hazard from its own title, as the banner says it. Null when the title doesn't name one. */
export const hazardLine = (recall: Pick<Recall, "title">) => {
  const reason = recallReason(recall);
  return reason ? `${reason}. Stop using it now.` : null;
};

function Hazard({ text }: { text: string }) {
  return (
    // One sentence on a red rule: serious, and no louder than the page around it.
    <p role="note" className="border-l-2 border-stop pl-4 text-body font-medium text-pretty text-text">
      {text}
    </p>
  );
}

/**
 * What was recalled and why: on a laptop the left column (the product, the CPSC line, the hazard, CPSC's photo, facts);
 * on a phone the CPSC line beside a small CPSC photo, and the hazard, so the owner can say "that's ours" while the offer
 * and its action stay above the fold. The price is the card's. `heading`: the brief's product name is the page's h1
 * (read out only; the offer is the headline seen), or an h2 beside a step that has its own h1.
 */
export function RecallBrief({ recall, heading = "h1" }: { recall: Recall; heading?: "h1" | "h2" }) {
  const hazard = hazardLine(recall);
  const image = recall.images[0];
  const company = companyName(recall);
  const Heading = heading;
  // Muted sans; mono only for the recall number, the one piece of data in it.
  const source = (
    <>
      CPSC <span className="font-mono">{recall.id}</span> · Recalled {day(recall.recallDate)} ·{" "}
      <a href={recall.url} className="whitespace-nowrap text-text underline decoration-line-strong underline-offset-4 hover:decoration-text" rel="noopener noreferrer" target="_blank">
        cpsc.gov<span className="sr-only"> recall notice (opens in a new tab)</span>
      </a>
    </>
  );
  return (
    <section aria-labelledby="recall-title" className="flex flex-col gap-4 sm:gap-6">
      <Heading id="recall-title" className="sr-only">
        {recall.product}
      </Heading>
      {/* Phones: CPSC's photo on its paper plate, small, beside the line that proves it's a real recall. */}
      <div className="flex items-center gap-3 sm:hidden">
        {image && (
          <span className="shrink-0 rounded-control bg-paper p-1 ring-1 ring-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="" className="block size-12 object-contain mix-blend-multiply" />
          </span>
        )}
        <p className="text-ui text-muted">{source}</p>
      </div>

      {/* Tablets and laptops: the product one step under the offer's size, so the offer is the one headline. */}
      <div className="flex flex-col gap-2 max-sm:hidden">
        <p aria-hidden="true" className="max-w-[24ch] text-head-sm font-medium text-balance text-text">
          {recall.product}
        </p>
        <p className="text-ui text-muted">{source}</p>
      </div>
      {hazard && <Hazard text={hazard} />}

      {image && (
        <figure className="flex flex-col gap-2 max-sm:hidden">
          {/* CPSC's own photo, hot-linked from cpsc.gov so it stays the official one. Multiplied into the plate, so its
              white studio background never reads as a slab brighter than the plate around it. The caption is its text. */}
          <div className="rounded-control bg-paper p-4 ring-1 ring-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={image.caption ? "" : `The recalled ${recall.product}`} className="mx-auto block h-auto max-h-40 w-auto max-w-full object-contain mix-blend-multiply lg:max-h-72" />
          </div>
          {image.caption && <figcaption className="max-w-read text-ui text-faint">{image.caption}</figcaption>}
        </figure>
      )}

      <dl className="grid grid-cols-2 border-t border-line text-ui max-sm:hidden">
        <Fact label="Units recalled" value={recall.units || "Not stated"} />
        <Fact label="Sold by" value={company} />
      </dl>
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
