import { Button } from "@/components/ui";
import { SANDBOX_ACCOUNTS_URL } from "@/components/claim/model";
import { Pipeline, PipelineList } from "./Pipeline";
import { Section } from "./Section";

export function Checks() {
  return (
    <Section
      id="checks"
      exhibit="B · What stops a fake"
      title="Five checks, in order."
      muted="The first three need no AI."
      lead="We don't claim the model can spot an AI image: in our tests, it couldn't. A fake has to beat the live camera, the fingerprint and a verified PayPal account before the model even looks."
    >
      <Pipeline />
      <PipelineList />
      <div className="mt-10 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-8 lg:mt-6">
        <Button href="/r/kikea-x-vesolje/try" variant="tertiary" size="lg">
          Try the four samples yourself
        </Button>
        <p className="font-mono text-micro text-faint">
          Needs a PayPal sandbox personal account ·{" "}
          <a
            href={SANDBOX_ACCOUNTS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="relative underline decoration-line-2 underline-offset-4 transition-colors duration-160 after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] hover:text-text"
          >
            How to make one
            <span aria-hidden="true">&nbsp;↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      </div>
    </Section>
  );
}
