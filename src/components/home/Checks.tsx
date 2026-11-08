import { Button } from "@/components/ui";
import { Pipeline, PipelineList } from "./Pipeline";
import { Section } from "./Section";

export function Checks() {
  return (
    <Section
      id="checks"
      exhibit="Fraud checks"
      title="A fake has to beat five checks."
      muted="The first three run before any AI."
      lead="Anyone can now generate a photo of a cut-up pillow. So Remedy takes photos only from the claim's own live camera, refuses any photo it has seen before, and pays only verified PayPal accounts."
    >
      <Pipeline />
      <PipelineList />
      <div className="mt-10 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-8 lg:mt-6">
        {/* Starts on a fake: the web photo is picked once the visitor is logged in. */}
        <Button href="/r/kikea-x-vesolje/try?sample=ai-no-session" variant="tertiary" size="lg" data-try-cta="">
          Try to fool it
        </Button>
      </div>
    </Section>
  );
}
