"use client";

import clsx from "clsx";

export interface SwitchProps {
  checked: boolean;
  onChange: (on: boolean) => void;
  id?: string;
  disabled?: boolean;
  "aria-describedby"?: string;
}

/** An on/off switch with a 44px hit area. Pair it with a visible label (htmlFor = id). */
export function Switch({ checked, onChange, id, disabled, ...aria }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      {...aria}
      className="group inline-flex min-h-11 shrink-0 items-center rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
    >
      <span className={clsx("relative h-6 w-10 rounded-full border transition-colors", checked ? "border-pay bg-pay-soft" : "border-line-strong bg-surface-2")}>
        <span
          aria-hidden="true"
          className={clsx("absolute top-1/2 size-4 -translate-y-1/2 rounded-full transition-[left,background-color] duration-160 ease-snap", checked ? "left-5 bg-pay" : "left-1 bg-muted")}
        />
      </span>
      <span className="ml-3 text-ui font-medium text-text">{checked ? "On" : "Off"}</span>
    </button>
  );
}
