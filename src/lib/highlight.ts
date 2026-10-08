import { HIT_CLOSE, HIT_OPEN } from "@/lib/db/queries";

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Render a search snippet as HTML with the matched terms marked.
 *
 * The text originates in a PDF the newsroom supplies, and FTS5's snippet()
 * does not escape what it returns. So the whole string is escaped first, and
 * only then are the control-character markers FTS5 inserted turned into
 * <mark>. Nothing carried in from the PDF can become a tag that way. The
 * markers themselves are stripped out of the text at extraction time, so a
 * crafted PDF cannot smuggle one in and open a tag of its own.
 */
export function highlightSnippet(snippet: string): string {
  return snippet
    .replace(/[&<>"']/g, (c) => ESCAPES[c])
    .replaceAll(HIT_OPEN, "<mark>")
    .replaceAll(HIT_CLOSE, "</mark>");
}
