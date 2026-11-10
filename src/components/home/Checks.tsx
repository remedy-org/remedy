import { Button } from "@/components/ui";
import { Pipeline, PipelineList } from "./Pipeline";
import { Section } from "./Section";

export function Checks() {
  return (
    <Section
      id="checks"
      exhibit="Fraud checks"
      title="A fake has to beat five checks."
      lead="Three checks run before AI. Then the model reads the code and the destruction evidence. A fixed rule decides whether to pay, hold or refuse."
    >
      <Pipeline />
      <PipelineList />
      <div className="mt-10 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-8 lg:mt-6">
        {/* Starts on a fake: the web photo is picked once the visitor is logged in. */}
        <Button href="/r/kikea-x-vesolje/try?claim=web-photo" variant="tertiary" size="lg" data-try-cta="">
          Try to fool it
        </Button>
      </div>
    </Section>
  );
}
