import { ImportRecall } from "@/components/console/ImportRecall";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Import a recall" };

export default async function NewRecallPage() {
  await requireSession("company", "/console/recalls/new");
  return (
    <main className="flex flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="max-w-read">
        <h1 className="text-h2 font-medium">Import a recall from CPSC</h1>
        <p className="mt-2 text-body text-muted">
          Paste the notice. Remedy reads CPSC&apos;s record, drafts the photo checks from its text and photos, and you edit them before the claim page goes live.
        </p>
      </header>
      <ImportRecall example="cpsc.gov recall page or number, e.g. 27-071" />
    </main>
  );
}
