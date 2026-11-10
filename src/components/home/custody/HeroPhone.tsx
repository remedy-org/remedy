import Image from "next/image";
import { Money, Paper, Stamp } from "@/components/ui";
import { CLAIM } from "./claim";
import { PhoneFrame } from "./frames";

/** The mobile introduction pairs the actual evidence with its illustrative outcome before the step-by-step story. */
export function HeroPhone() {
  return (
    <figure className="m-0 flex flex-col items-center gap-3">
      <PhoneFrame bar className="relative">
        <div className="p-3">
          <div className="relative overflow-hidden rounded-control border border-line bg-surface">
            <Image
              src={CLAIM.photo}
              alt="Example evidence: the X-VESOLJE nursing pillow cut in half beside its handwritten M4T code."
              width={544}
              height={364}
              className="aspect-[3/2] w-full object-cover"
              style={{ objectPosition: CLAIM.objectPosition }}
            />
            <span className="absolute top-3 left-3 rounded-control bg-photo-scrim px-2 py-1 text-micro text-photo-scrim-text">Example evidence</span>
          </div>
          <Paper variant="receipt" perforated padding="none" className="mt-3">
            <div className="flex items-center justify-between gap-4 px-4 pt-5 pb-4">
              <div>
                <p className="mb-2 text-micro text-ink-muted">Refund in this example</p>
                <Money value={CLAIM.amount} size="amount" />
              </div>
              <Stamp tone="pay">Paid</Stamp>
            </div>
          </Paper>
          <p className="mt-3 px-1 text-micro text-muted">Same product. Five checks. One recorded outcome.</p>
        </div>
      </PhoneFrame>
    </figure>
  );
}
