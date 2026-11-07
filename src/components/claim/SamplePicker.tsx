import Link from "next/link";
import { Button, Card, StatusPill, statusLabel } from "@/components/ui";
import type { DemoSample } from "@/lib/demo";
import type { Refusal } from "@/lib/limits";
import type { Decision } from "@/lib/types";
import { LimitNotice } from "./LimitNotice";

export interface SampleOption {
  sample: DemoSample;
  /** Why it can't run yet, e.g. the repost needs the genuine claim first. */
  locked?: string;
}

export interface DemoRun {
  id: string;
  href: string;
  title: string;
  decision: Decision;
}

/** Demo mode's stand-in for the camera: pick one of the four sample claims. A plain form, no script needed. */
export function SamplePicker({
  slug,
  options,
  selected,
  runs,
  roundDone,
  refusal,
}: {
  slug: string;
  options: SampleOption[];
  selected: string;
  /** This round's demo claims. */
  runs: DemoRun[];
  /** Every sample has run in this round. */
  roundDone: boolean;
  refusal?: Refusal | null;
}) {
  return (
    <Card padding="lg" as="section" aria-labelledby="picker-title" className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 id="picker-title" className="text-h2 font-semibold">
          Pick a sample claim
        </h2>
        <p className="text-body text-muted">Each one runs the real checks. Only the genuine claim should be paid, and only once per round.</p>
      </div>

      {refusal && <LimitNotice refusal={refusal} demo />}

      <form action="/api/claims" method="post" className="flex flex-col gap-6">
        <input type="hidden" name="recall" value={slug} />
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">Sample claims</legend>
          {options.map(({ sample, locked }) => (
            <label
              key={sample.id}
              className="flex cursor-pointer gap-4 rounded-card border border-line p-3 transition-colors duration-160 hover:bg-surface-2 has-checked:border-accent has-checked:bg-accent-soft has-disabled:cursor-not-allowed has-disabled:opacity-60 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
            >
              <input type="radio" name="sample" value={sample.id} defaultChecked={sample.id === selected} disabled={Boolean(locked)} className="sr-only" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sample.photos[0]} alt="" className="h-20 w-16 shrink-0 rounded-control border border-line object-cover" />
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="text-ui font-medium text-text">{sample.title}</span>
                  <StatusPill status={sample.expect} label={`Should be ${statusLabel(sample.expect).toLowerCase()}`} />
                </span>
                <span className="text-ui text-muted">{locked ?? sample.description}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Button type="submit" size="lg" block>
          Use this sample
        </Button>
      </form>

      {runs.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="micro text-faint">Your demo claims</h3>
          <ul className="flex flex-col">
            {runs.map((r) => (
              <li key={r.id} className="border-b border-line last:border-b-0">
                <Link href={r.href} className="flex min-h-11 items-center justify-between gap-3 text-ui hover:text-text">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="font-mono text-faint">{r.id}</span>
                    <span className="truncate text-muted">{r.title}</span>
                  </span>
                  <StatusPill status={r.decision} />
                </Link>
              </li>
            ))}
          </ul>
          <form action="/api/claims/round" method="post" className="flex flex-col gap-3 pt-2">
            <input type="hidden" name="recall" value={slug} />
            {roundDone && <p className="text-ui text-muted">All four samples have run. Run them again to see the same four outcomes.</p>}
            <Button type="submit" variant="secondary" block>
              Run the samples again
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
}
