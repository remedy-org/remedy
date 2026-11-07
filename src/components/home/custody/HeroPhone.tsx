import Image from "next/image";
import { CheckIcon, Money, Paper, Stamp } from "@/components/ui";
import { CLAIM } from "./claim";
import { PhoneFrame } from "./frames";

// The hero below 1024px: no laptop (its screen would render at 5px), a phone at 1:1 showing where the claim ends, the
// refund receipt. A presentational copy of the claim flow's receipt for claim RM-0442.
export function HeroPhone() {
  return (
    <figure className="m-0 flex flex-col items-center gap-3">
      <PhoneFrame step={4} className="relative">
        <div className="flex flex-col gap-4 p-4" aria-hidden="true">
          <Paper variant="receipt" perforated padding="none" tilt={-1}>
            <div className="flex flex-col gap-4 px-5 pt-8 pb-5">
              <div className="flex items-center justify-between gap-3 font-mono text-micro text-ink-muted">
                <span className="tracking-[0.06em] uppercase">Refund receipt</span>
                <span>Claim {CLAIM.id}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pay-ink text-paper">
                  <CheckIcon size={20} />
                </span>
                <Money value={CLAIM.amount} size="amount" />
              </div>
              <p className="text-ui text-ink-muted">Refunded to your PayPal account through Remedy for Kikea Store, in PayPal sandbox money.</p>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex h-7 items-center rounded-control bg-paper-2 px-2.5 font-mono text-micro">
                  Paid {CLAIM.seconds} s after your photo
                </span>
                <Stamp tone="pay">Paid</Stamp>
              </div>
              <dl className="text-ui">
                {[
                  ["Status", "Sent to PayPal"],
                  ["Recall", `${CLAIM.recall} · X-VESOLJE`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-t border-dashed border-paper-line py-2">
                    <dt className="text-ink-muted">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Paper>
          <div className="flex items-center gap-3 px-1">
            <span className="relative size-12 shrink-0 overflow-hidden rounded-control border border-line">
              <Image src={CLAIM.photo} alt="" fill sizes="48px" className="object-cover" style={{ objectPosition: CLAIM.objectPosition }} />
            </span>
            <span className="flex flex-col">
              <span className="text-ui">All checks passed</span>
              <span className="font-mono text-micro text-faint uppercase">Exhibit A · AI-made test photo</span>
            </span>
          </div>
        </div>
      </PhoneFrame>
      <figcaption className="max-w-80 text-center text-ui text-faint">
        Claim {CLAIM.id}, run through the judges&rsquo; demo on 7 Nov: paid {CLAIM.seconds} s after the photo. Sandbox money.
      </figcaption>
    </figure>
  );
}
