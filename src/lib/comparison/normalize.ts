const SMALL: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export function parseWordNumber(phrase: string): number | null {
  const tokens = phrase
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\band\b/g, " ")
    .split(/\s+/)
    .filter((token) => token && token !== "dollars" && token !== "dollar" && token !== "a");
  if (tokens.length === 0) return null;
  let total = 0;
  let current = 0;
  for (const token of tokens) {
    if (token in SMALL) {
      current += SMALL[token];
    } else if (token === "hundred") {
      current = (current === 0 ? 1 : current) * 100;
    } else if (token === "thousand") {
      total += (current === 0 ? 1 : current) * 1000;
      current = 0;
    } else if (token === "million") {
      total += (current === 0 ? 1 : current) * 1_000_000;
      current = 0;
    } else if (/^\d+$/.test(token)) {
      current += Number(token);
    } else {
      return null;
    }
  }
  return total + current;
}

export type MoneyParse =
  | { cents: number; kind: "amount" }
  | { cents: null; kind: "conflict" };

/** Read the first stated amount. A full word form and a dollar figure must agree. */
export function parseMoney(text: string): MoneyParse | null {
  const clip = clipClause(text).replace(/([A-Za-z])-([A-Za-z])/g, "$1 $2");
  const symbol = firstDollar(clip);
  const word = wordDollars(clip);
  if (word != null && symbol != null && Math.abs(word * 100 - symbol) > 100) {
    return { cents: null, kind: "conflict" };
  }
  const cents = symbol ?? (word != null ? word * 100 : null);
  if (cents == null) return null;
  return { cents, kind: "amount" };
}

function wordDollars(text: string): number | null {
  const marker = text.match(/\bdollars\b/i);
  if (!marker || marker.index == null) return null;
  const tokens = text.slice(0, marker.index).trim().split(/\s+/);
  const allowed = new Set([...Object.keys(SMALL), "hundred", "thousand", "million", "and", "a"]);
  const collected: string[] = [];
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
    if (!allowed.has(token)) break;
    collected.unshift(token);
  }
  if (!collected.some((token) => token in SMALL || /^\d+$/.test(token))) return null;
  return parseWordNumber(collected.join(" "));
}

function firstDollar(text: string): number | null {
  const match = text.match(/\$\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?/);
  if (!match) return null;
  const dollars = Number(match[1].replace(/,/g, ""));
  const cents = match[2] ? Number(match[2]) : 0;
  if (!Number.isFinite(dollars)) return null;
  return dollars * 100 + cents;
}

export function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

export function parseIsoDate(text: string): string | null {
  const clip = clipClause(text);
  const monthFirst = clip.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i,
  );
  if (monthFirst) {
    const month = MONTHS[monthFirst[1].toLowerCase()];
    return iso(Number(monthFirst[3]), month, Number(monthFirst[2]));
  }
  const numeric = clip.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (numeric) {
    return iso(Number(numeric[3]), Number(numeric[1]), Number(numeric[2]));
  }
  return null;
}

export function formatIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function iso(year: number, month: number, day: number): string | null {
  if (!month || month > 12 || day < 1 || day > 31 || year < 1900) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDayCount(text: string): number | null {
  const clip = clipClause(text);
  const paren = clip.match(/\b(?:[a-z]+)\s*\((\d{1,3})\)\s*(?:business\s+)?days?\b/i);
  if (paren) return Number(paren[1]);
  const numeric = clip.match(/\b(\d{1,3})\s*-?\s*(?:business\s+)?days?\b/i);
  if (numeric) return Number(numeric[1]);
  const word = clip.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|sixty)\b(?:\s*\(\d{1,3}\))?\s*-?\s*(?:business\s+)?days?\b/i,
  );
  if (word) return SMALL[word[1].toLowerCase()] ?? null;
  return null;
}

export function businessDays(text: string): boolean {
  return /business\s+days?/i.test(clipClause(text));
}

export function normName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(l\.?\s*l\.?\s*c\.?|llc)\b/g, "llc")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normAddress(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bmassachusetts\b/g, "ma")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bstreet\b/g, "st")
    .replace(/\broad\b/g, "rd")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\blane\b/g, "ln")
    .replace(/\bboulevard\b/g, "blvd")
    .replace(/\b[a-z]+\s+county\b/g, " ")
    .replace(/\b\d{5}(?:-\d{4})?\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normHolder(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(l\.?\s*l\.?\s*c\.?|llc|inc|incorporated|company|co)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function looseText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function containsLoose(haystack: string, needle: string): boolean {
  const cleaned = needle.replace(/\s+/g, " ").trim();
  if (cleaned.length < 8) return false;
  return haystack.replace(/\s+/g, " ").toLowerCase().includes(cleaned.toLowerCase());
}

/** Keep a labeled clause from running into the next labeled clause. */
export function clipClause(text: string): string {
  const next = text.slice(1).search(
    /\n+\s*(?=(?:property(?: address)?|parcel(?:\s+id)?|buyer|seller|purchase price|earnest money(?: deposit)?|deposit|financing|closing(?: date)?|inspection|due diligence|appraisal|property condition|included items|title(?: and deed)?|possession|special provisions|assignment|time|dates)\s*:)/i,
  );
  const end = next >= 0 ? next + 1 : text.length;
  return text.slice(0, Math.min(end, 500));
}

export function sameNormalized(left: string, right: string): "same" | "partial" | "conflict" {
  if (left === "UNCLEAR" || right === "UNCLEAR") return "partial";
  if (left === right) return "same";
  const leftFields = parseFields(left);
  const rightFields = parseFields(right);
  if (leftFields && rightFields) {
    const keys = new Set([...Object.keys(leftFields), ...Object.keys(rightFields)]);
    let partial = false;
    for (const key of keys) {
      const a = leftFields[key];
      const b = rightFields[key];
      if (a == null || b == null || a === "*" || b === "*") {
        partial = true;
        continue;
      }
      if (a !== b) return "conflict";
    }
    return partial ? "partial" : "same";
  }
  if (left.startsWith(`${right}:`) || right.startsWith(`${left}:`)) return "partial";
  return "conflict";
}

function parseFields(value: string): Record<string, string> | null {
  if (!value.includes(":")) return null;
  const fields: Record<string, string> = {};
  for (const part of value.split("|")) {
    const index = part.indexOf(":");
    if (index <= 0) return null;
    fields[part.slice(0, index)] = part.slice(index + 1);
  }
  return fields;
}
