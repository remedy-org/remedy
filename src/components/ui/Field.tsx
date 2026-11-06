import clsx from "clsx";
import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

const control =
  "w-full rounded-control border bg-surface px-3 text-body text-text placeholder:text-faint " +
  "transition-[border-color,box-shadow] duration-160 ease-snap " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:cursor-not-allowed disabled:opacity-40";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** Mono type for codes, amounts and ids. */
  mono?: boolean;
}

/** 44px text input with a 1px line border. Use inside Field for the label, help and error. */
export function Input({ invalid, mono, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={clsx(control, "h-11", invalid ? "border-stop" : "border-line-strong", mono && "font-mono tabular-nums", className)}
      {...rest}
    />
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  mono?: boolean;
}

export function Textarea({ invalid, mono, className, rows = 4, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={clsx(control, "py-2.5", invalid ? "border-stop" : "border-line-strong", mono && "font-mono", className)}
      {...rest}
    />
  );
}

export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  invalid: boolean;
}

export interface FieldProps extends Omit<InputProps, "id" | "invalid" | "children"> {
  label: ReactNode;
  /** Muted line under the control. */
  help?: ReactNode;
  /** What is wrong and how to fix it. Replaces nothing: help stays visible. */
  error?: ReactNode;
  /** Small muted text after the label, e.g. "Optional". */
  hint?: ReactNode;
  id?: string;
  /** Custom control (Textarea, select). Receives the id and aria wiring; defaults to an Input with the other props. */
  children?: (control: FieldControlProps) => ReactNode;
  className?: string;
}

/** Label above, control, help below in muted, error in stop. */
export function Field({ label, help, error, hint, id, children, className, ...input }: FieldProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  const helpId = help ? `${fieldId}-help` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(" ") || undefined;
  const wiring: FieldControlProps = { id: fieldId, "aria-describedby": describedBy, invalid: Boolean(error) };

  return (
    <div className={clsx("flex flex-col gap-2", className)}>
      <label htmlFor={fieldId} className="flex items-baseline justify-between gap-3 text-ui font-medium text-text">
        <span>{label}</span>
        {hint && <span className="font-normal text-faint">{hint}</span>}
      </label>
      {children ? children(wiring) : <Input {...input} {...wiring} />}
      {error && (
        <p id={errorId} className="text-ui text-stop">
          {error}
        </p>
      )}
      {help && (
        <p id={helpId} className="text-ui text-muted">
          {help}
        </p>
      )}
    </div>
  );
}
