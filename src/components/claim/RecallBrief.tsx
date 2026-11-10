import { preload } from "react-dom";
import type { Recall } from "@/lib/types";
import { companyName, day, recallReason } from "./model";
import { RecallPhoto } from "./RecallPhoto";

/** The recall's hazard from its own title, as the banner says it. Null when the title doesn't name one. */
export const hazardLine = (recall: Pick<Recall, "title">) => {
  const reason = recallReason(recall);
  return reason ? `${reason}. Stop using it now.` : null;
};

function Hazard({ text }: { text: string }) {
  return (
    // One sentence on a red rule: serious, and no louder than the page around it.
    <p role="note" className="rounded-control border border-stop/35 bg-stop-soft px-4 py-3 text-ui font-medium text-pretty text-text">
      {text}
    </p>
  );
}

/**
 * What was recalled and why: on a laptop the left column (the product, the CPSC line, the hazard, CPSC's photo, facts);
 * below 1024px (a phone, or a laptop at 200%) the compact brief: the CPSC line and who pays, CPSC's photo across the
 * column (a tap opens it whole), and the hazard, so the owner can say "that's ours" while the offer and its action stay
 * near the top. The price is the card's. `heading`: the brief's product name, an h2 under the offer's h1 (read out only:
 * on screen the product is the brief's small header).
 */
export function RecallBrief({ recall, heading = "h2" }: { recall: Recall; heading?: "h1" | "h2" }) {
  const hazard = hazardLine(recall);
  const image = recall.images[0];
  const company = companyName(recall);
  const Heading = heading;
  // cpsc.gov's photo starts loading with the page, so its plate is never an empty box after a client-side navigation.
  if (image) preload(image.url, { as: "image", fetchPriority: "high" });
  // Muted sans; mono only for the recall number, the one piece of data in it. On a phone the link has a line of its
  // own, with no separator, so no line ever starts with a dot.
  const source = (
    <>
      CPSC <span className="font-mono">{recall.id}</span> · Recalled {day(recall.recallDate)}
      {/* Room either side of the dot, so cpsc.gov's focus ring never touches it. */}
      <span aria-hidden="true" className="mx-2 max-sm:hidden">
        ·
      </span>
      <span className="max-sm:mt-0.5 max-sm:block">
        {/* A 44px target on the text's own box: the hit area is the ::after, so the focus ring hugs the word. */}
        <a href={recall.url} className="text-link text-text underline decoration-line-strong underline-offset-4 hover:decoration-text" rel="noopener noreferrer" target="_blank">
          cpsc.gov<span className="sr-only"> recall notice (opens in a new tab)</span>
        </a>
      </span>
    </>
  );
  return (
    <section aria-labelledby="recall-title" className="flex flex-col gap-4 lg:gap-6">
      <Heading id="recall-title" className="sr-only">
        {recall.product}
      </Heading>
      {/* Below 1024px: the product, then the line that proves it's a real recall, and who is recalling it and paying (from an email link, an
          unknown name and a payment login otherwise read as a phishing page), then CPSC's photo across the column, big
          enough to tell the three pillows apart, with "Enlarge" on it: a tap opens it whole. */}
      <div className="flex flex-col gap-3 lg:hidden">
        <div className="flex min-w-0 flex-col gap-1">
          {/* The product first, as the laptop's brief says it, so the CPSC line under it has something to be about. */}
          <p aria-hidden="true" className="text-body font-medium text-balance text-text">
            {recall.product}
          </p>
          <p className="text-ui text-muted">{source}</p>
          {/* Who pays, only where it is true: a company's own recall. The shared demo recall (no owner) is a public CPSC
              recall, and its seller is never named as a Remedy customer (DESIGN.md). */}
          <p className="text-ui text-muted">
            Sold by <span className="text-text">{company}</span>
            {recall.owner ? ", which pays these refunds through Remedy." : "."}
          </p>
        </div>
        {image && <RecallPhoto url={image.url} caption={image.caption || undefined} product={recall.product} />}
      </div>

      {/* Laptops: the product as the brief's small header, so the offer beside it is the one headline. */}
      <div className="flex flex-col gap-1 max-lg:hidden">
        <p aria-hidden="true" className="font-display text-body font-semibold text-balance text-text">
          {recall.product}
        </p>
        <p className="text-ui text-muted">{source}</p>
      </div>
      {hazard && <Hazard text={hazard} />}

      {image && (
        <figure className="flex flex-col gap-2 max-lg:hidden">
          {/* Preserve the official photograph's colors; the plate has a fixed height to prevent layout shift. */}
          <div className="flex h-80 items-center justify-center overflow-hidden rounded-card bg-surface p-4 ring-1 ring-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={image.caption ? "" : `The recalled ${recall.product}`} fetchPriority="high" className="block max-h-full w-auto max-w-full rounded-control object-contain" />
          </div>
          {image.caption && <figcaption className="max-w-read text-ui text-faint">{image.caption}</figcaption>}
        </figure>
      )}

      <dl className="grid grid-cols-2 border-t border-line text-ui max-lg:hidden">
        <Fact label="Units recalled" value={recall.units || "Not stated"} />
        <Fact label="Sold by" value={company} />
      </dl>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 pt-3 pr-4">
      <dt className="text-faint">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  );
}
