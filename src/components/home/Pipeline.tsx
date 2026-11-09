"use client";

import clsx from "clsx";
import Image from "next/image";
import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Money } from "@/components/ui";
import { GENUINE } from "@/lib/demo/claims";
import { CHECK_NAMES } from "@/lib/fiveChecks";
import styles from "./home.module.css";

// The checks in the order they run (src/lib/rule.ts): preCheck's three need no model; then the model describes and a
// fixed rule decides.
export const GATES: { title: string; text: string; ai: boolean }[] = [
  {
    title: CHECK_NAMES.session,
    text: "Photos must arrive inside this claim’s 10-minute camera session. An image made anywhere else is refused before the model sees it.",
    ai: false,
  },
  {
    title: CHECK_NAMES.duplicate,
    text: "Every photo is fingerprinted and compared with every earlier claim. A reposted or lightly edited photo is refused.",
    ai: false,
  },
  {
    title: CHECK_NAMES.account,
    text: "PayPal must report the account as verified, and it gets one claim per recall. A claim farm would need a verified PayPal account for every claim.",
    ai: false,
  },
  {
    // The claim page's and How it works' names, word for word (lib/fiveChecks.ts CHECK_NAMES), for RM-0442, the claim
    // the homepage stages.
    title: CHECK_NAMES.code(GENUINE.code, "X-VESOLJE"),
    text: "The model reads the hand-written code and the product label. K7Q written on a claim issued K7P is a reject.",
    ai: true,
  },
  {
    title: CHECK_NAMES.destroyed("Pillow", true),
    text: "The model confirms each step the notice asks for, such as “cut fully in half”, and that the photo isn’t of a screen or a print.",
    ai: true,
  },
];

// The four claims on /try (src/lib/demo/samples.ts), named as an owner would meet them, and the check that stops each
// (its decidedBy: session, duplicate_photo, code) with the reason rule.ts gives, in plain words. stop is a gate index; 5
// is past every gate, to the payout. The repost carries the genuine claim's own photo: that is the point.
interface Sample {
  name: string;
  photo: string;
  stop: number;
  paid?: boolean;
  reason: ReactNode;
}

const SAMPLES: Sample[] = [
  { name: "A photo from the web", photo: "/demo/web-1.jpg", stop: 0, reason: "Not taken in this claim\u2019s camera" },
  { name: "A photo used before", photo: "/demo/c02-1.jpg", stop: 1, reason: "Same photo as an earlier claim" },
  { name: "Wrong code on the tag", photo: "/demo/c11-1.jpg", stop: 3, reason: <>The tag reads <span className="font-mono">K7Q</span>; the code is <span className="font-mono">K7P</span></> },
  { name: "A genuine claim", photo: "/demo/c02-1.jpg", stop: 5, paid: true, reason: <><Money value={29.99} /> to the owner&rsquo;s PayPal</> },
];

const RULE = <>Any &ldquo;no&rdquo; refuses the claim. Any &ldquo;unclear&rdquo; holds it for a person.</>;

/** A claim's outcome where its line ends: Refused (or Paid) in its state colour, then why, in one plain line. */
function Outcome({ sample }: { sample: Sample }) {
  return (
    <>
      <span className={clsx("block font-medium", sample.paid ? "text-pay" : "text-stop")}>{sample.paid ? "Paid" : "Refused"}</span>
      <span className="mt-0.5 block text-muted">{sample.reason}</span>
    </>
  );
}

// Ink timing (DESIGN.md, move 3): a lane's line draws down from its photo once the check that stops it is in view, at
// least 300ms after the lane before, over DRAW_FOR in all; its outcome prints as the line arrives.
const LANE_GAP = 300;
const DRAW_FOR = 720;
const vars = (v: Record<string, string | number>) => v as CSSProperties;

// On the page grid: the checks in columns 1 to 5, the four claims' lanes in 6 to 12, so each lane has room for its
// outcome in two short lines. A lane's line runs under the centre of its 48px photo (24px in); its outcome prints
// under the line's end, on the photo's left edge.
const GATE = "col-span-5";
const LANES = "col-span-7 grid grid-cols-4 gap-x-[var(--col-gap)]";
const LINE = "absolute left-6 w-px bg-muted";

/**
 * Arms each lane separately: a lane's line draws only once the check that stops it is in view (its top above 70% of the
 * viewport), so the reader sees every claim stop, the wrong code at the fourth check and the payout at the foot.
 * Nothing is armed without JS, under reduced motion, or when the matrix is already on screen at load.
 */
function useLanes(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !root.offsetWidth || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (root.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    const cells = (lane: string) => root.querySelectorAll<HTMLElement>(`[data-lane="${lane}"]`);
    root.querySelectorAll<HTMLElement>("[data-lane]").forEach((el) => (el.dataset.go = "armed"));
    let next = 0;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const lane = (e.target as HTMLElement).dataset.stop!;
          io.unobserve(e.target);
          // Lanes that come into view together still draw one after another.
          const now = performance.now();
          next = Math.max(now, next + LANE_GAP);
          cells(lane).forEach((el) => {
            el.style.setProperty("--go-at", `${Math.round(next - now)}ms`);
            el.dataset.go = "play";
          });
        }
      },
      { rootMargin: "0px 0px -30% 0px" },
    );
    root.querySelectorAll("[data-stop]").forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      // Disarm, so a second run (React's StrictMode in dev, or a remount) starts from the resting state.
      root.querySelectorAll<HTMLElement>("[data-lane]").forEach((el) => {
        delete el.dataset.go;
        el.style.removeProperty("--go-at");
      });
    };
  }, [ref]);
}

/**
 * Fraud checks on laptops: the five checks as rows on hairlines, each marked No AI or Model reads, and the four claims
 * from /try as lanes beside them, each headed by its photo. A lane's line runs down through every check its claim
 * passes and ends at the one that stops it, with the outcome said once; the genuine claim runs on to the rule and is
 * paid. Every resting state is in the markup; the lines only draw in when motion is allowed.
 */
export function Pipeline() {
  const ref = useRef<HTMLDivElement>(null);
  useLanes(ref);
  const rows = [...GATES, null];

  return (
    <div ref={ref} className="relative hidden lg:block">
      {/* Each lane's head: the claim's name, its photo, and the line's first stretch down to the first check. */}
      <div className="grid-12 items-end" data-lanes-top>
        <p className={clsx(GATE, "max-w-[44ch] pb-6 text-ui text-muted")}>Four claims, and the check that stops each one.</p>
        <ul className={LANES} aria-label="The four claims">
          {SAMPLES.map((s) => (
            <li key={s.name} className="relative flex flex-col items-start justify-end pb-6">
              {/* On one top line: each on one line where its column has room (1280px up); narrower, each in a box two
                  lines tall, balanced, its first line on the same top as the others'. */}
              <span className="mb-3 block min-h-[2lh] w-full text-ui text-balance text-text-2 xl:min-h-0 xl:whitespace-nowrap">{s.name}</span>
              <Image src={s.photo} alt="" width={48} height={48} className="size-12 rounded-control object-cover shadow-ring" />
              <span aria-hidden="true" className={clsx(LINE, "bottom-0 h-6")} />
            </li>
          ))}
        </ul>
      </div>
      <ol className="relative">
        {rows.map((g, row) => {
          const bandStart = g !== null && row > 0 && g.ai !== GATES[row - 1].ai;
          return (
            <li key={row} className={clsx("grid-12 relative border-t", bandStart ? "border-line-2" : "border-line")}>
              {g === null ? (
                <div className={clsx(GATE, "py-6 pr-12")}>
                  <h3 className="text-head-sm font-medium">Then a fixed rule decides.</h3>
                  <p className="mt-2 max-w-[56ch] text-ui text-muted">AI reads the photo. It never moves the money. {RULE}</p>
                </div>
              ) : (
                <div className={clsx(GATE, "py-6 pr-12")}>
                  <h3 className="flex items-baseline gap-3 text-head-sm font-medium">
                    {g.title}
                    <span className="text-ui font-normal whitespace-nowrap text-muted">{g.ai ? "Model reads" : "No AI"}</span>
                  </h3>
                  <p className="mt-2 max-w-[56ch] text-ui text-muted">{g.text}</p>
                </div>
              )}
              <div className={LANES}>
                {SAMPLES.map((s, lane) => {
                  const stopsHere = s.stop === row;
                  const through = s.stop > row;
                  return (
                    <div
                      key={s.name}
                      className={clsx(styles.lane, "relative")}
                      data-lane={lane}
                      data-stop={stopsHere ? lane : undefined}
                      style={vars({
                        "--trail-at": `${Math.round((row / (s.stop + 1)) * DRAW_FOR)}ms`,
                        "--trail-for": `${Math.round(DRAW_FOR / (s.stop + 1))}ms`,
                        "--outcome-at": `${DRAW_FOR}ms`,
                      })}
                    >
                      {/* Through: the line crosses the whole row. Stopped: it ends on a short bar across it, level with
                          the top of the check's name, and the outcome prints under the bar on the lane's left edge, the
                          photo's. */}
                      {through && <span aria-hidden="true" className={clsx(styles.trail, LINE, "inset-y-0")} />}
                      {stopsHere && (
                        <>
                          <span aria-hidden="true" className={clsx(styles.trail, LINE, "top-0 h-7")} />
                          <span aria-hidden="true" className={clsx(styles.outcome, "absolute top-7 left-[1.125rem] h-px w-3.5", s.paid ? "bg-pay" : "bg-stop")} />
                          <p className={clsx(styles.outcome, "pt-11 pr-2 pb-6 text-ui text-pretty")}>
                            <span className="sr-only">{s.name}: </span>
                            <Outcome sample={s} />
                          </p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Phones and tablets: the checks as a list, each claim as a flat row under the check that stopped it. */
export function PipelineList() {
  const stoppedAt = (row: number) => SAMPLES.filter((s) => s.stop === row);
  const rows = (row: number) =>
    stoppedAt(row).length > 0 && (
      <ul className="mt-4 flex flex-col gap-3">
        {stoppedAt(row).map((s) => (
          <li key={s.name} className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-x-3 rounded-card bg-surface p-3 text-ui shadow-card">
            <Image src={s.photo} alt="" width={40} height={40} className="size-10 rounded-control object-cover" />
            <span className="min-w-0">
              <span className="block text-text-2">{s.name}</span>
              <span className="mt-1 block">
                <Outcome sample={s} />
              </span>
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
          <li key={g.title} className={clsx("border-t py-6", bandStart && i > 0 ? "border-line-2" : "border-line")}>
            {bandStart && <p className="eyebrow mb-4 text-muted">{g.ai ? "Model reads" : "No AI"}</p>}
            <h3 className="text-body font-medium">{g.title}</h3>
            <p className="mt-1 text-ui text-muted">{g.text}</p>
            {rows(i)}
          </li>
        );
      })}
      <li className="border-t border-line py-6">
        <h3 className="text-body font-medium">Then a fixed rule decides.</h3>
        <p className="mt-1 text-ui text-muted">AI reads the photo. It never moves the money. {RULE}</p>
        {rows(5)}
      </li>
    </ol>
  );
}
