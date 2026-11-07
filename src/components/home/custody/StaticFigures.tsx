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
// between them as small paper objects. Reading order runs down each column, then across. The screens are pictures
// (aria-hidden); each caption carries the chapter in words.

function Caption({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <figcaption className="flex flex-col gap-1.5">
      <span className="micro text-accent-text">
        {n} · {title}
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
      <div className="rounded-frame border border-line bg-bg p-5" aria-hidden="true">
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
    <div className="mx-auto max-w-content px-4 pt-4 pb-18 sm:px-8 lg:pt-0 lg:pb-12">
      <h2 id="how-title" className="max-w-[46ch] text-head-sm font-medium text-balance">
        One real claim, start to finish.{" "}
        <span className="text-muted">
          Claim {CLAIM.id} ran through the judges&rsquo; demo on 7 Nov and was paid {CLAIM.seconds} s after the photo.
        </span>
      </h2>
      <div className="mt-6 grid gap-x-6 gap-y-12 lg:grid-cols-3 lg:gap-y-8">
        <Screen i={0}>
          <ConsentChapter />
        </Screen>
        <div className="flex flex-col gap-12 lg:gap-10">
          <PaperObject n={CHAPTERS[1].n} title={CHAPTERS[1].title} text={CHAPTERS[1].text}>
            <CodeTag className="max-w-[17rem] -rotate-2" />
          </PaperObject>
          <PaperObject n={CHAPTERS[2].n} title={CHAPTERS[2].title} text={CHAPTERS[2].text}>
            <ExhibitPrint sizes="272px" className="w-full max-w-[17rem] rotate-[1.5deg]">
              <AiLabel className="bottom-2 left-2" />
            </ExhibitPrint>
          </PaperObject>
        </div>
        <Screen i={3}>
          <ChecksChapter p={done} />
        </Screen>
        {/* The payout wide enough for the rule card and the numeral side by side; the console row beside it. */}
        <div className="grid gap-x-6 gap-y-12 lg:col-span-3 lg:grid-cols-12">
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
            <div className="w-full max-w-[20rem] overflow-hidden rounded-card bg-surface shadow-ring">
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
                </span>
              </div>
            </div>
          </PaperObject>
        </div>
      </div>
    </div>
  );
}
