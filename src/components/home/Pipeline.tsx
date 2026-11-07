"use client";

import clsx from "clsx";
import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { Money, Paper, Stamp, StatusPill, type StampTone, type Status } from "@/components/ui";
import styles from "./home.module.css";
import { Enter } from "./Reveal";

// The checks in the order they run (src/lib/rule.ts): preCheck's three need no model; then the model describes and a
// fixed rule decides.
const GATES: { title: string; text: string; ai: boolean }[] = [
  {
    title: "Live camera session",
    text: "Photos must arrive inside this claim's 10-minute camera session. An image made anywhere else is refused before the model sees it.",
    ai: false,
  },
  {
    title: "Never seen before",
    text: "A perceptual fingerprint compares every photo with every earlier claim, so a reposted or lightly edited photo is refused.",
    ai: false,
  },
  {
    title: "One claim per verified PayPal account",
    text: "PayPal must report the account as verified, and it gets one claim per recall. A claim farm needs many verified PayPal accounts, not many email addresses.",
    ai: false,
  },
  {
    title: "The code, character by character",
    text: "The model reads the hand-written code and the product label. K7Q written on a claim issued K7P is a reject.",
    ai: true,
  },
  {
    title: "Really destroyed",
    text: "The model confirms each step the notice asks for, such as “cut fully in half”, and that the photo isn't of a screen or a print.",
    ai: true,
  },
];

// The judges' four demo samples (src/lib/demo/samples.ts), the gate that stops each (its decidedBy check: session,
// duplicate_photo, code) and the reason rule.ts gives. stop is a gate index; 5 is past every gate, to the payout.
interface Sample {
  lane: string;
  title: string;
  photo: string;
  stop: number;
  status: Status;
  stamp: string;
  tone: StampTone;
  reason: ReactNode;
  note?: string;
}

const SAMPLES: Sample[] = [
  { lane: "AI image", title: "An AI image, sent in", photo: "/demo/c08-1.jpg", stop: 0, status: "blocked", stamp: "Blocked", tone: "stop", reason: "This photo wasn't taken in this claim's camera session" },
  { lane: "Repost", title: "The same photo, reposted", photo: "/demo/c02-1.jpg", stop: 1, status: "blocked", stamp: "Blocked", tone: "stop", reason: "Photo 1 was already used in another claim" },
  {
    lane: "Wrong code",
    title: "The wrong code",
    photo: "/demo/c11-1.jpg",
    stop: 3,
    status: "rejected",
    stamp: "Rejected",
    tone: "stop",
    reason: "Written code reads K7Q; this claim's code is K7P",
    note: "reads K7Q, code is K7P",
  },
  {
    lane: "Genuine",
    title: "A genuine claim",
    photo: "/demo/c02-1.jpg",
    stop: 5,
    status: "paid",
    stamp: "Paid",
    tone: "pay",
    reason: (
      <>
        <Money value={29.99} /> sent to the owner&rsquo;s PayPal account, in sandbox money
      </>
    ),
  },
];

const RULE = (
  <>
    any &ldquo;no&rdquo; &rarr; reject <span className="text-faint">·</span> any &ldquo;unclear&rdquo; &rarr; hold <span className="text-faint">·</span> the model never moves
    money
  </>
);

// Drop timing (DESIGN.md, move 4): tags fall 300ms apart and land in 460ms (SPRING.drop), then their stamps land.
const FALL_GAP = 300;
const FALL_FOR = 460;
const vars = (v: Record<string, string | number>) => v as CSSProperties;
const TILT = [-1.5, 1.2, -0.8, 1.5];

/** A 56px sample photo on a paper tag, labelled as a sample on the tag itself, with the gate's stamp under it. */
function SampleTag({ sample, tilt }: { sample: Sample; tilt: number }) {
  return (
    <Paper variant="tag" hole padding="none" tilt={tilt} className="w-32 [--tag-cut:12px]">
      <div className="flex items-end gap-2 px-2.5 pt-8">
        <Image src={sample.photo} alt="" width={56} height={56} className="size-14 shrink-0 rounded-[3px] object-cover" />
        <span className="font-mono text-micro leading-[1.15] tracking-[0.04em] text-ink-muted uppercase">
          Sample
          <br />
          photo
        </span>
      </div>
      <div className="flex h-13 items-center justify-center">
        <Stamp tone={sample.tone} className={styles.stamp}>
          {sample.stamp}
        </Stamp>
      </div>
    </Paper>
  );
}

const COLS = "grid grid-cols-[3rem_minmax(0,1fr)_repeat(4,9.5rem)]";

/**
 * "What stops a fake" as a pipeline (laptops): five gates as hairlines across the page, NO AI and MODEL READS bands
 * labelled on the left rail, and the judges' four samples falling down their lanes on scroll until the gate that
 * stops them. Every resting state is in the markup; the drop only plays when motion is allowed.
 */
export function Pipeline() {
  // Each tag falls from the top of its lane: measure how far before arming.
  const arm = (root: HTMLElement) => {
    const top = root.querySelector<HTMLElement>("[data-lanes-top]")?.getBoundingClientRect().bottom ?? 0;
    root.querySelectorAll<HTMLElement>("[data-tag]").forEach((tag) => {
      tag.style.setProperty("--fall", `${Math.round(top - tag.getBoundingClientRect().top - 24)}px`);
    });
  };

  const rows = [...GATES, null];

  return (
    <Enter className="relative hidden lg:block" threshold={0.2} onArm={arm}>
      <div className={COLS} data-lanes-top>
        <span className="micro col-span-2 pb-4 text-faint">Gate</span>
        {SAMPLES.map((s) => (
          <span key={s.lane} className="micro pb-4 pl-3 text-faint">
            {s.lane}
          </span>
        ))}
      </div>
      <ol className="relative">
        {rows.map((g, row) => {
          const bandStart = g !== null && (row === 0 || g.ai !== GATES[row - 1].ai);
          return (
            <li key={row} className={clsx("relative border-t", COLS, bandStart && row > 0 ? "border-line-strong" : "border-line")}>
              {bandStart && (
                // The band's name sits on the left rail, written up the page like a ruler's.
                <span className="micro absolute top-6 -left-8 flex w-8 rotate-180 justify-center text-faint [writing-mode:vertical-rl]" aria-hidden="true">
                  {g.ai ? "Model reads" : "No AI"}
                </span>
              )}
              {g === null ? (
                <div className="col-span-4 py-6 pr-12">
                  <h3 className="text-head-sm font-medium">Then a fixed rule decides.</h3>
                  <p className="mt-1 max-w-[52ch] text-ui text-muted">The model only describes what it sees. The rule reads its answers:</p>
                  <p className="mt-4 inline-block rounded-control border border-line bg-surface px-3 py-2 font-mono text-micro leading-relaxed text-text">{RULE}</p>
                </div>
              ) : (
                <>
                  <span className="pt-6 font-mono text-ui text-faint tabular-nums">{String(row + 1).padStart(2, "0")}</span>
                  <div className="py-6 pr-12">
                    <h3 className="text-head-sm font-medium">
                      {g.title}
                      <span className="sr-only">{g.ai ? " (the model reads)" : " (no AI)"}</span>
                    </h3>
                    <p className="mt-1 max-w-[60ch] text-ui text-muted">{g.text}</p>
                  </div>
                </>
              )}
              {SAMPLES.map((s, lane) => {
                // In the last row the rule card spans the first two lanes, which are empty by then.
                if (g === null && lane < 2) return null;
                const at = lane * FALL_GAP;
                const stopsHere = s.stop === row;
                const through = s.stop > row;
                return (
                  <div key={s.lane} className="relative pl-3">
                    {(through || stopsHere) && (
                      <span
                        aria-hidden="true"
                        className={clsx(styles.trail, "absolute top-0 left-[calc(0.75rem+4rem)] w-0 border-l border-dashed border-line-strong", through ? "bottom-0" : "h-6")}
                        style={vars({ "--trail-at": `${at + (row / (s.stop + 1)) * FALL_FOR}ms`, "--trail-for": `${Math.round(FALL_FOR / (s.stop + 1))}ms` })}
                      />
                    )}
                    {stopsHere && (
                      <div className="relative py-5" style={vars({ "--stamp-at": `${at + FALL_FOR}ms` })}>
                        <div data-tag className={clsx(styles.fall, "relative w-32")} style={vars({ "--fall-at": `${at}ms` })}>
                          <SampleTag sample={s} tilt={TILT[lane]} />
                        </div>
                        {s.note && (
                          <p aria-hidden="true" className={clsx(styles.note, "absolute top-[7.75rem] right-full flex items-center gap-2 font-mono text-micro whitespace-nowrap text-stop")}>
                            {s.note}
                            <span className="h-px w-6 bg-stop/60" />
                          </p>
                        )}
                        <p className="sr-only">
                          Sample: {s.title}. {s.stamp} here: {s.reason}.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </li>
          );
        })}
      </ol>
      {/* The genuine claim, past every gate, becomes a payout tag beside it. */}
      <div aria-hidden="true" className="pointer-events-none absolute right-[calc(9.5rem+0.75rem)] bottom-10">
        <div className={styles.fall} style={vars({ "--fall-at": `${3 * FALL_GAP + FALL_FOR}ms`, "--fall": "-24px" })}>
          <Paper variant="tag" hole padding="none" tilt={-2} className="w-40 [--tag-cut:12px]">
            <div className="px-4 pt-9 pb-4">
              <p className="micro text-ink-muted">Refund · sandbox</p>
              <p className="mt-1 text-head-sm font-semibold text-ink">
                <Money value={29.99} />
              </p>
              <p className="mt-0.5 font-mono text-micro text-ink-muted">sent to PayPal</p>
            </div>
          </Paper>
        </div>
      </div>
    </Enter>
  );
}

/** Phones and tablets: the gates as a list, each sample as a row under the gate that stopped it. */
export function PipelineList() {
  const stoppedAt = (row: number) => SAMPLES.filter((s) => s.stop === row);
  const rows = (row: number, label: string) =>
    stoppedAt(row).length > 0 && (
      <ul className="mt-4 flex flex-col gap-2 sm:pl-12" aria-label={label}>
        {stoppedAt(row).map((s) => (
          <li key={s.lane} className="flex gap-3 rounded-card border border-line bg-surface p-3">
            <Image src={s.photo} alt="" width={56} height={56} className="size-14 shrink-0 rounded-control border border-line object-cover" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="text-ui font-medium">{s.title}</span>
                <StatusPill status={s.status} />
              </span>
              <span className="mt-1 block text-ui text-muted">{s.reason}</span>
              <span className="micro mt-1 block text-faint">Sample photo</span>
            </span>
          </li>
        ))}
      </ul>
    );

  return (
    <ol className="flex flex-col lg:hidden">
      {GATES.map((g, i) => {
        const bandStart = i === 0 || g.ai !== GATES[i - 1].ai;
        return (
          <li key={g.title} className={clsx("border-t py-6", bandStart && i > 0 ? "border-line-strong" : "border-line")}>
            {bandStart && <p className="micro mb-4 text-faint">{g.ai ? "Model reads" : "No AI"}</p>}
            <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2">
              <span className="pt-0.5 font-mono text-ui text-faint tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="text-body font-semibold">{g.title}</h3>
                <p className="mt-1 text-ui text-muted">{g.text}</p>
              </div>
            </div>
            {rows(i, `Stopped at gate ${i + 1}`)}
          </li>
        );
      })}
      <li className="border-t border-line py-6">
        <h3 className="text-body font-semibold">Then a fixed rule decides.</h3>
        <p className="mt-1 text-ui text-muted">The model only describes what it sees.</p>
        <p className="mt-3 rounded-control border border-line bg-surface px-3 py-2 font-mono text-micro leading-relaxed">{RULE}</p>
        {rows(5, "Passed every gate")}
      </li>
    </ol>
  );
}
