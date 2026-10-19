export const CATEGORIES = [
  "property",
  "parties",
  "purchase_price",
  "deposits",
  "financing",
  "closing",
  "inspections",
  "due_diligence",
  "contingencies",
  "property_condition",
  "included_items",
  "title_deed",
  "possession",
  "special_provisions",
  "dates",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const FINDING_STATUSES = [
  "MATCH",
  "EQUIVALENT",
  "DISCREPANCY",
  "MISSING",
  "NEW_TERM",
  "UNCLEAR",
] as const;

export type FindingStatus = (typeof FINDING_STATUSES)[number];

export type Severity = "high" | "medium" | "review" | "info";

export type DocumentRole = "offer" | "psa" | "addendum";

export type ExtractionStatus = "ok" | "sparse" | "failed";

export type ReviewAction = "confirm" | "acceptable" | "revision" | "note" | "resolved";

export type DocPage = { page: number; text: string };

export type SourceDoc = {
  documentId: string;
  filename: string;
  role: DocumentRole;
  pages: DocPage[];
  extractionStatus: ExtractionStatus;
};

export type FindingDraft = {
  provisionId: string;
  category: Category;
  status: FindingStatus;
  severity: Severity;
  confidence: number;
  title: string;
  explanation: string;
  offerQuote: string;
  offerPage: number | null;
  offerSection: string | null;
  offerDocumentId: string | null;
  offerValue: string | null;
  offerNormalized: string | null;
  psaQuote: string;
  psaPage: number | null;
  psaSection: string | null;
  psaDocumentId: string | null;
  psaValue: string | null;
  psaNormalized: string | null;
};

export type CompareSummary = {
  match: number;
  equivalent: number;
  discrepancy: number;
  missing: number;
  newTerm: number;
  unclear: number;
  narrative: string;
};

export type CompareResult = {
  findings: FindingDraft[];
  summary: CompareSummary;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
};

export type User = PublicUser & {
  passwordHash: string;
  createdAt: string;
};

export type Matter = {
  id: string;
  userId: string;
  propertyAddress: string;
  clientName: string;
  matterName: string;
  closingDate: string | null;
  sample: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StoredDocument = {
  id: string;
  matterId: string;
  role: DocumentRole;
  filename: string;
  mimeType: string;
  byteSize: number;
  version: number;
  isControlling: boolean;
  storageKey: string;
  pageCount: number;
  extractionStatus: ExtractionStatus;
  extractionWarning: string | null;
  extractionVersion: number;
  pages: DocPage[];
  uploadedAt: string;
  uploadedBy: string;
};

export type ComparisonRun = {
  id: string;
  matterId: string;
  offerDocumentIds: string[];
  psaDocumentId: string;
  createdAt: string;
  createdBy: string;
  method: "rules" | "rules+model";
  modelNote: string | null;
  summary: CompareSummary;
};

export type Finding = FindingDraft & {
  id: string;
  runId: string;
};

export type AttorneyReview = {
  id: string;
  findingId: string;
  userId: string;
  action: ReviewAction;
  note: string;
  createdAt: string;
};

export type DocQuestion = {
  id: string;
  matterId: string;
  runId: string;
  userId: string;
  question: string;
  answer: string;
  offerQuote: string;
  psaQuote: string;
  createdAt: string;
};

export type AuditEvent = {
  id: string;
  matterId: string | null;
  userId: string | null;
  action: string;
  detail: string;
  createdAt: string;
};

export type Database = {
  version: 1;
  users: User[];
  matters: Matter[];
  documents: StoredDocument[];
  runs: ComparisonRun[];
  findings: Finding[];
  reviews: AttorneyReview[];
  questions: DocQuestion[];
  audit: AuditEvent[];
};

export const CATEGORY_LABELS: Record<Category, string> = {
  property: "Property",
  parties: "Parties",
  purchase_price: "Purchase price",
  deposits: "Deposits",
  financing: "Financing",
  closing: "Closing",
  inspections: "Inspections",
  due_diligence: "Due diligence",
  contingencies: "Contingencies",
  property_condition: "Property condition",
  included_items: "Included items",
  title_deed: "Title and deed",
  possession: "Possession",
  special_provisions: "Special provisions",
  dates: "Dates",
};

export const STATUS_LABELS: Record<FindingStatus, string> = {
  MATCH: "Match",
  EQUIVALENT: "Equivalent",
  DISCREPANCY: "Discrepancy",
  MISSING: "Missing",
  NEW_TERM: "New provision",
  UNCLEAR: "Unclear",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  review: "Review",
  info: "Informational",
};

export const ACTION_LABELS: Record<ReviewAction, string> = {
  confirm: "Confirmed",
  acceptable: "Acceptable",
  revision: "Revision requested",
  note: "Note",
  resolved: "Resolved",
};

export const MODULES = [
  {
    slug: "offer-psa",
    name: "Offer vs. PSA",
    phase: "Available" as const,
    summary: "Compare an accepted offer with the purchase and sale agreement.",
  },
  {
    slug: "closing-documents",
    name: "Closing documents",
    phase: "Planned" as const,
    summary: "Compare names, amounts, and legal descriptions across the closing set.",
  },
  {
    slug: "title-insurance",
    name: "Title and insurance",
    phase: "Planned" as const,
    summary: "Review title commitments, exceptions, and outstanding requirements.",
  },
  {
    slug: "checklist",
    name: "Closing checklist",
    phase: "Planned" as const,
    summary: "Track requirements, owners, and deadlines before closing.",
  },
  {
    slug: "settlement",
    name: "Settlement",
    phase: "Planned" as const,
    summary: "Check payoff figures, credits, fees, and disbursements.",
  },
  {
    slug: "communications",
    name: "Communications",
    phase: "Planned" as const,
    summary: "Draft requests and keep a record of what is still outstanding.",
  },
  {
    slug: "post-closing",
    name: "Post-closing",
    phase: "Planned" as const,
    summary: "Track recording, the final title policy, and document delivery.",
  },
];
