"use client";

import clsx from "clsx";
import Image from "next/image";
import type { ReactNode } from "react";
import { Money, StatusPill } from "@/components/ui";
import { CHAPTERS, CLAIM } from "./claim";
import { AiLabel, ChecksChapter, CodeTag, ConsentChapter, ExhibitPrint, PaidChapter, useDone } from "./chapters";

// The Chain of Custody at rest: what the server renders, what reduced motion and no-JS visitors get, and what a
// full-page screenshot shows. The pinned sequence replaces it after hydration only when the viewport and the visitor's
// motion setting allow (HeroRunway). Three chapters are shown as real screens at 1:1 (consent, the five checks, the
// payout), so no text is ever smaller than it is in the product; the code tag, the photo and the console row sit
// beside them as small paper objects. Reading order runs across two columns, row by row. The screens are pictures
// (aria-hidden); each caption carries the chapter in words.

function Caption({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <figcaption className="flex flex-col gap-1.5">
      <span className="micro text-faint">
        {n} · <span className="text-text-2">{title}</span>
      </span>
      <span className="max-w-[60ch] text-ui text-pretty text-muted">{text}</span>
    </figcaption>
  );
}

/** A chapter's final screen at 1:1, in a frame. */
function Screen({ i, children }: { i: number; children: ReactNode }) {
  const c = CHAPTERS[i];
  return (
    <figure className="m-0 flex flex-col gap-4">
      <Caption n={c.n} title={c.title} text={c.text} />
      <div className="rounded-frame bg-bg p-5 shadow-card" aria-hidden="true">
        {children}
      </div>
    </figure>
  );
}

/** A small paper object on the table, captioned like the screens. */
function PaperObject({ n, title, text, children, className }: { n: string; title: string; text: string; children: ReactNode; className?: string }) {
  return (
    <figure className={clsx("m-0 flex flex-col gap-5", className)}>
      <Caption n={n} title={title} text={text} />
      <div className="flex justify-center px-4 lg:justify-start" aria-hidden="true">
        {children}
      </div>
    </figure>
  );
}

export function StaticFigures() {
  const done = useDone();
  return (
    <div className="page pt-18 pb-18 lg:pt-24 lg:pb-32">
      <div className="grid-12 gap-y-5 lg:items-end">
        <div className="col-span-12 lg:col-span-7">
          <p className="micro text-faint">How it works</p>
          <h2 id="how-title" className="mt-5 text-title-lg font-medium text-balance">
            One real claim, start to finish. <span className="text-muted">Paid {CLAIM.seconds}&nbsp;s after the photo.</span>
          </h2>
        </div>
        <p className="col-span-12 max-w-[60ch] text-body text-pretty text-text-2 lg:col-span-5 lg:col-start-8 lg:pb-1">
          Claim {CLAIM.id} ran through the judges&rsquo; demo on 7 Nov, on the Kikea X-VESOLJE recall, in PayPal sandbox money.
        </p>
      </div>
      {/* Two columns in reading order: 01 beside 02, 03 beside 04, then 05 across. The small paper objects sit centred
          beside the tall screens, like things laid on the table next to them. */}
      <div className="mt-12 grid gap-x-[var(--col-gap)] gap-y-12 lg:mt-16 lg:grid-cols-2 lg:gap-y-16">
        <Screen i={0}>
          <ConsentChapter />
        </Screen>
        <PaperObject n={CHAPTERS[1].n} title={CHAPTERS[1].title} text={CHAPTERS[1].text} className="lg:self-center">
          <CodeTag className="max-w-[17rem] -rotate-2" />
        </PaperObject>
        <PaperObject n={CHAPTERS[2].n} title={CHAPTERS[2].title} text={CHAPTERS[2].text} className="lg:self-center">
          <ExhibitPrint sizes="272px" className="w-full max-w-[17rem] rotate-[1.5deg]">
            <AiLabel className="bottom-2 left-2" />
          </ExhibitPrint>
        </PaperObject>
        <Screen i={3}>
          <ChecksChapter p={done} />
        </Screen>
        {/* The payout wide enough for the rule card and the numeral side by side; the console row beside it. */}
        <div className="grid gap-x-[var(--col-gap)] gap-y-12 lg:col-span-2 lg:grid-cols-12">
          <div className="lg:col-span-9">
            <Screen i={4}>
              <PaidChapter p={done} />
            </Screen>
          </div>
          <PaperObject
            n="→"
            title="Kikea Store's console"
            text="The paid claim lands in the company's queue with its photo, its checks and the time from photo to PayPal."
            className="lg:col-span-3"
          >
            <div className="w-full max-w-[20rem] overflow-hidden rounded-card bg-surface shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
                <span className="text-ui font-medium">Console</span>
                <span className="micro text-faint">{CLAIM.recall}</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="relative h-6 w-8 shrink-0 overflow-hidden rounded-[4px] border border-line">
                  <Image src={CLAIM.photo} alt="" fill sizes="32px" className="object-cover" style={{ objectPosition: CLAIM.objectPosition }} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="font-mono text-ui font-medium">{CLAIM.id}</span>
                  <span className="font-mono text-micro text-faint">Code {CLAIM.code}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <StatusPill status="paid" />
                  <span className="font-mono text-ui">
                    <Money value={CLAIM.amount} size="grid" />
                  </span>
                  <span className="micro text-[10px] text-faint">Sandbox</span>
                </span>
              </div>
            </div>
          </PaperObject>
        </div>
      </div>
    </div>
  );
}
