import QRCode from "qrcode";

/** The claim link as a QR code: dark modules on a white tile in both themes, so any phone camera reads it. */
export async function ClaimQr({ url, name }: { url: string; name: string }) {
  const svg = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#14171cff", light: "#ffffffff" } });
  return (
    <figure className="flex flex-col items-start gap-3">
      <div className="rounded-card border border-line bg-[#ffffff] p-4">
        {/* Library-generated SVG from our own URL: no user markup reaches it. */}
        <div role="img" aria-label={`QR code for ${url}`} className="size-40 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      <a
        href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
        download={`remedy-${name}-qr.svg`}
        className="inline-flex min-h-11 items-center text-ui font-medium text-text underline underline-offset-4 hover:text-accent-text"
      >
        Download the QR code (SVG)
      </a>
    </figure>
  );
}
