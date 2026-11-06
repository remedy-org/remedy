"use client";

import { ConsoleError } from "@/components/console/ConsoleError";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ConsoleError what="this page" digest={error.digest} retry={retry} />;
}
