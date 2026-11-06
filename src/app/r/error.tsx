"use client";

import { Button, ErrorState } from "@/components/ui";
import { FlowShell } from "@/components/claim/FlowShell";

// Anything that throws while a claim page renders: the store or PayPal down. The claim itself is saved.
export default function ClaimError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <FlowShell>
      <ErrorState
        title="This page didn't load"
        description="Something on our side didn't answer. Any claim you started is saved, and photos already sent are still being checked. Try again in a moment."
        action={
          <Button variant="secondary" onClick={() => reset()}>
            Try again
          </Button>
        }
        className="bg-surface"
      />
    </FlowShell>
  );
}
