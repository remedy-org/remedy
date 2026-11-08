"use client";

import { useEffect, useRef, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui";

type SubmitButtonProps = Extract<ButtonProps, { href?: undefined }>;

/**
 * The submit button of a plain form post (a route handler that files a claim and redirects to its page): the current
 * screen stays until the next one is ready, so the tapped button says it's on its way. Its label stays, it quietens to
 * 60% and is aria-busy, and a second tap doesn't post twice. A return from the back/forward cache clears it.
 */
export function SubmitButton(props: SubmitButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const submit = (e: SubmitEvent) => {
      if (busy.current) {
        e.preventDefault();
        return;
      }
      // After the event: a form a script handles itself (preventDefault) isn't on its way anywhere.
      setTimeout(() => {
        if (e.defaultPrevented) return;
        busy.current = true;
        setPending(true);
      });
    };
    const reset = () => {
      busy.current = false;
      setPending(false);
    };
    form.addEventListener("submit", submit);
    window.addEventListener("pageshow", reset);
    return () => {
      form.removeEventListener("submit", submit);
      window.removeEventListener("pageshow", reset);
    };
  }, []);
  return <Button {...props} ref={ref} type="submit" aria-busy={pending || undefined} data-pending={pending ? "" : undefined} />;
}
