"use client";

import clsx from "clsx";
import Image from "next/image";
import type { ReactNode } from "react";
import { OpenedExhibit } from "@/components/home/teardown";
import { VerdictMark } from "@/components/console/VerdictMark";
import { Money, NoBreakHyphens } from "@/components/ui";
import { CHAPTERS, CLAIM } from "./claim";
import { CodeTag, ConsentChapter } from "./chapters";

// The Chain of Custody at rest: what the server renders, what reduced motion and no-JS visitors get, and what a
// full-page screenshot shows. The pinned sequence replaces it after hydration only when the viewport and the visitor's
// motion setting allow (HeroRunway). Chapter 01 is the real consent screen at 1:1 and chapter 02 the code tag beside
// it; chapters 03 to 05 are the Opened Exhibit's static form (the evidence still, every check with its quote, and the
// paid receipt); then the console row the claim lands in. The screens are pictures (aria-hidden); each caption
// carries the chapter in words.

function Caption({ title, text }: { title: string; text: string }) {
  return (
    <figcaption className="flex flex-col gap-1.5">
      <span className="eyebrow text-text-2">{title}</span>
      <span className="max-w-[60ch] text-ui text-pretty text-muted">{text}</span>
    </figcaption>
  );
}

/** A chapter's final screen at 1:1, in a frame. */
function Screen({ i, children }: { i: number; children: ReactNode }) {
  const c = CHAPTERS[i];
  return (
    <figure className="m-0 flex flex-col gap-4">
      <Caption title={c.title} text={c.text} />
      <div className="rounded-frame bg-bg p-5 shadow-card" aria-hidden="true">
        {children}
      </div>
    </figure>
  );
}

/** A small paper object on the table, captioned like the screens. */
function PaperObject({ title, text, children, className }: { title: string; text: string; children: ReactNode; className?: string }) {
  return (
    <figure className={clsx("m-0 flex flex-col gap-5", className)}>
      <Caption title={title} text={text} />
      <div className="flex justify-center px-4 lg:justify-start" aria-hidden="true">
        {children}
      </div>
    </figure>
  );
}

export function StaticFigures() {
  return (
    <>
      <div className="page pt-18 lg:pt-24">
        <div className="grid-12 gap-y-5 lg:items-end">
          <div className="col-span-12 lg:col-span-7">
            <p className="eyebrow text-muted">How it works</p>
            {/* tabIndex -1: the nav’s How it works focuses it after the jump. */}
            <h2 id="how-title" tabIndex={-1} className="mt-5 text-title-lg font-medium text-balance">
              Sent to PayPal {CLAIM.seconds} seconds after the photo. <span className="text-muted">One claim, start to finish.</span>
            </h2>
          </div>
          <p className="col-span-12 max-w-[60ch] text-body text-pretty text-text-2 lg:col-span-5 lg:col-start-8 lg:pb-1">
            From PayPal login to payout, on the <NoBreakHyphens>X-VESOLJE</NoBreakHyphens> nursing pillow recall.
          </p>
        </div>
        {/* 01 beside 02: the tall consent screen, and the code tag centred beside it like a thing laid on the table. */}
        <div className="mt-12 grid gap-x-[var(--col-gap)] gap-y-12 lg:mt-16 lg:grid-cols-2">
          <Screen i={0}>
            <ConsentChapter />
          </Screen>
          <PaperObject title={CHAPTERS[1].title} text={CHAPTERS[1].text} className="lg:self-center">
            <CodeTag className="max-w-[17rem]" />
          </PaperObject>
        </div>
      </div>
      {/* 03 to 05: the photo, the five checks and the payout, as the exhibit. */}
      <OpenedExhibit chapters={CHAPTERS.length} />
      <div className="page pb-18 lg:pb-32">
        <div className="grid-12">
          <PaperObject title={CHAPTERS[5].title} text={CHAPTERS[5].text} className="col-span-12 lg:col-span-4">
            <div className="w-full max-w-[20rem] overflow-hidden rounded-card bg-surface shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
                <span className="text-ui font-medium">Console</span>
                <span className="font-mono text-micro text-faint">{CLAIM.recall}</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="relative h-6 w-8 shrink-0 overflow-hidden rounded-[4px] border border-line">
                  <Image src={CLAIM.photo} alt="" fill sizes="32px" className="object-cover" style={{ objectPosition: CLAIM.objectPosition }} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="font-mono text-ui font-medium">{CLAIM.id}</span>
                  <span className="text-micro text-faint">
                    Code <span className="font-mono">{CLAIM.code}</span>
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <VerdictMark verdict="paid" />
                  <span className="font-mono text-ui">
                    <Money value={CLAIM.amount} size="grid" />
                  </span>
                </span>
              </div>
            </div>
          </PaperObject>
        </div>
      </div>
    </>
  );
}
