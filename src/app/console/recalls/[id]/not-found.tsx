import { Button, EmptyState } from "@/components/ui";

export default function RecallNotFound() {
  return (
    <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
      <EmptyState
        className="my-auto"
        eyebrow="Not found"
        title="No recall with that number in your workspace"
        description="It may belong to another company, or it was never imported. Your recalls are listed on the claims page."
        action={
          <Button href="/console" variant="secondary">
            Back to claims
          </Button>
        }
      />
    </main>
  );
}
