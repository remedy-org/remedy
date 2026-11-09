import { ImportRecall } from "@/components/console/ImportRecall";
import { requireSession } from "@/lib/session";

// The nav's name for the page.
export const metadata = { title: "New recall" };

export default async function NewRecallPage() {
  const session = await requireSession("company", "/console/recalls/new");
  return (
    <main className="flex flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* The heading is the import's: it says the step it is on. The example is a recall not already in every workspace. */}
      <ImportRecall example="cpsc.gov/Recalls/… or 27-068" company={session.name} />
    </main>
  );
}
