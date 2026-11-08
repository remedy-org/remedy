import { notFound } from "next/navigation";

export const metadata = { title: "Not found" };

// Any /console path no page matches: the console's own not-found, inside its layout.
export default function Missing() {
  notFound();
}
