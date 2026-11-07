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

/**
 * The model's quoted evidence, inside the page's own curly quotes: a quoted code drops its straight quotes and is set in
 * mono (K7O beside K7Q), and any other straight quotes become single curly ones, so nothing reads as raw output.
 */
export function ModelQuote({ children }: { children: string }) {
  return (
    <>
      {children.split(QUOTED_CODE).map((part, i) =>
        i % 2 ? (
          <span key={i} className="font-mono">
            {part}
          </span>
        ) : (
          part.replace(/"([^"]*)"/g, "‘$1’").replace(/"/g, "’")
        ),
      )}
    </>
  );
}
