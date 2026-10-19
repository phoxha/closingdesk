export function findLooseSpan(text: string, needle: string): [number, number] | null {
  const target = needle.replace(/\s+/g, " ").trim().toLowerCase();
  if (target.length < 4) return null;
  const map: number[] = [];
  let collapsed = "";
  let lastWasSpace = true;
  for (let index = 0; index < text.length; index += 1) {
    if (/\s/.test(text[index] ?? "")) {
      if (!lastWasSpace && collapsed.length > 0) {
        collapsed += " ";
        map.push(index);
        lastWasSpace = true;
      }
      continue;
    }
    collapsed += (text[index] ?? "").toLowerCase();
    map.push(index);
    lastWasSpace = false;
  }
  const at = collapsed.indexOf(target);
  if (at < 0) return null;
  const start = map[at];
  const end = map[at + target.length - 1];
  if (start == null || end == null) return null;
  return [start, end + 1];
}

export function highlightSegments(text: string, needles: string[]): Array<{ text: string; hit: boolean }> {
  const spans: Array<[number, number]> = [];
  for (const needle of needles) {
    const candidates = [needle, needle.slice(0, 90)];
    for (const candidate of candidates) {
      const span = findLooseSpan(text, candidate);
      if (span) {
        spans.push(span);
        break;
      }
    }
  }
  if (spans.length === 0) return [{ text, hit: false }];
  spans.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (!last || span[0] > last[1]) merged.push(span);
    else last[1] = Math.max(last[1], span[1]);
  }
  const parts: Array<{ text: string; hit: boolean }> = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), hit: false });
    parts.push({ text: text.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
  return parts;
}
