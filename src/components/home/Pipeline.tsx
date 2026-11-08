"use client";

import clsx from "clsx";
import Image from "next/image";
import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Money, Paper, Stamp, type StampTone, type Status } from "@/components/ui";
import styles from "./home.module.css";

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
    text: "Every photo is fingerprinted and compared with every earlier claim. A reposted or lightly edited photo is refused.",
    ai: false,
  },
  {
    title: "One claim per verified PayPal account",
    text: "PayPal must report the account as verified, and it gets one claim per recall. A claim farm would need a verified PayPal account for every claim.",
    ai: false,
  },
  {
    title: "The code, character by character",
    text: "The model reads the hand-written code and the product label. K7Q written on a claim issued K7P is a reject.",
    ai: true,
  },
  {
    title: "Destroyed as the notice says",
    text: "The model confirms each step the notice asks for, such as “cut fully in half”, and that the photo isn't of a screen or a print.",
    ai: true,
  },
];

// The four demo claims (src/lib/demo/samples.ts), the gate that stops each (its decidedBy check: session,
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
  { lane: "Upload", title: "An uploaded photo", photo: "/demo/c08-1.jpg", stop: 0, status: "blocked", stamp: "Blocked", tone: "stop", reason: "This photo wasn't taken in this claim's camera session" },
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
        <Money value={29.99} /> sent to the owner&rsquo;s PayPal account
      </>
    ),
  },
];

const RULE = (
  <>
    any &ldquo;no&rdquo; &rarr; reject <span className="text-faint">·</span> any &ldquo;unclear&rdquo; &rarr; hold for a person
  </>
);

// Drop timing (DESIGN.md, move 4): each tag falls when its own gate is in view, at least 300ms after the one before,
// lands in 460ms (SPRING.drop), then its stamp lands.
const FALL_GAP = 300;
const FALL_FOR = 460;
const vars = (v: Record<string, string | number>) => v as CSSProperties;
const TILT = [-1.5, 1.2, -0.8, 1.5];

/** A 56px claim photo on a paper tag, labelled with its lane, with the gate's stamp under it. */
function SampleTag({ sample, tilt }: { sample: Sample; tilt: number }) {
  return (
    <Paper variant="tag" hole padding="none" tilt={tilt} className="w-32 [--tag-cut:12px]">
      <div className="flex items-end gap-2 px-2.5 pt-7">
        <Image src={sample.photo} alt="" width={56} height={56} className="size-14 shrink-0 rounded-[3px] object-cover" />
        <span className="font-mono text-micro leading-[1.15] tracking-[0.04em] text-ink-muted uppercase">
          {sample.lane}
        </span>
      </div>
      <div className="flex h-12 items-center justify-center">
        <Stamp tone={sample.tone} className={styles.stamp}>
          {sample.stamp}
        </Stamp>
      </div>
    </Paper>
  );
}

// On the page grid: the gate in columns 1 to 6 (its number hanging in the first 3rem), the four lanes in 7 to 12.
const GATE = "col-span-6 grid grid-cols-[3rem_minmax(0,1fr)]";
const LANES = "col-span-6 grid grid-cols-4";

/**
 * Fraud checks as a pipeline (laptops): five gates as hairlines across the page, each marked No AI or Model
 * reads, and the four demo claims falling down their lanes on scroll until the gate that stops them. Every resting state is in the markup; the drop only plays when motion is allowed.
 */
/**
 * Arms each lane separately: a lane's tag falls only once the gate that stops it is in view (its top above 70% of the
 * viewport), so the reader sees every drop, including the wrong code at gate 4 and the payout at the foot. Nothing is
 * armed without JS, under reduced motion, or when the pipeline is already on screen at load.
 */
function useLanes(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !root.offsetWidth || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (root.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    // Each tag falls from the top of its lane: measure how far before arming.
    const top = root.querySelector<HTMLElement>("[data-lanes-top]")?.getBoundingClientRect().bottom ?? 0;
    root.querySelectorAll<HTMLElement>("[data-tag]").forEach((tag) => {
      tag.style.setProperty("--fall", `${Math.round(top - tag.getBoundingClientRect().top - 24)}px`);
    });
    const cells = (lane: string) => root.querySelectorAll<HTMLElement>(`[data-lane="${lane}"]`);
    root.querySelectorAll<HTMLElement>("[data-lane]").forEach((el) => (el.dataset.go = "armed"));
    let next = 0;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const lane = (e.target as HTMLElement).dataset.stop!;
          io.unobserve(e.target);
          // Lanes that come into view together still fall one after another.
          const now = performance.now();
          next = Math.max(now, next + FALL_GAP);
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
      // Disarm, so a second run (React's StrictMode in dev, or a remount) measures the tags where they rest, not where
      // the armed state has lifted them.
      root.querySelectorAll<HTMLElement>("[data-lane]").forEach((el) => {
        delete el.dataset.go;
        el.style.removeProperty("--go-at");
      });
    };
  }, [ref]);
}

export function Pipeline() {
  const ref = useRef<HTMLDivElement>(null);
  useLanes(ref);
  const rows = [...GATES, null];

  return (
    <div ref={ref} className="relative hidden lg:block">
      <div className="grid-12" data-lanes-top>
        <span className={clsx(GATE, "micro pb-4 text-faint")}>Gate</span>
        <div className={LANES}>
          {SAMPLES.map((s) => (
            <span key={s.lane} className="micro pb-4 pl-3 text-faint">
              {s.lane}
            </span>
          ))}
        </div>
      </div>
      <ol className="relative">
        {rows.map((g, row) => {
          const bandStart = g !== null && row > 0 && g.ai !== GATES[row - 1].ai;
          return (
            <li key={row} className={clsx("grid-12 relative border-t", bandStart ? "border-line-2" : "border-line")}>
              {g === null ? (
                <div className={GATE}>
                  <div className="col-start-2 py-6 pr-12">
                    <h3 className="text-head-sm font-medium">Then a fixed rule decides.</h3>
                    <p className="mt-1 max-w-[52ch] text-ui text-muted">AI reads the photo. It never moves the money.</p>
                    <p className="mt-4 inline-block rounded-control bg-surface px-3 py-2 font-mono text-micro leading-relaxed text-text shadow-ring">{RULE}</p>
                  </div>
                </div>
              ) : (
                <div className={GATE}>
                  <span className="pt-6 font-mono text-ui text-faint">{String(row + 1).padStart(2, "0")}</span>
                  <div className="py-6 pr-12">
                    <h3 className="flex items-center gap-3 text-head-sm font-medium">
                      {g.title}
                      <span className="inline-flex h-6 items-center rounded-control px-2 font-mono text-micro tracking-[0.04em] whitespace-nowrap text-muted uppercase shadow-[inset_0_0_0_1px_var(--line-2)]">
                        {g.ai ? "Model reads" : "No AI"}
                      </span>
                    </h3>
                    <p className="mt-2 max-w-[56ch] text-ui text-muted">{g.text}</p>
                  </div>
                </div>
              )}
              <div className={LANES}>
                {SAMPLES.map((s, lane) => {
                  const stopsHere = s.stop === row;
                  const through = s.stop > row;
                  return (
                    <div key={s.lane} className={clsx(styles.lane, "relative pl-3")} data-lane={lane} data-stop={stopsHere ? lane : undefined}>
                      {(through || stopsHere) && (
                        <span
                          aria-hidden="true"
                          className={clsx(styles.trail, "absolute top-0 left-[calc(0.75rem+4rem)] w-0 border-l border-dashed border-line-strong", through ? "bottom-0" : "h-4")}
                          style={vars({ "--trail-at": `${Math.round((row / (s.stop + 1)) * FALL_FOR)}ms`, "--trail-for": `${Math.round(FALL_FOR / (s.stop + 1))}ms` })}
                        />
                      )}
                      {stopsHere && (
                        <div className="relative py-3" style={vars({ "--stamp-at": `${FALL_FOR}ms` })}>
                          <div data-tag className={clsx(styles.fall, "relative w-32")}>
                            <SampleTag sample={s} tilt={TILT[lane]} />
                          </div>
                          {s.note && (
                            <p aria-hidden="true" className={clsx(styles.note, "absolute top-[6.9375rem] right-full flex items-center gap-2 font-mono text-micro whitespace-nowrap text-stop")}>
                              {s.note}
                              <span className="h-px w-6 bg-stop/60" />
                            </p>
                          )}
                          <p className="sr-only">
                            {s.title}. {s.stamp} here: {s.reason}.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
      {/* The genuine claim, past every gate, becomes a payout tag beside it, in the lane to its left. */}
      <div aria-hidden="true" className={clsx(styles.lane, "pointer-events-none absolute right-[calc((50%-var(--col-gap)/2)/4+0.75rem)] bottom-8")} data-lane={3}>
        <div className={styles.fall} style={vars({ "--fall-at": `${FALL_FOR}ms`, "--fall": "-24px" })}>
          <Paper variant="tag" hole padding="none" tilt={-2} className="w-40 [--tag-cut:12px]">
            <div className="px-4 pt-9 pb-4">
              <p className="micro text-ink-muted">Refund</p>
              <p className="mt-1 text-head-sm font-medium text-ink">
                <Money value={29.99} />
              </p>
              <p className="mt-0.5 font-mono text-micro text-ink-muted">sent to PayPal</p>
            </div>
          </Paper>
        </div>
      </div>
    </div>
  );
}

/** Phones and tablets: the gates as a list, each demo claim as a row under the gate that stopped it. */
export function PipelineList() {
  const stoppedAt = (row: number) => SAMPLES.filter((s) => s.stop === row);
  const rows = (row: number, label: string) =>
    stoppedAt(row).length > 0 && (
      <ul className="mt-4 flex flex-col gap-3 sm:pl-12" aria-label={label}>
        {/* The same paper tags and stamps as the laptop pipeline, laid flat: no drop on phones. */}
        {stoppedAt(row).map((s, i) => (
          <Paper key={s.lane} as="li" variant="tag" padding="none" tilt={i % 2 ? 0.6 : -0.6} className="[--tag-cut:10px]">
            <div className="grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-x-3 p-3">
              <span className="flex flex-col gap-1">
                <Image src={s.photo} alt="" width={48} height={48} className="size-12 rounded-[3px] object-cover" />
                <span className="font-mono text-micro leading-[1.15] tracking-[0.04em] text-ink-muted uppercase">{s.lane}</span>
              </span>
              <span className="min-w-0">
                <span className="block text-ui font-medium text-ink">{s.title}</span>
                <span className="mt-1 block text-ui text-ink-muted">{s.reason}</span>
                <span className="sr-only">Outcome: {s.stamp}.</span>
                <Stamp tone={s.tone} rotate={-6} className="mt-3">
                  {s.stamp}
                </Stamp>
              </span>
            </div>
          </Paper>
        ))}
      </ul>
    );

  return (
    <ol className="flex flex-col lg:hidden">
      {GATES.map((g, i) => {
        const bandStart = i === 0 || g.ai !== GATES[i - 1].ai;
        return (
          <li key={g.title} className={clsx("border-t py-6", bandStart && i > 0 ? "border-line-2" : "border-line")}>
            {bandStart && <p className="micro mb-4 text-faint">{g.ai ? "Model reads" : "No AI"}</p>}
            <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2">
              <span className="pt-0.5 font-mono text-ui text-faint tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="text-body font-medium">{g.title}</h3>
                <p className="mt-1 text-ui text-muted">{g.text}</p>
              </div>
            </div>
            {rows(i, `Stopped at gate ${i + 1}`)}
          </li>
        );
      })}
      <li className="border-t border-line py-6">
        <h3 className="text-body font-medium">Then a fixed rule decides.</h3>
        <p className="mt-1 text-ui text-muted">AI reads the photo. It never moves the money.</p>
        <p className="mt-3 rounded-control bg-surface px-3 py-2 font-mono text-micro leading-relaxed shadow-ring">{RULE}</p>
        {rows(5, "Passed every gate")}
      </li>
    </ol>
  );
}
