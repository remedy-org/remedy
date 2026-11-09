import { Button } from "@/components/ui";

/** A console URL nothing matches, or a recall that isn't in this workspace: said inside the console, with its header,
 * so a company is never dropped onto the claim site's page. */
export default function ConsoleNotFound() {
  return (
    <main className="page flex flex-1 flex-col py-8">
      <h1 className="text-h2 font-medium">Nothing at this address</h1>
      <p className="mt-1.5 max-w-read text-ui text-muted">The link may be mistyped, or the recall is not in this workspace.</p>
      <div className="mt-6">
        <Button href="/console">Back to claims</Button>
      </div>
    </main>
  );
}
