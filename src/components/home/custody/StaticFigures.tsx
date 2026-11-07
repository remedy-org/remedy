"use client";

import type { ReactNode } from "react";
import { CHAPTERS, CLAIM } from "./claim";
import { CodeChapter, ChecksChapter, ConsentChapter, ConsoleChapter, PaidChapter, PhotoChapter, useDone } from "./chapters";
import styles from "./custody.module.css";

// The Chain of Custody at rest: each chapter's final state as a figure, then the claim in Kikea Store's console. This
// is what the server renders, what reduced motion and no-JS visitors get, and what a full-page screenshot shows. The
// pinned sequence replaces it after hydration only when the viewport and the visitor's motion setting allow
// (HeroRunway). The screens are pictures (aria-hidden); each caption carries the chapter in words.
export function StaticFigures() {
  const done = useDone();
  const figures: { n: string; title: string; text: string; screen: ReactNode }[] = [
    ...CHAPTERS.map((c, i) => ({
      ...c,
      screen: [<ConsentChapter key="01" />, <CodeChapter key="02" p={done} />, <PhotoChapter key="03" p={done} />, <ChecksChapter key="04" p={done} />, <PaidChapter key="05" p={done} />][i],
    })),
    {
      n: "→",
      title: "Kikea Store's console",
      text: "The paid claim lands in the company's queue with its photo, its checks and the time from photo to PayPal, beside the sample claims the demo workspace starts with.",
      screen: <ConsoleChapter p={done} />,
    },
  ];
  return (
    <div className="mx-auto max-w-content px-4 pt-4 pb-18 sm:px-8 lg:pt-0 lg:pb-16">
      <h2 id="how-title" className="max-w-[46ch] text-head-sm font-medium text-balance">
        One real claim, start to finish.{" "}
        <span className="text-muted">
          Claim {CLAIM.id} ran through the judges&rsquo; demo on 7 Nov and was paid {CLAIM.seconds} s after the photo.
        </span>
      </h2>
      <ol className="mt-8 grid gap-x-6 gap-y-12 lg:grid-cols-2 lg:gap-y-8">
        {figures.map((f) => (
          <li key={f.n}>
            <figure className="m-0 flex h-full flex-col gap-4">
              <figcaption className="flex flex-col gap-1.5">
                <span className="micro text-accent-text">
                  {f.n} · {f.title}
                </span>
                <span className="max-w-[60ch] text-ui text-muted">{f.text}</span>
              </figcaption>
              <div className="flex flex-1 items-center rounded-frame border border-line bg-bg p-5 lg:px-6 lg:py-4" aria-hidden="true">
                <div className={`w-full ${styles.figureZoom}`}>{f.screen}</div>
              </div>
            </figure>
          </li>
        ))}
      </ol>
    </div>
  );
}
