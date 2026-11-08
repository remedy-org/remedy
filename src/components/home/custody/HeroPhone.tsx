import Image from "next/image";
import { Money, Paper, Stamp } from "@/components/ui";
import { CLAIM } from "./claim";
import { PhoneFrame } from "./frames";

// The hero below 1024px: no laptop (its screen would render at 5px), a phone at 1:1 showing where the claim ends, the
// refund receipt. A presentational copy of the claim flow's receipt for claim RM-0442.
export function HeroPhone() {
  return (
    <figure className="m-0 flex flex-col items-center gap-3">
      <PhoneFrame step={4} className="relative">
        <div className="flex flex-col gap-4 p-4" aria-hidden="true">
          {/* The paid receipt, flat: the one physical moment, so the one stamp. The amount and the claim id once each. */}
          <Paper variant="receipt" perforated padding="none">
            <div className="flex flex-col px-5 pt-8 pb-5">
              <div className="flex items-baseline justify-between gap-3 text-ui text-ink-muted">
                <span>Refund receipt</span>
                <span className="font-mono text-micro font-medium text-ink">{CLAIM.id}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <Money value={CLAIM.amount} size="amount" />
                <Stamp tone="pay">Paid</Stamp>
              </div>
              <dl className="mt-4 text-ui">
                {[
                  ["Sent to", "Your PayPal account"],
                  ["Recall", CLAIM.recall],
                ].map(([k, v], i) => (
                  <div key={k} className="flex justify-between gap-4 border-t border-dashed border-paper-line py-2">
                    <dt className="text-ink-muted">{k}</dt>
                    <dd className={i === 1 ? "font-mono" : "font-medium"}>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Paper>
          <div className="flex items-center gap-3 px-1">
            <span className="relative size-12 shrink-0 overflow-hidden rounded-control border border-line">
              <Image src={CLAIM.photo} alt="" fill sizes="48px" className="object-cover" style={{ objectPosition: CLAIM.objectPosition }} />
            </span>
            <span className="text-ui text-text-2">All 5 checks passed</span>
          </div>
        </div>
      </PhoneFrame>
    </figure>
  );
}
