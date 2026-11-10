import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui";

// The report while AG Studio loads, drawn as the report itself lays out (insights report.ts): the figures' strip with its
// five figures, then two thirds and one third on the page's gutter. Left: Recall progress, Where claims stop, Paid
// through PayPal by day; right: Decisions, then Why claims were refused. Each panel is a section under a hairline with its
// real title; grey bars stand where the numbers and bars go. No cards and no analyst rail, so nothing moves when Studio
// paints over it.

// Each panel's height on Studio's canvas (16px rows, report.ts): the first row's 240px less the canvas's top inset, then
// the funnel's row, then the day chart's.
function Section({ title, first, className, children }: { title: string; first?: boolean; className?: string; children: ReactNode }) {
  return (
    <section className={first ? className : `border-t border-line pt-8 ${className ?? ""}`}>
      <h2 className="text-ui font-medium text-text">{title}</h2>
      {children}
    </section>
  );
}

const LABELS = ["w-2/5", "w-1/3", "w-1/2", "w-1/4", "w-2/5", "w-1/3"];
const BARS = ["w-11/12", "w-3/4", "w-7/12", "w-5/12", "w-1/4", "w-1/6"];

const Rows = ({ n, bar = true }: { n: number; bar?: boolean }) => (
  <div className="mt-5 flex flex-col gap-5">
    {Array.from({ length: n }, (_, i) => (
      <div key={i} className="flex flex-col gap-2">
        <div className="flex justify-between gap-4">
          <Skeleton className={`h-3.5 ${LABELS[i % LABELS.length]}`} />
          <Skeleton className="h-3.5 w-8" />
        </div>
        {bar && <Skeleton className={`h-1.5 ${BARS[i % BARS.length]}`} />}
      </div>
    ))}
  </div>
);

export function InsightsSkeleton() {
  return (
    <div className="flex w-full flex-col" aria-busy="true" aria-label="Loading the report">
      <div className="page">
        <div className="flex min-h-20 flex-wrap items-center gap-x-8 gap-y-2 border-y border-line py-3">
          {["w-28", "w-24", "w-32", "w-44", "w-36"].map((w) => (
            <div key={w} className="flex flex-1 flex-col gap-2">
              <Skeleton className={`h-5 ${w}`} />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
      <div className="page grid grid-cols-1 pt-8 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col">
          <Section title="Recall progress" first className="h-[208px]">
            <Skeleton className="mt-6 h-9 w-40" />
            <Skeleton className="mt-6 h-1.5 w-full" />
            <Skeleton className="mt-3 h-3 w-56" />
          </Section>
          <Section title="Where claims stop" className="h-[384px]">
            <Rows n={5} />
          </Section>
          <Section title="Paid through PayPal, by day" className="h-[240px]">
            <div className="mt-6 flex h-36 items-end gap-6">
              {["h-1/5", "h-1/2", "h-1/3", "h-4/5"].map((h) => (
                <Skeleton key={h} className={`flex-1 rounded-b-none ${h}`} />
              ))}
            </div>
          </Section>
        </div>
        <div className="flex flex-col lg:pl-10">
          <Section title="Decisions" first className="h-[208px]">
            <Rows n={5} bar={false} />
          </Section>
          <Section title="Why claims were refused">
            <Rows n={6} />
          </Section>
        </div>
      </div>
    </div>
  );
}
