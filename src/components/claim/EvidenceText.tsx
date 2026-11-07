// Codes, claim ids and quoted text from the photos set in mono, so K7O and K7Q never look alike.
const TOKEN = /(\b[A-Z][0-9][A-Z]\b|\bRM-\d{4}\b|"[^"]+")/g;

export function EvidenceText({ children }: { children: string }) {
  return (
    <>
      {children.split(TOKEN).map((part, i) =>
        i % 2 ? (
          <span key={i} className="font-mono">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

// In the model's own words: a short code-like token in straight quotes ("K7O", "0").
const QUOTED_CODE = /"([A-Z0-9]{1,6})"/g;
// Unquoted: a code (K7O, K70) or a lone zero ("could also be 0"). Mono's slashed zero keeps 0 apart from O.
const BARE_CODE = /\b([A-Z][0-9][A-Z0-9]|0)\b/g;

const mono = (part: string, key: string) => (
  <span key={key} className="font-mono">
    {part}
  </span>
);

/**
 * The model's quoted evidence, inside the page's own curly quotes, word for word: a code drops its straight quotes and is
 * set in mono (K7O beside K7Q, a slashed 0), and any other straight quotes become single curly ones, so nothing reads as
 * raw output.
 */
export function ModelQuote({ children }: { children: string }) {
  return (
    <>
      {children.split(QUOTED_CODE).map((part, i) =>
        i % 2
          ? mono(part, String(i))
          : part
              .replace(/"([^"]*)"/g, "‘$1’")
              .replace(/"/g, "’")
              .split(BARE_CODE)
              .map((bit, j) => (j % 2 ? mono(bit, `${i}.${j}`) : bit)),
      )}
    </>
  );
}
