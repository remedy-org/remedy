import clsx from "clsx";
import { PhoneIcon } from "./icons";

export interface PhoneHandoffProps {
  /** QR code as an SVG string, made on the server (qrcode). */
  qrSvg: string;
  url: string;
  code: string;
  className?: string;
}

/** Continue the same claim on a phone: same code, same timer, same PayPal account. */
export function PhoneHandoff({ qrSvg, url, code, className }: PhoneHandoffProps) {
  return (
    <div className={clsx("flex flex-col gap-4 rounded-card border border-line p-4 sm:flex-row sm:items-center", className)}>
      {/* A white plate so any phone camera reads it, in either theme. */}
      <div className="size-32 shrink-0 self-center rounded-control bg-[oklch(1_0_0)] p-2.5 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qrSvg }} role="img" aria-label="QR code for this claim" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="flex items-center gap-2 text-ui font-medium text-text">
          <PhoneIcon className="shrink-0 text-muted" />
          Continue on your phone
        </p>
        <p className="text-ui text-muted">
          Scan with the phone&apos;s camera and log in with the same PayPal account. Your code stays <span className="font-mono text-text">{code}</span> and the timer keeps running.
        </p>
        <p className="truncate font-mono text-micro text-faint">{url.replace(/^https?:\/\//, "")}</p>
      </div>
    </div>
  );
}
