import type { DocPage } from "@/lib/types";

export type Located = {
  quote: string;
  page: number | null;
  section: string | null;
  window: string;
};

export function documentText(pages: DocPage[]): string {
  return pages.map((page) => page.text).join("\n");
}

export function textLength(pages: DocPage[]): number {
  return documentText(pages).trim().length;
}

export function findLabel(pages: DocPage[], pattern: RegExp): Located | null {
  const spans: Array<{ start: number; end: number; page: number }> = [];
  let text = "";
  for (const page of pages) {
    const start = text.length;
    text += page.text;
    if (!text.endsWith("\n")) text += "\n";
    spans.push({ start, end: text.length, page: page.page });
  }
  const flags = pattern.flags.includes("i") ? "i" : "";
  const match = new RegExp(pattern.source, flags).exec(text);
  if (!match || match.index === undefined) return null;
  const index = match.index + (match[0].match(/^\s*/)?.[0].length ?? 0);
  const quote = quoteAt(text, index);
  const span = spans.find((item) => index >= item.start && index < item.end);
  return {
    quote,
    page: span?.page ?? null,
    section: headingBefore(text, index) ?? labelFrom(quote),
    window: text.slice(index, index + 420),
  };
}

const NEXT_LABEL =
  /(?:^|[\n.])\s*(?:Property(?: Address)?|Parcel(?: ID)?|Buyer|Seller|Purchase Price|Earnest Money(?: Deposit)?|Deposit|Financing|Closing Date|Closing|Inspection|Due Diligence|Appraisal|Property Condition|Included Items|Title(?: and Deed)?|Possession|Special Provisions|Assignment|Time|Dates)\s*:/i;

function quoteAt(text: string, index: number): string {
  const previousBlank = text.lastIndexOf("\n\n", Math.max(0, index - 1));
  const lineStart = text.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
  const start = previousBlank >= 0 && index - previousBlank < 500 ? previousBlank + 2 : lineStart;
  const nextBlank = text.indexOf("\n\n", index);
  const end = nextBlank >= 0 ? nextBlank : Math.min(text.length, index + 360);
  const window = text.slice(start, end);
  const fromMatch = Math.max(0, index - start);
  const next = window.slice(fromMatch + 12).search(NEXT_LABEL);
  const cut = next >= 0 ? fromMatch + 12 + next : window.length;
  return window
    .slice(0, cut)
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, 500);
}

function headingBefore(text: string, index: number): string | null {
  const lines = text.slice(Math.max(0, index - 400), index).split(/\n/).map((line) => line.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0 && i >= lines.length - 6; i -= 1) {
    const line = lines[i];
    if (isHeading(line)) return line.slice(0, 120);
  }
  return null;
}

function isHeading(line: string): boolean {
  if (line.length < 4 || line.length > 80) return false;
  if (/:\s*\S/.test(line)) return false;
  if (/^\d+(?:\.\d+)*\s+[A-Z]/.test(line)) return true;
  const letters = line.replace(/[^A-Za-z]/g, "");
  return letters.length > 3 && letters === letters.toUpperCase();
}

function labelFrom(quote: string): string | null {
  const match = quote.match(/^([^:]{3,48}):/);
  return match ? match[1].trim() : null;
}

export function captureAfterColon(window: string): string {
  const line = (window.split(/\n/)[0] ?? window).trim();
  const colon = line.indexOf(":");
  let after = (colon >= 0 ? line.slice(colon + 1) : line).trim();
  const stop = after.search(/^\s*To:\s|\s+To:\s|\s+Name\(s\):\s|\s+Address:\s/i);
  if (stop >= 0) after = after.slice(0, stop).trim();
  return after.replace(/\.$/, "").trim();
}
