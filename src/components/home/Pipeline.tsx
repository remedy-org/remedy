"use client";

import clsx from "clsx";
import Image from "next/image";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { refusalLine } from "@/app/console/_lib/view";
import { Money } from "@/components/ui";
import { GENUINE } from "@/lib/demo/claims";
import { CHECK_NAMES } from "@/lib/fiveChecks";
import styles from "./home.module.css";
import laneStyles from "./pipeline.module.css";
import { claimAt, clamp01, trailAt } from "./pipeline-motion";
import { readPage, STOPS } from "./scroll/stops";

// The checks in the order they run (src/lib/rule.ts): preCheck's three need no model; then the model describes and a
// fixed rule decides.
export const GATES: { title: string; text: string; ai: boolean }[] = [
  {
    title: CHECK_NAMES.session,
    text: "The photo must arrive with this claim’s session key, inside its 10-minute window.",
    ai: false,
  },
  {
    title: CHECK_NAMES.duplicate,
    text: "A photo fingerprint catches earlier submissions, including resized, re-saved or brightened copies.",
    ai: false,
  },
  {
    title: CHECK_NAMES.account,
    text: "PayPal must report a verified account. Each account gets one claim per recall.",
    ai: false,
  },
  {
    // The claim page's and How it works' names, word for word (lib/fiveChecks.ts CHECK_NAMES), for RM-0442, the claim
    // the homepage stages.
    title: CHECK_NAMES.code(GENUINE.code, "X-VESOLJE"),
    text: "The handwritten code and product label must match. K7Q does not pass a claim issued K7P.",
    ai: true,
  },
  {
    title: CHECK_NAMES.destroyed("Pillow", true),
    text: "The photo must show the required destruction, such as a complete cut, rather than a screen or print.",
    ai: true,
  },
];

// The four claims on /try (src/lib/demo/samples.ts), named as an owner would meet them, and the check that stops each
// (its decidedBy: session, duplicate_photo, code) with the reason rule.ts gives, as the console words it. stop is a gate index; 5
// is past every gate, to the payout. The repost carries the genuine claim's own photo: that is the point.
interface Sample {
  name: string;
  /** The claim's name where its outcome prints, so a lane whose head is under the nav still says whose line it is. */
  short: string;
  photo: string;
  stop: number;
  paid?: boolean;
  reason: ReactNode;
  shortReason: string;
}

// Each refusal in the console's own words (console/_lib/view.ts refusalLine, from the rule's reason), so a claim reads
// the same here, in the console's queue and in How it works' copy of it.
const SAMPLES: Sample[] = [
  { name: "A photo from the web", short: "Web photo", photo: "/demo/web-1.jpg", stop: 0, shortReason: "Outside this session", reason: refusalLine({ check: "session", text: "This photo wasn't sent in this claim's camera session" }) },
  { name: "A photo used before", short: "Used before", photo: "/demo/k01-1.jpg", stop: 1, shortReason: "Matches a previous photo", reason: refusalLine({ check: "duplicate_photo", text: "Photo 1 was already used in another claim" }) },
  { name: "Wrong code on the tag", short: "Wrong code", photo: "/demo/k02-1.jpg", stop: 3, shortReason: "K7Q on tag; K7P required", reason: refusalLine({ check: "code", text: "Written code reads K7Q; this claim's code is K7P" }) },
  { name: "A genuine claim", short: "Genuine claim", photo: "/demo/k01-1.jpg", stop: 5, paid: true, shortReason: "$29.99 to PayPal", reason: <><Money value={29.99} /> to the owner&rsquo;s PayPal</> },
];

const RULE = <>Any &ldquo;no&rdquo; refuses the claim. Any &ldquo;unclear&rdquo; holds it for a person.</>;

/**
 * A claim's outcome where its line ends: Refused (or Paid) in its state colour, then why, in one plain line. In the
 * matrix it is named ("Web photo: refused"): at the rule's stop the lanes' heads are under the nav.
 */
function Outcome({ sample, named }: { sample: Sample; named?: boolean }) {
  const word = sample.paid ? "Paid" : "Refused";
  return (
    <>
      <span className="block font-medium">
        {named && <span className="text-text">{sample.short}: </span>}
        <span className={sample.paid ? "text-pay" : "text-stop"}>{named ? word.toLowerCase() : word}</span>
      </span>
      <span className="mt-0.5 block text-muted">
        {named ? <><span aria-hidden="true">{sample.shortReason}</span><span className="sr-only">{sample.reason}</span></> : sample.reason}
      </span>
    </>
  );
}

// On the page grid: the checks in columns 1 to 5, the four claims in 6 to 12.
const GATE = "col-span-5";
const LANES = "col-span-7 grid grid-cols-4 gap-x-4 xl:gap-x-[var(--col-gap)]";
const LINE = clsx(laneStyles.wire, "absolute w-px bg-line-strong");

/** The existing section and rule scroll stops are the start/end of the matrix's move. There is no autoplay or
 * catch-up timer: claim photos, ink and outcomes follow the reader in either direction, including a direct anchor. */
function useLanes<T extends HTMLElement>(ref: RefObject<T | null>, matrix = false) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const heads = [...root.querySelectorAll<HTMLElement>("[data-lane-head]")];
    const outcomes = [...root.querySelectorAll<HTMLElement>("[data-outcome]")];
    const copies = [...root.querySelectorAll<HTMLElement>("[data-outcome-copy]")];
    const trails = [...root.querySelectorAll<HTMLElement>("[data-trail]")];
    let frame = 0;
    let lastProgress = -1;
    let range: [number, number] | null = null;
    let lanes: { head: HTMLElement; origin: number; stop: number; trails: { el: HTMLElement; top: number; height: number }[]; outcomes: HTMLElement[]; copies: HTMLElement[] }[] = [];
    const clear = () => {
      delete root.dataset.progress;
      lastProgress = -1;
      heads.forEach((el) => {
        el.style.removeProperty("transform");
        el.style.removeProperty("--docked");
      });
      trails.forEach((el) => el.style.removeProperty("transform"));
      outcomes.forEach((el) => el.style.removeProperty("opacity"));
      copies.forEach((el) => el.style.removeProperty("transform"));
    };
    const paint = () => {
      frame = 0;
      if (!root.offsetWidth || reduced.matches) return;
      if (!matrix) {
        // A narrow screen keeps each claim beside its check; reveal its result only as that row is read.
        root.querySelectorAll<HTMLElement>("[data-stop]").forEach((cell) => {
          const amount = clamp01((innerHeight * 0.82 - cell.getBoundingClientRect().top) / 64);
          cell.querySelectorAll<HTMLElement>("[data-outcome]").forEach((el) => (el.style.opacity = amount.toFixed(3)));
        });
        return;
      }
      if (!range || !lanes.length) return;
      const progress = clamp01((scrollY - range[0]) / (range[1] - range[0]));
      if (progress === lastProgress) return;
      lastProgress = progress;
      root.dataset.progress = progress.toFixed(4);
      const last = Math.max(...lanes.map((lane) => lane.stop));
      for (const lane of lanes) {
        const state = claimAt(progress, lane.origin, lane.stop, last);
        lane.head.style.transform = `translateY(${state.travel.toFixed(2)}px)`;
        lane.head.style.setProperty("--docked", state.dock.toFixed(4));
        lane.trails.forEach(({ el, top, height }) => (el.style.transform = `scaleY(${trailAt(state.tip, top, height).toFixed(4)})`));
        lane.outcomes.forEach((el) => (el.style.opacity = state.outcome.toFixed(3)));
        lane.copies.forEach((el) => (el.style.transform = `translateY(${(8 * (1 - state.outcome)).toFixed(2)}px)`));
      }
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const measure = () => {
      if (!root.offsetWidth || reduced.matches) {
        range = null;
        clear();
        return;
      }
      if (matrix) {
        lastProgress = -1;
        const page = readPage();
        const first = STOPS.find((stop) => stop.name === "Fraud checks")?.at(page);
        const final = STOPS.find((stop) => stop.name === "Fraud checks, the rule")?.at(page);
        if (typeof first !== "number") return;
        // On a screen tall enough to show the whole matrix, the next natural scroll still advances the claims.
        range = [first, typeof final === "number" && final > first + 1 ? final : first + Math.min(480, innerHeight * 0.35)];
        lanes = heads.flatMap((head) => {
          const lane = head.dataset.laneHead!;
          const origin = head.parentElement!;
          const stop = root.querySelector<HTMLElement>(`[data-stop="${lane}"]`);
          const dock = root.querySelector<HTMLElement>(`[data-lane-dock="${lane}"]`);
          if (!stop || !dock) return [];
          return [{
            head,
            origin: origin.getBoundingClientRect().top + scrollY,
            stop: dock.getBoundingClientRect().top + scrollY,
            trails: trails.filter((el) => el.dataset.trail === lane).map((el) => ({ el, top: el.getBoundingClientRect().top + scrollY, height: el.offsetHeight })),
            outcomes: [...stop.querySelectorAll<HTMLElement>("[data-outcome]")],
            copies: [...stop.querySelectorAll<HTMLElement>("[data-outcome-copy]")],
          }];
        });
      }
      paint();
    };
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    const main = root.closest("main");
    if (main) ro.observe(main);
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", measure);
    reduced.addEventListener("change", measure);
    document.fonts?.ready.then(measure);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", measure);
      reduced.removeEventListener("change", measure);
      clear();
    };
  }, [ref, matrix]);
}

/**
 * Fraud checks on laptops: the five checks as rows on hairlines, each marked No AI or Photo check, and the four claims
 * from /try as lanes beside them, each headed by its photo. A lane's line runs down through every check its claim
 * passes and ends at the one that stops it, with the outcome said once; the genuine claim runs on to the rule and is
 * paid. No-JS and reduced motion keep the full diagram; ordinary motion scrubs from one existing scroll frame to the next.
 */
export function Pipeline() {
  const ref = useRef<HTMLDivElement>(null);
  useLanes(ref, true);
  const rows = [...GATES, null];

  return (
    <div ref={ref} data-pipeline className={clsx(laneStyles.pipeline, "relative hidden lg:block")}>
      {/* Each lane's head: the claim's name, its photo, and the line's first stretch down to the first check. */}
      <div className="grid-12 items-end" data-lanes-top>
        <p className={clsx(GATE, "max-w-[44ch] pb-6 text-ui text-muted")}>Four prepared claims. Follow each one to the check that stops it.</p>
        <ul className={LANES} aria-label="The four claims">
          {SAMPLES.map((s, lane) => (
            <li key={s.name} className="relative flex flex-col items-start justify-end pb-6">
              {/* On one top line: each on one line where its column has room (1280px up); narrower, each in a box two
                  lines tall, balanced, its first line on the same top as the others'. */}
              <span className="mb-3 block min-h-[2lh] w-full text-ui text-balance text-text-2 xl:min-h-0 xl:whitespace-nowrap">{s.name}</span>
              <span data-lane-origin className="relative block size-12">
                <span data-lane-head={lane} className={clsx(laneStyles.head, "absolute inset-0 z-10 block rounded-control", s.paid ? "text-pay" : "text-stop")}>
                  <Image src={s.photo} alt="" width={48} height={48} className="size-12 rounded-control object-cover shadow-ring" />
                </span>
              </span>
              <span data-trail={lane} aria-hidden="true" className={clsx(styles.trail, LINE, "bottom-0 h-18")} />
            </li>
          ))}
        </ul>
      </div>
      <ol className="relative">
        {rows.map((g, row) => {
          const bandStart = g !== null && (row === 0 || g.ai !== GATES[row - 1].ai);
          return (
            <li key={row} className={clsx("grid-12 relative border-t", bandStart ? "border-line-2" : "border-line")}>
              {g === null ? (
                <div className={clsx(GATE, "py-5 pr-10")}>
                  <h3 className="text-body font-medium">Then a fixed rule decides.</h3>
                  <p className="mt-2 max-w-[56ch] text-ui text-muted">AI reads the photo. It never moves the money. {RULE}</p>
                </div>
              ) : (
                <div className={clsx(GATE, "py-5 pr-10")}>
                  <div className="flex items-baseline gap-3">
                    <span aria-hidden="true" className="shrink-0 font-mono text-micro tabular-nums text-faint">{String(row + 1).padStart(2, "0")}</span>
                    <h3 className="text-body font-medium">{g.title}</h3>
                  </div>
                  {bandStart && <p className="mt-1 pl-7 text-micro text-accent-text">{g.ai ? "Photo evidence · checks 04–05" : "Before AI · checks 01–03"}</p>}
                  <p className="mt-2 max-w-[49ch] pl-7 text-ui text-pretty text-muted">{g.text}</p>
                </div>
              )}
              <div className={LANES}>
                {SAMPLES.map((s, lane) => {
                  const stopsHere = s.stop === row;
                  const through = s.stop > row;
                  return (
                    <div
                      key={s.name}
                      className="relative"
                      data-lane={lane}
                      data-stop={stopsHere ? lane : undefined}
                    >
                      {/* Each photo docks inside its row, aligned with the check title. Text starts below the photo;
                          both anchors reserve their final geometry while the scroll-driven photo approaches. */}
                      {through && <span data-trail={lane} aria-hidden="true" className={clsx(styles.trail, LINE, "inset-y-0")} />}
                      {stopsHere && (
                        <>
                          <span data-trail={lane} aria-hidden="true" className={clsx(styles.trail, LINE, laneStyles.dockTrail)} />
                          <span data-lane-dock={lane} aria-hidden="true" className={laneStyles.dock}>
                            <span className={clsx(laneStyles.dockPhoto, s.paid ? "text-pay" : "text-stop")}>
                              <Image src={s.photo} alt="" width={48} height={48} className="size-full rounded-control object-cover shadow-ring" />
                            </span>
                          </span>
                          <p data-outcome className={clsx(laneStyles.outcome, "pr-1 pb-5 text-ui text-pretty")}>
                            <span data-outcome-copy className="block"><Outcome sample={s} named /></span>
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
  const ref = useRef<HTMLOListElement>(null);
  useLanes(ref);
  const stoppedAt = (row: number) => SAMPLES.filter((s) => s.stop === row);
  const rows = (row: number) =>
    stoppedAt(row).length > 0 && (
      // Flat on the page, on hairlines (DESIGN.md: no boxes on the page): each claim a row under the check's text.
      <ul className="mt-4 flex flex-col">
        {stoppedAt(row).map((s) => (
          <li key={s.name} data-lane={SAMPLES.indexOf(s)} data-stop={SAMPLES.indexOf(s)} className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-x-3 border-t border-line py-3 text-ui last:pb-0">
            <Image src={s.photo} alt="" width={40} height={40} className="size-10 rounded-control object-cover" />
            <span className="min-w-0">
              <span className="block text-text-2">{s.name}</span>
              <span data-outcome className="mt-1 block">
                <Outcome sample={s} />
              </span>
            </span>
          </li>
        ))}
      </ul>
    );

  return (
    <ol ref={ref} className="flex flex-col lg:hidden">
      {GATES.map((g, i) => {
        const bandStart = i === 0 || g.ai !== GATES[i - 1].ai;
        return (
          <li key={g.title} className={clsx("border-t py-6", bandStart && i > 0 ? "border-line-2" : "border-line")}>
            {bandStart && <p className="eyebrow mb-4 text-muted">{g.ai ? "Photo evidence · checks 04–05" : "Before AI · checks 01–03"}</p>}
            <h3 className="flex items-baseline gap-3 text-body font-medium">
              <span aria-hidden="true" className="shrink-0 font-mono text-micro tabular-nums text-faint">{String(i + 1).padStart(2, "0")}</span>
              {g.title}
            </h3>
            <p className="mt-2 pl-7 text-ui text-pretty text-muted">{g.text}</p>
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
