export type PositionedText = {
  str: string;
  transform: ArrayLike<number>;
  width?: number;
};

const LINE_TOLERANCE = 3;

/** Place text items on the baseline where they are drawn, so filled form values stay with their blanks. */
export function layoutText(items: PositionedText[]): string {
  const placed = items
    .map((item) => ({
      str: item.str,
      x: Number(item.transform[4] ?? 0),
      y: Number(item.transform[5] ?? 0),
      width: Number(item.width ?? 0),
    }))
    .filter((item) => item.str.trim().length > 0)
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: Array<{ y: number; items: typeof placed }> = [];
  for (const item of placed) {
    const line = lines.at(-1);
    if (!line || line.y - item.y > LINE_TOLERANCE) lines.push({ y: item.y, items: [item] });
    else line.items.push(item);
  }

  return lines
    .map((line) => joinLine(line.items))
    .filter(Boolean)
    .join("\n");
}

function joinLine(items: Array<{ str: string; x: number; width: number }>): string {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let text = "";
  let cursor = Number.NEGATIVE_INFINITY;
  for (const item of sorted) {
    const gap = item.x - cursor;
    if (text && !text.endsWith(" ") && !item.str.startsWith(" ")) {
      text += gap > 48 ? "    " : " ";
    }
    text += item.str;
    cursor = Math.max(cursor, item.x + Math.max(item.width, item.str.length));
  }
  return text.replace(/[ \t]{2,}/g, (gap) => (gap.length >= 4 ? "    " : " ")).trim();
}
