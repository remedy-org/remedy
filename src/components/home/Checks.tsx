import clsx from "clsx";
import Image from "next/image";
import { Button, StatusPill, type Status } from "@/components/ui";
import { SANDBOX_ACCOUNTS_URL } from "@/components/claim/model";
import { Section } from "./Section";

// The checks in the order they run (src/lib/rule.ts): preCheck's three need no model; then the model describes and a
// fixed rule decides.
const CHECKS: { title: string; text: string; ai: boolean }[] = [
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

// The judges' four demo samples (src/lib/demo/samples.ts) and the reason the rule gives for each.
const SAMPLES: { photo: string; title: string; status: Status; check: string; reason: string }[] = [
  { photo: "/demo/c02-1.jpg", title: "A genuine claim", status: "paid", check: "Passed all five checks", reason: "$29.99 sent to the owner's PayPal account" },
  { photo: "/demo/c08-1.jpg", title: "An AI image, sent in", status: "blocked", check: "Stopped at check 1", reason: "This photo wasn't taken in this claim's camera session" },
  { photo: "/demo/c02-1.jpg", title: "The same photo, reposted", status: "blocked", check: "Stopped at check 2", reason: "Photo 1 was already used in another claim" },
  { photo: "/demo/c11-1.jpg", title: "The wrong code", status: "rejected", check: "Rejected at check 4", reason: "Written code reads K7Q; this claim's code is K7P" },
];

export function Checks() {
  return (
    <Section
      id="checks"
      exhibit="C · What stops a fake"
      title="Five checks, in order."
      muted="The first three need no AI."
      lead="We don't claim the model can spot an AI image: in our tests, it couldn't. A fake has to beat the live camera, the fingerprint and a verified PayPal account before the model even looks."
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
        <ol className="flex flex-col">
          {CHECKS.map((c, i) => (
            <li key={c.title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 border-t border-line py-6 sm:grid-cols-[3rem_minmax(0,1fr)_auto]">
              <span className="font-mono text-ui text-faint tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="text-body font-semibold">{c.title}</h3>
                <p className="mt-1 max-w-[60ch] text-ui text-muted">{c.text}</p>
              </div>
              <span
                className={clsx(
                  "micro col-start-2 mt-3 self-start justify-self-start rounded-control border px-2 py-1 sm:col-start-3 sm:mt-0",
                  c.ai ? "border-line-strong text-text" : "border-line text-muted",
                )}
              >
                {c.ai ? "Model reads" : "No AI"}
              </span>
            </li>
          ))}
          <li className="border-t border-line pt-6">
            <p className="max-w-[60ch] pl-14 text-ui text-muted sm:pl-16">
              <span className="font-medium text-text">Then a fixed rule decides.</span> The model only describes what it sees. Any &ldquo;no&rdquo; rejects, any
              &ldquo;unclear&rdquo; holds the claim for a person, and the model never moves money.
            </p>
          </li>
        </ol>

        <div className="self-start rounded-card border border-line bg-surface">
          <div className="border-b border-line px-6 py-4">
            <h3 className="text-ui font-medium">Four claims a judge can run</h3>
            <p className="mt-1 text-ui text-muted">Same pipeline, sample photos, sandbox money.</p>
            <p className="mt-1 text-ui text-faint">
              Needs a PayPal sandbox personal account.{" "}
              <a href={SANDBOX_ACCOUNTS_URL} className="underline underline-offset-4 transition-colors duration-160 hover:text-text">
                How to make one
              </a>
            </p>
          </div>
          <ul>
            {SAMPLES.map((s) => (
              <li key={s.title} className="flex gap-4 border-b border-line px-6 py-4 last:border-b-0">
                <Image src={s.photo} alt="" width={44} height={44} loading="eager" className="size-11 shrink-0 rounded-control border border-line object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 text-ui font-medium text-pretty">{s.title}</span>
                    <StatusPill status={s.status} />
                  </div>
                  <p className="mt-1 text-ui text-muted">{s.reason}</p>
                  <p className="micro mt-2 text-faint">{s.check}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-6 py-4">
            <Button href="/r/kikea-x-vesolje/try" variant="tertiary">
              Run them yourself
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
