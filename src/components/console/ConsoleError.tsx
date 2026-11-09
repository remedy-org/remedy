"use client";

import { Button, ErrorState } from "@/components/ui";

/** A console page that failed to load: what happened, that no money moved, and a retry. */
export function ConsoleError({ what, digest, retry }: { what: string; digest?: string; retry: () => void }) {
  return (
    <main className="page flex flex-1 flex-col py-8">
      <ErrorState
        className="mx-auto my-auto w-full max-w-read"
        title={`Remedy couldn't load ${what}`}
        description="The claim store didn't answer. Nothing was changed and no money moved: claims that arrive meanwhile are held, never lost. Try again in a moment."
        reference={digest}
        action={
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="sm" onClick={retry}>
              Try again
            </Button>
            <Button variant="tertiary" size="sm" href="/console">
              Back to claims
            </Button>
          </div>
        }
      />
    </main>
  );
}
