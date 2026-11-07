"use client";

import { useMotionValue } from "motion/react";
import { OpenedExhibit } from "@/components/home/teardown";
import { ThemeToggle } from "@/components/ui";

export function DevExhibit({ capture, fillerClass }: { capture: boolean; fillerClass: string }) {
  const p = useMotionValue(0);
  if (capture)
    return (
      <div className="h-[100svh]">
        <OpenedExhibit progress={p} capture />
      </div>
    );
  return (
    <>
      <div className={fillerClass}>
        <p className="micro text-faint">Chain of Custody · chapters 01 and 02 end here</p>
        <div className="mt-6 flex justify-center">
          <ThemeToggle />
        </div>
      </div>
      <OpenedExhibit />
      <div className={fillerClass}>
        <p className="micro text-faint">The next section starts here</p>
      </div>
    </>
  );
}
