import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Every SVG we serve must be well-formed XML: a browser shows nothing at all for an SVG that fails to parse (the
// favicon once did, over a "--" inside a comment). A small checker, since the repo has no XML parser.

function svgs(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return svgs(path);
    return name.endsWith(".svg") ? [path] : [];
  });
}

/** Returns the first well-formedness error, or null. */
function xmlError(src: string): string | null {
  const stack: string[] = [];
  let i = 0;
  let roots = 0;
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt < 0) break;
    if (src.startsWith("<!--", lt)) {
      const end = src.indexOf("-->", lt + 4);
      if (end < 0) return "unclosed comment";
      const body = src.slice(lt + 4, end);
      if (body.includes("--") || body.endsWith("-")) return "double hyphen within comment";
      i = end + 3;
      continue;
    }
    if (src.startsWith("<?", lt)) {
      const end = src.indexOf("?>", lt);
      if (end < 0) return "unclosed processing instruction";
      i = end + 2;
      continue;
    }
    if (src.startsWith("<![CDATA[", lt)) {
      const end = src.indexOf("]]>", lt);
      if (end < 0) return "unclosed CDATA";
      i = end + 3;
      continue;
    }
    const gt = src.indexOf(">", lt);
    if (gt < 0) return "unclosed tag";
    const tag = src.slice(lt + 1, gt);
    if (tag.startsWith("/")) {
      const name = tag.slice(1).trim();
      if (stack.pop() !== name) return `mismatched </${name}>`;
    } else {
      const m = /^([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)$/.exec(tag);
      if (!m) return `malformed tag <${tag.slice(0, 40)}>`;
      if (stack.length === 0) roots++;
      if (!m[3]) stack.push(m[1]);
    }
    i = gt + 1;
  }
  if (stack.length) return `unclosed <${stack.at(-1)}>`;
  if (roots !== 1) return `expected one root element, found ${roots}`;
  return null;
}

describe("served SVGs", () => {
  const files = [...svgs("src/app"), ...svgs("public")];
  it("finds the favicon", () => expect(files.some((f) => f.endsWith("icon.svg"))).toBe(true));
  it.each(files)("%s is well-formed XML", (file) => expect(xmlError(readFileSync(file, "utf8"))).toBeNull());
  it("catches the favicon's old bug", () => expect(xmlError('<svg><!-- the dark --bg --></svg>')).toMatch(/double hyphen/));
});
