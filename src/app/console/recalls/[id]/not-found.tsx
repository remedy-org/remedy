import { Button, EmptyState } from "@/components/ui";

export default function RecallNotFound() {
  return (
    <main className="page flex flex-1 flex-col py-8">
      <EmptyState
        className="my-auto"
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
