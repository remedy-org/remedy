import type { Metadata } from "next";
import { ConsoleHeader } from "@/components/console/ConsoleHeader";
import { ConsoleSkipLink } from "@/components/console/ConsoleSkipLink";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: { default: "Console", template: "%s · Remedy console" },
  robots: { index: false },
};

// Every page here calls requireSession itself, with its own path as `next`; the layout only reads who is signed in.
export default async function ConsoleLayout({ children }: LayoutProps<"/console">) {
  const session = await getSession("company");
  return (
    <div className="flex min-h-dvh flex-col">
      <ConsoleSkipLink />
      <ConsoleHeader session={session} />
      <div id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </div>
    </div>
  );
}
