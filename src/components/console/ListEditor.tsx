"use client";

import { useId } from "react";
import { CrossIcon, Textarea } from "@/components/ui";

export interface ListEditorProps {
  legend: string;
  help?: string;
  items: string[];
  onChange: (items: string[]) => void;
  addLabel: string;
  // Fewest items allowed (proof steps need one).
  min?: number;
  max?: number;
  errors?: Record<number, string>;
  placeholder?: string;
}

/** An editable, numbered list of short lines: the labels a photo must show, or the proof steps. */
export function ListEditor({ legend, help, items, onChange, addLabel, min = 0, max = 8, errors = {}, placeholder }: ListEditorProps) {
  const id = useId();
  const set = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)));
  return (
    <fieldset className="flex flex-col gap-3" aria-describedby={help ? `${id}-help` : undefined}>
      <legend className="mb-2 text-ui font-medium text-text">{legend}</legend>
      {help && (
        <p id={`${id}-help`} className="text-ui text-muted">
          {help}
        </p>
      )}
      {items.length === 0 && <p className="rounded-control border border-dashed border-line-strong px-4 py-3 text-ui text-muted">None. The product is matched on its look.</p>}
      <ol className="flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={i} className="flex flex-col gap-1">
            <div className="flex items-start gap-2">
              <span className="mt-3 w-5 shrink-0 text-ui text-faint tabular-nums" aria-hidden="true">
                {i + 1}.
              </span>
              <Textarea
                rows={2}
                value={item}
                invalid={Boolean(errors[i])}
                placeholder={placeholder}
                aria-label={`${legend}, item ${i + 1}`}
                onChange={(e) => set(i, e.target.value)}
                className="min-h-11 flex-1 resize-y field-sizing-content"
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                disabled={items.length <= min}
                aria-label={`Remove item ${i + 1}`}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-text disabled:pointer-events-none disabled:opacity-40"
              >
                <CrossIcon />
              </button>
            </div>
            {errors[i] && <p className="pl-7 text-ui text-stop">{errors[i]}</p>}
          </li>
        ))}
      </ol>
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, ""])} className="inline-flex min-h-11 items-center self-start text-ui font-medium text-text underline-offset-4 hover:text-accent-text hover:underline">
          + {addLabel}
        </button>
      )}
    </fieldset>
  );
}
