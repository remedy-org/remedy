"use client";

import clsx from "clsx";
import Image from "next/image";
import type { ReactNode } from "react";
import { OpenedExhibit } from "@/components/home/teardown";
import { AmountText } from "@/components/console/cells";
import { VerdictMark } from "@/components/console/VerdictMark";
import { NoBreakHyphens } from "@/components/ui";
import { CHAPTERS, CLAIM } from "./claim";
import { CodeTag, ConsentChapter } from "./chapters";
import { ScreenBar } from "./frames";

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

/** `filed`: RM-0442's filing day and time as the console lists it today (HeroRunway, from the console's rows). */
export function StaticFigures({ filed }: { filed: string }) {
  return (
    <>
      <div className="page pt-18 lg:pt-24">
        <div className="grid-12 gap-y-5 lg:items-end">
          <div className="col-span-12 lg:col-span-7">
            <p className="eyebrow text-muted">How it works</p>
            {/* tabIndex -1: the nav’s How it works focuses it after the jump. One sentence in one ink (DESIGN.md). */}
            <h2 id="how-title" tabIndex={-1} className="mt-5 text-title-lg font-medium text-balance">
              Sent to PayPal {CLAIM.seconds} seconds after the photo.
            </h2>
          </div>
          <p className="col-span-12 max-w-[60ch] text-body text-pretty text-text-2 lg:col-span-5 lg:col-start-8 lg:pb-1">
            One claim, start to finish: from PayPal login to payout, on the <NoBreakHyphens>X-VESOLJE</NoBreakHyphens> Nursing Pillows recall.
          </p>
        </div>
        {/* 01 beside 02: the tall consent screen, and the code tag centred beside it like a thing laid on the table. */}
        <div className="mt-12 grid gap-x-[var(--col-gap)] gap-y-12 lg:mt-16 lg:grid-cols-2">
          <Screen i={0}>
            <ConsentChapter about />
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
            {/* RM-0442's row as the console's queue sets it (cells.tsx): the id and its filing time in mono, the verdict's
                mark, the amount as the console prints money; under the console window's own bar. */}
            <div className="w-full max-w-[20rem] overflow-hidden rounded-card bg-surface shadow-card">
              <ScreenBar compact />
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="relative h-6 w-8 shrink-0 overflow-hidden rounded-[4px] border border-line">
                  <Image src={CLAIM.photo} alt="" width={32} height={24} className="size-full object-cover" style={{ objectPosition: CLAIM.objectPosition }} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="font-mono text-ui font-medium">{CLAIM.id}</span>
                  <span className="mt-0.5 font-mono text-micro text-faint">{filed}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <VerdictMark verdict="paid" />
                  <AmountText amount={`$${CLAIM.amount.toFixed(2)}`} tone="sent" />
                </span>
              </div>
            </div>
          </PaperObject>
        </div>
      </div>
    </>
  );
}
