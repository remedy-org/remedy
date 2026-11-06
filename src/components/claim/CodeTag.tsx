import { ExhibitLabel } from "@/components/ui";

// A paper evidence tag with the code hand-lettered on it: what the owner should end up holding.
// Paper and ink are fixed colours in both themes, like the real thing.
const PAPER = "oklch(0.95 0.012 85)";
const INK = "oklch(0.24 0.02 255)";

export function CodeTag({ code, label }: { code: string; label?: string }) {
  return (
    <figure className="flex flex-col items-center gap-3" aria-label={`Your code: ${code.split("").join(" ")}`}>
      <div className="relative w-full max-w-72">
        <svg viewBox="0 0 288 136" className="block w-full" role="img" aria-hidden="true">
          {/* string */}
          <path d="M2 40c18 4 26 18 44 22" fill="none" stroke="var(--faint)" strokeWidth="1.5" strokeLinecap="round" />
          {/* tag: a card with a clipped left end and a reinforced hole */}
          <path d="M60 8h212a8 8 0 0 1 8 8v104a8 8 0 0 1-8 8H60L32 100V36z" fill={PAPER} />
          <circle cx="56" cy="68" r="9" fill="none" stroke="oklch(0.8 0.02 85)" strokeWidth="5" />
          <circle cx="56" cy="68" r="5" fill="var(--surface)" />
          {label && (
            <text x="176" y="44" textAnchor="middle" fill={INK} opacity="0.7" style={{ font: "500 13px var(--font-mono)", letterSpacing: "0.08em" }}>
              {label}
            </text>
          )}
          <text
            x="176"
            y={label ? 98 : 84}
            textAnchor="middle"
            fill={INK}
            style={{ font: "600 52px var(--font-mono)", letterSpacing: "0.12em" }}
          >
            {code}
          </text>
        </svg>
      </div>
      <figcaption>
        <ExhibitLabel leader="left" leaderLength={24}>
          Exhibit · one-time code
        </ExhibitLabel>
      </figcaption>
    </figure>
  );
}
