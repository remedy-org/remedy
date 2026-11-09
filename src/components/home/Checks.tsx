import { Button } from "@/components/ui";
import { Pipeline, PipelineList } from "./Pipeline";
import { Section } from "./Section";

export function Checks() {
  return (
    <Section
      id="checks"
      exhibit="Fraud checks"
      title="A fake has to beat five checks."
      lead="Anyone can now generate a photo of a cut-up pillow. So the first three checks run before any AI: Remedy accepts photos only inside the claim’s own 10-minute camera session, refuses a reposted photo, and pays only verified PayPal accounts."
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
