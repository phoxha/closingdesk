import {
  businessDays,
  formatIsoDate,
  formatMoney,
  looseText,
  normAddress,
  normHolder,
  normName,
  parseDayCount,
  parseIsoDate,
  parseMoney,
  sameNormalized,
} from "@/lib/comparison/normalize";
import { captureAfterColon, findLabel, textLength, type Located } from "@/lib/comparison/text";
import type {
  Category,
  CompareResult,
  CompareSummary,
  FindingDraft,
  FindingStatus,
  Severity,
  SourceDoc,
} from "@/lib/types";

type Hit = {
  documentId: string;
  normalized: string;
  display: string;
  quote: string;
  page: number | null;
  section: string | null;
  confidence: number;
};

type Spec = {
  id: string;
  category: Category;
  title: string;
  core: boolean;
  weight: "high" | "medium";
  /** A negative statement, such as "not a contingency", is not marked missing when the other document is silent. */
  askOnSilence: boolean;
  find: (doc: SourceDoc) => Hit | null;
};

const INCLUDED = ["refrigerator", "washer", "dryer", "stove", "oven", "dishwasher", "microwave", "freezer"];

function fromLabel(
  doc: SourceDoc,
  pattern: RegExp,
  interpret: (located: Located) => { normalized: string; display: string; confidence: number } | null,
): Hit | null {
  const located = findLabel(doc.pages, pattern);
  if (!located) return null;
  const read = interpret(located);
  if (!read) return null;
  return {
    documentId: doc.documentId,
    quote: located.quote,
    page: located.page,
    section: located.section,
    ...read,
  };
}

function unclearHit(display: string): { normalized: string; display: string; confidence: number } {
  return { normalized: "UNCLEAR", display, confidence: 0.45 };
}

const SPECS: Spec[] = [
  {
    id: "property_address",
    category: "property",
    title: "Property address",
    core: true,
    weight: "high",
    askOnSilence: false,
    find: (doc) =>
      fromLabel(doc, /property(?: address)?\s*:|real property described as|bounded and described premises\s*:/i, (located) => {
        const described = located.window.match(/(?:real property described as|bounded and described premises)\s*:?\s+([^\n]+)/i);
        const address = (described?.[1] ?? captureAfterColon(located.window))
          .split(/parcel|together with|with all the|and more particularly|being all of/i)[0]
          ?.replace(/[,\s]+$/, "")
          .trim() ?? "";
        if (address.length < 8) return unclearHit("A property label is present, but the address could not be read.");
        return { normalized: normAddress(address), display: address, confidence: 0.9 };
      }),
  },
  {
    id: "parcel",
    category: "property",
    title: "Parcel",
    core: false,
    weight: "high",
    askOnSilence: false,
    find: (doc) =>
      fromLabel(doc, /parcel(?:\s+id)?\s*:/i, (located) => {
        const number = located.window.match(/([0-9]{5,})/);
        if (!number) return unclearHit("A parcel label is present, but the identifier could not be read.");
        return { normalized: `parcel:${number[1]}`, display: number[1], confidence: 0.9 };
      }),
  },
  partySpec("buyer", "Buyer"),
  partySpec("seller", "Seller"),
  {
    id: "purchase_price",
    category: "purchase_price",
    title: "Purchase price",
    core: true,
    weight: "high",
    askOnSilence: false,
    find: (doc) =>
      fromLabel(doc, /purchase price\s*:|\bprice\s*\$/i, (located) => {
        const money = parseMoney(located.window);
        if (!money) return unclearHit("Purchase price is mentioned, but no amount could be read.");
        if (money.kind === "conflict") {
          return unclearHit("The purchase price states amounts that do not agree.");
        }
        return { normalized: `cents:${money.cents}`, display: formatMoney(money.cents), confidence: 0.94 };
      }),
  },
  {
    id: "earnest_deposit",
    category: "deposits",
    title: "Earnest money",
    core: true,
    weight: "high",
    askOnSilence: false,
    find: (doc) =>
      fromLabel(doc, /earnest money deposit\s*:|\bdeposit\s*:|\bdeposit\s*\$\s*[\d,]+(?:\.\d{2})?|\$\s*[\d,]+(?:\.\d{2})?\s+as a deposit to bind/i, (located) => {
        const money = parseMoney(located.window);
        if (!money || money.kind === "conflict" || money.cents == null) {
          return unclearHit("A deposit is mentioned, but the amount could not be read.");
        }
        const days = parseDayCount(located.window);
        const holderMatch = located.window.match(/held by\s+([^.;\n]+)/i);
        const holder = holderMatch?.[1]?.trim() ?? "";
        const fields = [`cents:${money.cents}`];
        if (days != null) fields.push(`days:${days}`, `business:${businessDays(located.window) ? "yes" : "no"}`);
        else fields.push("days:*", "business:*");
        fields.push(`holder:${holder ? normHolder(holder) : "*"}`);
        const bits = [formatMoney(money.cents)];
        if (days != null) bits.push(`due within ${days} ${businessDays(located.window) ? "business " : ""}day${days === 1 ? "" : "s"}`);
        if (holder) bits.push(`held by ${holder.replace(/\.$/, "")}`);
        return { normalized: fields.join("|"), display: bits.join(", "), confidence: holder && days != null ? 0.9 : 0.62 };
      }),
  },
  {
    id: "financing",
    category: "financing",
    title: "Financing",
    core: true,
    weight: "high",
    askOnSilence: false,
    find: (doc) =>
      fromLabel(doc, /financing\s*:/i, (located) => {
        const kind = classifyFinancing(located.window);
        if (kind === "cash") {
          return { normalized: "kind:cash", display: "Cash, with no mortgage contingency", confidence: 0.9 };
        }
        if (kind === "financed") {
          const days = parseDayCount(located.window);
          return {
            normalized: days != null ? `kind:financed|days:${days}` : "kind:financed|days:*",
            display: days
              ? `Financed, with a mortgage contingency of ${days} days`
              : "Financed, with a mortgage contingency",
            confidence: 0.88,
          };
        }
        return unclearHit("Financing is mentioned, but cash and loan terms could not be separated.");
      }),
  },
  {
    id: "closing",
    category: "closing",
    title: "Closing date",
    core: true,
    weight: "high",
    askOnSilence: false,
    find: (doc) =>
      fromLabel(doc, /closing date\s*:|(?:^|\n)\s*(?:\d+\.\s*)?closing\s*[:.]|\bclosing\s*:|conveyed on or before\s+[a-z]+\s+\d{1,2},\s+\d{4}|recorded on\s+[a-z]+\s+\d{1,2},\s+\d{4}/i, (located) => {
        const iso = parseIsoDate(located.window);
        if (!iso) return unclearHit("Closing is mentioned, but the date could not be read.");
        return { normalized: `date:${iso}`, display: formatIsoDate(iso), confidence: 0.93 };
      }),
  },
  {
    id: "inspection",
    category: "inspections",
    title: "Inspection",
    core: false,
    weight: "high",
    askOnSilence: false,
    find: (doc) =>
      fromLabel(doc, /inspection\s*:|home inspection|inspection contingency/i, (located) => {
        if (/waiv/i.test(located.window)) {
          return { normalized: "waived", display: "Inspection waived", confidence: 0.86 };
        }
        const days = parseDayCount(located.window);
        return {
          normalized: days != null ? `required:${days}` : "required:*",
          display: days != null ? `Home inspection contingency, ${days} days` : "Home inspection contingency",
          confidence: days != null ? 0.88 : 0.6,
        };
      }),
  },
  {
    id: "due_diligence",
    category: "due_diligence",
    title: "Due diligence",
    core: false,
    weight: "medium",
    askOnSilence: false,
    find: (doc) =>
      fromLabel(doc, /due diligence\s*:/i, (located) => {
        const days = parseDayCount(located.window);
        return {
          normalized: days != null ? `period:${days}` : "period:*",
          display: days != null ? `${days}-day due diligence period` : "Due diligence period",
          confidence: days != null ? 0.88 : 0.55,
        };
      }),
  },
  {
    id: "appraisal",
    category: "contingencies",
    title: "Appraisal",
    core: false,
    weight: "high",
    askOnSilence: false,
    find: (doc) =>
      fromLabel(doc, /appraisal\s*:/i, (located) => {
        if (/waiv|no appraisal/i.test(located.window)) {
          return { normalized: "waived", display: "Appraisal waived", confidence: 0.86 };
        }
        return { normalized: "required", display: "Appraisal contingency", confidence: 0.86 };
      }),
  },
  {
    id: "property_condition",
    category: "property_condition",
    title: "Property condition",
    core: false,
    weight: "medium",
    askOnSilence: false,
    find: (doc) =>
      fromLabel(doc, /property condition\s*:/i, (located) => {
        const repairs = /shall repair|agrees to repair|repair the/i.test(located.window);
        const noRepairs = /no seller repairs|without repair/i.test(located.window);
        const asIs = /as-?\s*is/i.test(located.window);
        if (noRepairs) {
          return { normalized: "as-is-no-repairs", display: "Strictly as-is, with no seller repairs", confidence: 0.88 };
        }
        if (repairs && asIs) {
          return {
            normalized: "repairs-and-as-is",
            display: "As-is, except the seller must complete stated repairs",
            confidence: 0.86,
          };
        }
        if (repairs) return { normalized: "repairs", display: "Seller repairs are required", confidence: 0.8 };
        if (asIs) return { normalized: "as-is", display: "As-is", confidence: 0.8 };
        return unclearHit("Property condition is mentioned, but the obligation could not be read.");
      }),
  },
  {
    id: "included_items",
    category: "included_items",
    title: "Included items",
    core: false,
    weight: "medium",
    askOnSilence: false,
    find: (doc) =>
      fromLabel(doc, /included items\s*:/i, (located) => {
        const found = INCLUDED.filter((item) => located.window.toLowerCase().includes(item));
        if (found.length === 0) return unclearHit("Included items are mentioned, but none could be identified.");
        return {
          normalized: `items:${[...found].sort().join(",")}`,
          display: found.join(", "),
          confidence: 0.84,
        };
      }),
  },
  {
    id: "title_deed",
    category: "title_deed",
    title: "Title and deed",
    core: false,
    weight: "medium",
    askOnSilence: false,
    find: (doc) =>
      fromLabel(doc, /title(?: and deed)?\s*:/i, (located) => {
        const deed = /quitclaim/i.test(located.window)
          ? "quitclaim"
          : /warranty/i.test(located.window)
            ? "warranty"
            : "*";
        const quality = /marketable|good and clear/i.test(located.window) ? "marketable" : "*";
        const display = [
          deed === "quitclaim" ? "Quitclaim deed" : deed === "warranty" ? "Warranty deed" : "Deed type not read",
          quality === "marketable" ? "marketable title" : "title quality not read",
        ].join(", ");
        return { normalized: `deed:${deed}|quality:${quality}`, display, confidence: deed === "*" ? 0.5 : 0.86 };
      }),
  },
  {
    id: "possession",
    category: "possession",
    title: "Possession",
    core: false,
    weight: "medium",
    askOnSilence: false,
    find: (doc) =>
      fromLabel(doc, /possession\s*:/i, (located) => {
        if (/at (?:the )?closing|delivered at closing/i.test(located.window)) {
          return { normalized: "at-closing", display: "Possession at closing", confidence: 0.88 };
        }
        if (/after closing|leaseback|days after closing/i.test(located.window)) {
          return { normalized: "after-closing", display: "Possession after closing", confidence: 0.84 };
        }
        return unclearHit("Possession is mentioned, but the timing could not be read.");
      }),
  },
  {
    id: "residence_sale",
    category: "contingencies",
    title: "Sale of buyer's residence",
    core: false,
    weight: "medium",
    askOnSilence: true,
    find: (doc) =>
      fromLabel(doc, /special provisions\s*:|current residence|sale of (?:the )?buyer/i, (located) => {
        if (/not a contingency/i.test(located.window)) {
          return {
            normalized: "not-contingency",
            display: "Sale of the buyer's current residence is not a contingency",
            confidence: 0.84,
          };
        }
        if (/contingent|contingency/i.test(located.window)) {
          return { normalized: "contingency", display: "Contingent on sale of the buyer's residence", confidence: 0.8 };
        }
        return null;
      }),
  },
  {
    id: "assignment",
    category: "special_provisions",
    title: "Assignment",
    core: false,
    weight: "medium",
    askOnSilence: false,
    find: (doc) =>
      fromLabel(doc, /assignment\s*:|\bassign(?:ment)?\b/i, (located) => {
        if (/without (?:the )?seller'?s? approval|without seller approval/i.test(located.window)) {
          return {
            normalized: "assign-without-approval",
            display: "Buyer may assign without seller approval",
            confidence: 0.9,
          };
        }
        if (/shall not assign|may not assign|no assignment/i.test(located.window)) {
          return { normalized: "no-assignment", display: "Assignment is not permitted", confidence: 0.86 };
        }
        return { normalized: "assignment", display: "Assignment is addressed", confidence: 0.6 };
      }),
  },
  {
    id: "time_of_essence",
    category: "dates",
    title: "Time is of the essence",
    core: false,
    weight: "medium",
    askOnSilence: false,
    find: (doc) =>
      fromLabel(doc, /time is of the essence/i, () => ({
        normalized: "time-of-essence",
        display: "Time is of the essence",
        confidence: 0.92,
      })),
  },
];

function labeledParty(doc: SourceDoc, id: "buyer" | "seller", title: string): Hit | null {
  return fromLabel(doc, id === "buyer" ? /buyer(?:\(s\))?\s*:/i : /seller["')\s]*:/i, (located) => {
    const name = shortParty(captureAfterColon(located.window));
    if (name.length < 2) return unclearHit(`${title} is labeled, but the name could not be read.`);
    return { normalized: `name:${normName(name)}`, display: name, confidence: 0.9 };
  });
}

function namedParty(doc: SourceDoc, id: "buyer" | "seller"): Hit | null {
  const columns = formNameColumns(doc);
  const fromColumns = columns?.[id === "buyer" ? 0 : 1];
  if (fromColumns) return partyHit(doc, fromColumns, /name\(s\)\s*:/i);
  const pattern =
    id === "buyer"
      ? /,\s*and\s+(.+?)\s+hereinafter called (?:the )?buyer/i
      : /between\s+(.+?)\s+hereinafter called (?:the )?seller/i;
  const located = findLabel(doc.pages, pattern);
  const name = shortParty(located?.window.match(pattern)?.[1] ?? "");
  if (!located || name.length < 2) return null;
  return {
    documentId: doc.documentId,
    quote: located.quote,
    page: located.page,
    section: located.section,
    normalized: `name:${normName(name)}`,
    display: name,
    confidence: 0.86,
  };
}

function formNameColumns(doc: SourceDoc): [string, string] | null {
  const located = findLabel(doc.pages, /name\(s\)\s*:/i);
  const line = located?.window.split("\n")[0] ?? "";
  const cells = line
    .split(/\s{2,}/)
    .map((cell) => cell.replace(/name\(s\)\s*:/i, "").trim())
    .filter((cell) => cell.length > 1);
  if (cells.length < 2) return null;
  return [cells[0], cells[1]];
}

function partyHit(doc: SourceDoc, name: string, pattern: RegExp): Hit | null {
  const located = findLabel(doc.pages, pattern);
  const cleaned = shortParty(name);
  if (!located || cleaned.length < 2) return null;
  return {
    documentId: doc.documentId,
    quote: located.quote,
    page: located.page,
    section: located.section,
    normalized: `name:${normName(cleaned)}`,
    display: cleaned,
    confidence: 0.88,
  };
}

function shortParty(name: string): string {
  return name
    .split(/,\s+a\s+|\s+with an address\b/i)[0]
    .replace(/,\s*$/, "")
    .replace(/\.$/, "")
    .trim();
}

function partySpec(id: "buyer" | "seller", title: string): Spec {
  return {
    id,
    category: "parties",
    title,
    core: true,
    weight: "high",
    askOnSilence: false,
    find: (doc) => namedParty(doc, id) ?? labeledParty(doc, id, title),
  };
}

function classifyFinancing(text: string): "cash" | "financed" | "UNCLEAR" | null {
  if (!/financ|mortgage|cash/i.test(text)) return null;
  const cash = /cash purchase|all[-\s]cash|transaction is a cash|paid in cash/i.test(text);
  const noMortgage = /no mortgage contingency|not contingent (?:up)?on (?:a )?(?:mortgage|financ)/i.test(text);
  const takesLoan = /obtain a .{0,60}mortgage|conventional mortgage|financing contingency|loan contingency/i.test(text);
  if ((cash || noMortgage) && !takesLoan) return "cash";
  if (takesLoan || /mortgage contingency/i.test(text)) return "financed";
  if (cash) return "cash";
  return "UNCLEAR";
}

function lastHit(docs: SourceDoc[], spec: Spec): Hit | null {
  let found: Hit | null = null;
  for (const doc of docs) {
    const hit = spec.find(doc);
    if (hit) found = hit;
  }
  return found;
}

export function compareDocuments(input: { reference: SourceDoc[]; psa: SourceDoc }): CompareResult {
  const referenceText = input.reference.reduce((sum, doc) => sum + textLength(doc.pages), 0);
  const psaText = textLength(input.psa.pages);
  if (referenceText < 40 || psaText < 40) {
    const findings = [extractionFinding(input)];
    return { findings, summary: summarize(findings) };
  }

  const referenceSparse = input.reference.some((doc) => doc.extractionStatus === "sparse");
  const psaSparse = input.psa.extractionStatus === "sparse";
  const findings: FindingDraft[] = [];

  for (const spec of SPECS) {
    const left = lastHit(input.reference, spec);
    const right = spec.find(input.psa);
    const draft = judge(spec, left, right);
    if (!draft) continue;
    softenSparse(draft, referenceSparse, psaSparse);
    findings.push(draft);
  }

  findings.sort(byPriority);
  return { findings, summary: summarize(findings) };
}

function judge(spec: Spec, left: Hit | null, right: Hit | null): FindingDraft | null {
  if (!left && !right) {
    if (!spec.core) return null;
    return draft(spec, "UNCLEAR", "review", 0.4, null, null, {
      explanation: `${spec.title} was not found in the offer or the purchase agreement. No match is asserted.`,
    });
  }

  if (!left || !right) {
    const present = left ?? right;
    if (!present) return null;
    if (spec.askOnSilence || present.normalized.startsWith("not-")) {
      return draft(spec, "UNCLEAR", "review", 0.58, left, right, {
        explanation: left
          ? `The offer states ${left.display}. The purchase agreement does not restate it. Silence is not treated as a missing term.`
          : `The purchase agreement states ${right?.display}. The offer does not address it. This needs attorney review rather than an assumed conflict.`,
      });
    }
    if (!left) {
      return draft(spec, "NEW_TERM", "review", Math.min(0.86, right?.confidence ?? 0.7), null, right, {
        explanation: `The purchase agreement includes ${spec.title.toLowerCase()}: ${right?.display}. The offer does not address it. This is flagged for review, not treated as an error by itself.`,
      });
    }
    return draft(spec, "MISSING", severity("MISSING", spec.weight), 0.74, left, null, {
      explanation: `The offer includes ${spec.title.toLowerCase()}: ${left.display}. No corresponding provision was found in the purchase agreement.`,
    });
  }

  const relation = sameNormalized(left.normalized, right.normalized);
  if (relation === "conflict") {
    return draft(spec, "DISCREPANCY", severity("DISCREPANCY", spec.weight), Math.min(left.confidence, right.confidence), left, right, {
      explanation: `The offer states ${left.display}. The purchase agreement states ${right.display}.`,
    });
  }
  if (relation === "partial") {
    return draft(spec, "UNCLEAR", "review", Math.min(left.confidence, right.confidence, 0.55), left, right, {
      explanation: `Part of ${spec.title.toLowerCase()} appears to correspond, but one document does not state enough to confirm it. Offer: ${left.display}. Purchase agreement: ${right.display}.`,
    });
  }
  const status: FindingStatus = looseText(left.quote) === looseText(right.quote) ? "MATCH" : "EQUIVALENT";
  return draft(spec, status, "info", Math.min(left.confidence, right.confidence), left, right, {
    explanation:
      status === "MATCH"
        ? `${spec.title} is the same in both documents (${left.display}).`
        : `${spec.title} uses different wording, but both documents state ${left.display}.`,
  });
}

function softenSparse(finding: FindingDraft, referenceSparse: boolean, psaSparse: boolean): void {
  if (!referenceSparse && !psaSparse) return;
  const unsupportedMatch = finding.status === "MATCH" || finding.status === "EQUIVALENT";
  const unsupportedAbsence =
    (finding.status === "MISSING" && psaSparse) || (finding.status === "NEW_TERM" && referenceSparse);
  if (!unsupportedMatch && !unsupportedAbsence) return;
  finding.status = "UNCLEAR";
  finding.severity = "review";
  finding.confidence = Math.min(finding.confidence, 0.4);
  finding.explanation += " Text extraction was incomplete, so this is not asserted as a match or a missing term.";
}

function draft(
  spec: Spec,
  status: FindingStatus,
  severity: Severity,
  confidence: number,
  left: Hit | null,
  right: Hit | null,
  extra: { explanation: string },
): FindingDraft {
  return {
    provisionId: spec.id,
    category: spec.category,
    status,
    severity,
    confidence,
    title: spec.title,
    explanation: extra.explanation,
    offerQuote: left?.quote ?? "",
    offerPage: left?.page ?? null,
    offerSection: left?.section ?? null,
    offerDocumentId: left?.documentId ?? null,
    offerValue: left?.display ?? null,
    offerNormalized: left?.normalized ?? null,
    psaQuote: right?.quote ?? "",
    psaPage: right?.page ?? null,
    psaSection: right?.section ?? null,
    psaDocumentId: right?.documentId ?? null,
    psaValue: right?.display ?? null,
    psaNormalized: right?.normalized ?? null,
  };
}

function extractionFinding(input: { reference: SourceDoc[]; psa: SourceDoc }): FindingDraft {
  return {
    provisionId: "extraction",
    category: "special_provisions",
    status: "UNCLEAR",
    severity: "review",
    confidence: 0.3,
    title: "Text extraction",
    explanation:
      "Text extraction did not produce enough text to compare these documents. No match is asserted.",
    offerQuote: "",
    offerPage: null,
    offerSection: null,
    offerDocumentId: input.reference[0]?.documentId ?? null,
    offerValue: null,
    offerNormalized: null,
    psaQuote: "",
    psaPage: null,
    psaSection: null,
    psaDocumentId: input.psa.documentId,
    psaValue: null,
    psaNormalized: null,
  };
}

function severity(status: FindingStatus, weight: "high" | "medium"): Severity {
  if (status === "MATCH" || status === "EQUIVALENT") return "info";
  if (status === "NEW_TERM" || status === "UNCLEAR") return "review";
  return weight;
}

function byPriority(a: FindingDraft, b: FindingDraft): number {
  const statusRank: Record<FindingStatus, number> = {
    DISCREPANCY: 0,
    MISSING: 1,
    NEW_TERM: 2,
    UNCLEAR: 3,
    EQUIVALENT: 4,
    MATCH: 5,
  };
  const severityRank: Record<Severity, number> = { high: 0, medium: 1, review: 2, info: 3 };
  return statusRank[a.status] - statusRank[b.status] || severityRank[a.severity] - severityRank[b.severity] || a.title.localeCompare(b.title);
}

export function summarize(findings: FindingDraft[]): CompareSummary {
  const summary: CompareSummary = {
    match: findings.filter((item) => item.status === "MATCH").length,
    equivalent: findings.filter((item) => item.status === "EQUIVALENT").length,
    discrepancy: findings.filter((item) => item.status === "DISCREPANCY").length,
    missing: findings.filter((item) => item.status === "MISSING").length,
    newTerm: findings.filter((item) => item.status === "NEW_TERM").length,
    unclear: findings.filter((item) => item.status === "UNCLEAR").length,
    narrative: "",
  };
  const aligned = summary.match + summary.equivalent;
  const issues: string[] = [];
  if (summary.discrepancy) issues.push(`${summary.discrepancy} conflict${summary.discrepancy === 1 ? "" : "s"}`);
  if (summary.missing) issues.push(`${summary.missing} missing provision${summary.missing === 1 ? "" : "s"}`);
  if (summary.newTerm) issues.push(`${summary.newTerm} new provision${summary.newTerm === 1 ? "" : "s"}`);
  if (summary.unclear) issues.push(`${summary.unclear} unclear item${summary.unclear === 1 ? "" : "s"}`);
  if (issues.length === 0) {
    summary.narrative = aligned
      ? `${aligned} term${aligned === 1 ? "" : "s"} align. Nothing was flagged for attorney review. This is not a legal determination.`
      : "No comparable terms were found. This is not a legal determination.";
  } else {
    summary.narrative = `${joinList(issues)} need attorney review. ${aligned} term${aligned === 1 ? "" : "s"} align. This is not a legal determination.`;
  }
  return summary;
}

function joinList(items: string[]): string {
  if (items.length === 1) return capitalize(items[0]);
  if (items.length === 2) return capitalize(`${items[0]} and ${items[1]}`);
  return capitalize(`${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function sourceFromText(
  documentId: string,
  filename: string,
  role: SourceDoc["role"],
  text: string,
  extractionStatus: SourceDoc["extractionStatus"] = "ok",
): SourceDoc {
  const chunks = text.split("\f");
  return {
    documentId,
    filename,
    role,
    extractionStatus,
    pages: chunks.map((chunk, index) => ({ page: index + 1, text: chunk })),
  };
}
