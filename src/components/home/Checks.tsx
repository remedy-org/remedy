import { Button } from "@/components/ui";
import { Pipeline, PipelineList } from "./Pipeline";
import { Section } from "./Section";
import { TryNote } from "./TryNote";

export function Checks() {
  return (
    <Section
      id="checks"
      exhibit="Fraud checks"
      title="Five checks, in order."
      muted="The first three need no AI."
      lead="We don't claim the model can spot an AI image: in our tests, it couldn't. A fake has to beat the live camera, the fingerprint and a verified PayPal account before the model even looks."
    >
      <Pipeline />
      <PipelineList />
      <div className="mt-10 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-8 lg:mt-6">
        <Button href="/r/kikea-x-vesolje/try" variant="tertiary" size="lg" data-try-cta="">
          Try the four samples yourself
        </Button>
        <TryNote />
      </div>
    </Section>
  );
}
