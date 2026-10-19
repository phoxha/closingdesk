import type { AttorneyReview, Finding, Matter, StoredDocument } from "@/lib/types";
import { ACTION_LABELS, CATEGORY_LABELS, STATUS_LABELS } from "@/lib/types";
import { latestReview } from "@/lib/review-state";
import { isOpenFinding } from "@/lib/review-state";

export type ReportModel = {
  title: string;
  disclaimer: string;
  propertyAddress: string;
  clientName: string;
  matterName: string;
  closingDate: string | null;
  preparedAt: string;
  documents: Array<{ role: string; filename: string; version: number; pages: number; extraction: string }>;
  narrative: string;
  counts: Array<{ label: string; value: number }>;
  aligned: ReportRow[];
  differences: ReportRow[];
  reviewItems: ReportRow[];
  comments: Array<{ title: string; action: string; note: string; at: string }>;
  outstanding: ReportRow[];
};

export type ReportRow = {
  title: string;
  category: string;
  status: string;
  severity: string;
  explanation: string;
  offerQuote: string;
  offerRef: string;
  psaQuote: string;
  psaRef: string;
  decision: string;
};

const DISCLAIMER =
  "Prepared for attorney review. ClosingDesk compares documents and does not make a legal determination. Confirm every finding against the source documents before relying on it.";

export function buildReportModel(input: {
  matter: Matter;
  documents: StoredDocument[];
  findings: Finding[];
  reviews: AttorneyReview[];
  narrative: string;
  preparedAt: string;
}): ReportModel {
  const rows = input.findings.map((finding) => toRow(finding, input.reviews));
  const usedIds = new Set<string>();
  for (const finding of input.findings) {
    if (finding.offerDocumentId) usedIds.add(finding.offerDocumentId);
    if (finding.psaDocumentId) usedIds.add(finding.psaDocumentId);
  }
  const documents = input.documents.filter((doc) => usedIds.has(doc.id));
  return {
    title: "Purchase Agreement Verification Report",
    disclaimer: DISCLAIMER,
    propertyAddress: input.matter.propertyAddress,
    clientName: input.matter.clientName,
    matterName: input.matter.matterName,
    closingDate: input.matter.closingDate,
    preparedAt: input.preparedAt,
    documents: documents.map((doc) => ({
      role: doc.role === "offer" ? "Accepted offer" : doc.role === "psa" ? "Purchase and sale agreement" : "Addendum",
      filename: doc.filename,
      version: doc.version,
      pages: doc.pageCount,
      extraction: doc.extractionStatus,
    })),
    narrative: input.narrative,
    counts: [
      { label: "Match", value: input.findings.filter((item) => item.status === "MATCH").length },
      { label: "Equivalent", value: input.findings.filter((item) => item.status === "EQUIVALENT").length },
      { label: "Discrepancy", value: input.findings.filter((item) => item.status === "DISCREPANCY").length },
      { label: "Missing", value: input.findings.filter((item) => item.status === "MISSING").length },
      { label: "New provision", value: input.findings.filter((item) => item.status === "NEW_TERM").length },
      { label: "Unclear", value: input.findings.filter((item) => item.status === "UNCLEAR").length },
    ],
    aligned: rows.filter((row) => row.status === "Match" || row.status === "Equivalent"),
    differences: rows.filter((row) => row.status === "Discrepancy"),
    reviewItems: rows.filter((row) => row.status === "Missing" || row.status === "New provision" || row.status === "Unclear"),
    comments: input.reviews.flatMap((review) => {
      const finding = input.findings.find((item) => item.id === review.findingId);
      if (!finding) return [];
      return [
        {
          title: finding.title,
          action: review.action,
          note: review.note,
          at: review.createdAt,
        },
      ];
    }),
    outstanding: input.findings.filter((finding) => isOpenFinding(finding, input.reviews)).map((finding) => toRow(finding, input.reviews)),
  };
}

function toRow(finding: Finding, reviews: AttorneyReview[]): ReportRow {
  const decision = latestReview(finding.id, reviews);
  return {
    title: finding.title,
    category: CATEGORY_LABELS[finding.category],
    status: STATUS_LABELS[finding.status],
    severity: finding.severity,
    explanation: finding.explanation,
    offerQuote: finding.offerQuote,
    offerRef: ref(finding.offerSection, finding.offerPage),
    psaQuote: finding.psaQuote,
    psaRef: ref(finding.psaSection, finding.psaPage),
    decision: decision ? `${ACTION_LABELS[decision.action]}${decision.note ? `: ${decision.note}` : ""}` : "Not reviewed",
  };
}

function ref(section: string | null, page: number | null): string {
  const bits = [];
  if (section) bits.push(section);
  if (page) bits.push(`page ${page}`);
  return bits.join(", ") || "Source page not available";
}
