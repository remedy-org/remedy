"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { homeRowsFor, homeShowsRefusals } from "./report";

/**
 * The still's refusal reasons, shown exactly when the tour's Studio will list them at this frame's height (report.ts
 * homeShowsRefusals), so the handover to Studio never reflows the right column. Until it has measured (the server's
 * render), a size query on the still stands in.
 */
export function StillRefusals({ reasons, children }: { reasons: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState<boolean | null>(null);
  useLayoutEffect(() => {
    const body = ref.current?.closest("[data-still]")?.parentElement;
    if (!body) return;
    const measure = () => body.clientHeight > 0 && setShow(homeShowsRefusals(homeRowsFor(body.clientHeight), reasons));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    return () => ro.disconnect();
  }, [reasons]);
  return (
    <div ref={ref} className={show === null ? "contents [@container(max-height:619px)]:hidden" : show ? "contents" : "hidden"}>
      {children}
    </div>
  );
}
