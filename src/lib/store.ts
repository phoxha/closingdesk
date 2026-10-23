import { randomUUID } from "crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "fs/promises";
import path from "path";
import { hashPassword } from "@/lib/auth/password";
import { decryptBytes, encryptBytes, dataDir, retentionDays } from "@/lib/crypto/files";
import { EXTRACTION_VERSION } from "@/lib/documents/extract-text";
import { attorneyEmail, attorneyName, attorneyPassword } from "@/lib/demo-account";
import { formatDay } from "@/lib/format";
import { openCount } from "@/lib/review-state";
import type {
  AttorneyReview,
  AuditEvent,
  ComparisonRun,
  Database,
  DocQuestion,
  DocumentRole,
  Finding,
  Matter,
  PublicUser,
  ReviewAction,
  StoredDocument,
  User,
} from "@/lib/types";

export type MatterRow = {
  id: string;
  propertyAddress: string;
  clientName: string;
  matterName: string;
  phase: string;
  documentsLabel: string;
  latestReview: string | null;
  openIssues: number | null;
  closingLabel: string;
};

export type MatterBundle = {
  matter: Matter;
  documents: StoredDocument[];
  runs: ComparisonRun[];
  findings: Finding[];
  reviews: AttorneyReview[];
  questions: DocQuestion[];
  audit: AuditEvent[];
};

let chain: Promise<void> = Promise.resolve();

export async function readDb<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  return withDb(fn, false);
}

export async function updateDb<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  return withDb(fn, true);
}

async function withDb<T>(fn: (db: Database) => T | Promise<T>, write: boolean): Promise<T> {
  const run = chain.then(async () => {
    const db = await readFromDisk();
    const maintenance = seed(db) || purgeExpired(db);
    const result = await fn(db);
    if (write || maintenance) await persist(db);
    return result;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readFromDisk(): Promise<Database> {
  await mkdir(dataDir(), { recursive: true });
  try {
    const payload = await readFile(storePath());
    const db = JSON.parse(decryptBytes(payload).toString("utf8")) as Database;
    if (!Array.isArray(db.questions)) db.questions = [];
    return db;
  } catch (error) {
    const missing = error instanceof Error && "code" in error && error.code === "ENOENT";
    if (!missing) throw error;
    return emptyDb();
  }
}

function seed(db: Database): boolean {
  const email = attorneyEmail();
  const previous = db.users.find((user) => user.email === "vitaliy@closingdesk.local");
  let changed = false;
  if (previous && !db.users.some((user) => user.email === email)) {
    previous.email = email;
    changed = true;
  }
  if (db.users.length > 0) return changed;
  const password = attorneyPassword();
  if (!password) return false;
  db.users.push({
    id: randomUUID(),
    name: attorneyName(),
    email: attorneyEmail(),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  });
  return true;
}

function purgeExpired(db: Database): boolean {
  const days = retentionDays();
  if (!days) return false;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const stale = db.documents.filter((doc) => new Date(doc.uploadedAt).getTime() < cutoff);
  if (stale.length === 0) return false;
  for (const doc of stale) {
    void unlink(filePath(doc.storageKey)).catch(() => undefined);
    db.audit.push(event(doc.matterId, null, "document.retention", `${doc.filename} was deleted under the retention policy.`));
  }
  const ids = new Set(stale.map((doc) => doc.id));
  db.documents = db.documents.filter((doc) => !ids.has(doc.id));
  return true;
}

async function persist(db: Database): Promise<void> {
  await mkdir(dataDir(), { recursive: true });
  const tmp = `${storePath()}.tmp`;
  await writeFile(tmp, encryptBytes(Buffer.from(JSON.stringify(db))));
  await rename(tmp, storePath());
}

function storePath(): string {
  return path.join(dataDir(), "store.bin");
}

export function filePath(storageKey: string): string {
  if (!/^[\w-]+$/.test(storageKey)) throw new Error("Invalid storage key.");
  return path.join(dataDir(), "files", storageKey);
}

function emptyDb(): Database {
  return { version: 1, users: [], matters: [], documents: [], runs: [], findings: [], reviews: [], questions: [], audit: [] };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  return readDb((db) => db.users.find((user) => user.email === email.trim().toLowerCase()) ?? null);
}

export async function publicUser(id: string): Promise<PublicUser | null> {
  return readDb((db) => {
    const user = db.users.find((item) => item.id === id);
    return user ? { id: user.id, name: user.name, email: user.email } : null;
  });
}

export async function listMatterRows(userId: string): Promise<MatterRow[]> {
  return readDb((db) =>
    db.matters
      .filter((matter) => matter.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((matter) => toRow(db, matter)),
  );
}

export async function getBundle(userId: string, matterId: string): Promise<MatterBundle | null> {
  return readDb((db) => {
    const matter = owned(db, userId, matterId);
    if (!matter) return null;
    const findings = findingsFor(db, matter.id);
    const findingIds = new Set(findings.map((finding) => finding.id));
    return {
      matter,
      documents: db.documents.filter((doc) => doc.matterId === matter.id).sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt)),
      runs: db.runs.filter((run) => run.matterId === matter.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      findings,
      reviews: db.reviews.filter((review) => findingIds.has(review.findingId)),
      questions: db.questions.filter((item) => item.matterId === matter.id),
      audit: db.audit.filter((item) => item.matterId === matter.id).slice(-40).reverse(),
    };
  });
}

export async function createMatter(input: {
  userId: string;
  propertyAddress: string;
  clientName: string;
  matterName: string;
  closingDate: string | null;
  sample?: boolean;
}): Promise<Matter> {
  return updateDb((db) => {
    const now = new Date().toISOString();
    const matter: Matter = {
      id: randomUUID(),
      userId: input.userId,
      propertyAddress: input.propertyAddress.trim(),
      clientName: input.clientName.trim(),
      matterName: input.matterName.trim(),
      closingDate: input.closingDate,
      sample: Boolean(input.sample),
      createdAt: now,
      updatedAt: now,
    };
    db.matters.push(matter);
    db.audit.push(event(matter.id, input.userId, "matter.created", matter.propertyAddress));
    return matter;
  });
}

export async function addDocument(input: {
  userId: string;
  matterId: string;
  role: DocumentRole;
  filename: string;
  mimeType: string;
  byteSize: number;
  storageKey: string;
  pages: StoredDocument["pages"];
  extractionStatus: StoredDocument["extractionStatus"];
  extractionWarning: string | null;
}): Promise<StoredDocument | null> {
  return updateDb((db) => {
    const matter = owned(db, input.userId, input.matterId);
    if (!matter) return null;
    const siblings = db.documents.filter((doc) => doc.matterId === matter.id && doc.role === input.role);
    const version = siblings.reduce((max, doc) => Math.max(max, doc.version), 0) + 1;
    if (input.role === "offer" || input.role === "psa") {
      for (const doc of siblings) doc.isControlling = false;
    }
    const document: StoredDocument = {
      id: randomUUID(),
      matterId: matter.id,
      role: input.role,
      filename: input.filename,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      version,
      isControlling: true,
      storageKey: input.storageKey,
      pageCount: input.pages.length,
      extractionStatus: input.extractionStatus,
      extractionWarning: input.extractionWarning,
      extractionVersion: EXTRACTION_VERSION,
      pages: input.pages,
      uploadedAt: new Date().toISOString(),
      uploadedBy: input.userId,
    };
    db.documents.push(document);
    matter.updatedAt = document.uploadedAt;
    db.audit.push(
      event(matter.id, input.userId, "document.uploaded", `${roleLabel(input.role)} v${version}: ${input.filename}`),
    );
    return document;
  });
}

export async function updateDocumentExtraction(input: {
  userId: string;
  matterId: string;
  documentId: string;
  pages: StoredDocument["pages"];
  extractionStatus: StoredDocument["extractionStatus"];
  extractionWarning: string | null;
}): Promise<boolean> {
  return updateDb((db) => {
    const matter = owned(db, input.userId, input.matterId);
    const document = db.documents.find((doc) => doc.id === input.documentId && doc.matterId === input.matterId);
    if (!matter || !document) return false;
    const previous = document.pages.map((page) => page.text).join("\n");
    const next = input.pages.map((page) => page.text).join("\n");
    document.pages = input.pages;
    document.pageCount = input.pages.length;
    document.extractionStatus = input.extractionStatus;
    document.extractionWarning = input.extractionWarning;
    document.extractionVersion = EXTRACTION_VERSION;
    if (previous === next) return false;
    matter.updatedAt = new Date().toISOString();
    db.audit.push(event(matter.id, input.userId, "document.extracted", `Re-read ${document.filename} so filled-in values stay on their lines.`));
    return true;
  });
}

export async function setControlling(userId: string, matterId: string, documentId: string, controlling: boolean): Promise<boolean> {
  return updateDb((db) => {
    const matter = owned(db, userId, matterId);
    const document = db.documents.find((doc) => doc.id === documentId && doc.matterId === matterId);
    if (!matter || !document) return false;
    if ((document.role === "offer" || document.role === "psa") && controlling) {
      for (const doc of db.documents) {
        if (doc.matterId === matterId && doc.role === document.role) doc.isControlling = false;
      }
    }
    document.isControlling = controlling;
    matter.updatedAt = new Date().toISOString();
    db.audit.push(
      event(matter.id, userId, "document.controlling", `${document.filename} ${controlling ? "is" : "is not"} a controlling document.`),
    );
    return true;
  });
}

export async function deleteDocument(userId: string, matterId: string, documentId: string): Promise<boolean> {
  return updateDb((db) => {
    const matter = owned(db, userId, matterId);
    const index = db.documents.findIndex((doc) => doc.id === documentId && doc.matterId === matterId);
    if (!matter || index < 0) return false;
    const [document] = db.documents.splice(index, 1);
    matter.updatedAt = new Date().toISOString();
    db.audit.push(event(matter.id, userId, "document.deleted", document.filename));
    void unlink(filePath(document.storageKey)).catch(() => undefined);
    return true;
  });
}

export async function saveComparison(input: {
  userId: string;
  matterId: string;
  offerDocumentIds: string[];
  psaDocumentId: string;
  method: ComparisonRun["method"];
  modelNote: string | null;
  summary: ComparisonRun["summary"];
  findings: Omit<Finding, "id" | "runId">[];
}): Promise<ComparisonRun | null> {
  return updateDb((db) => {
    const matter = owned(db, input.userId, input.matterId);
    if (!matter) return null;
    const now = new Date().toISOString();
    const run: ComparisonRun = {
      id: randomUUID(),
      matterId: matter.id,
      offerDocumentIds: input.offerDocumentIds,
      psaDocumentId: input.psaDocumentId,
      createdAt: now,
      createdBy: input.userId,
      method: input.method,
      modelNote: input.modelNote,
      summary: input.summary,
    };
    db.runs.push(run);
    for (const finding of input.findings) {
      db.findings.push({ ...finding, id: randomUUID(), runId: run.id });
    }
    matter.updatedAt = now;
    db.audit.push(event(matter.id, input.userId, "comparison.completed", run.summary.narrative));
    return run;
  });
}

export async function addReview(input: {
  userId: string;
  matterId: string;
  findingId: string;
  action: ReviewAction;
  note: string;
}): Promise<AttorneyReview | null> {
  return updateDb((db) => {
    const matter = owned(db, input.userId, input.matterId);
    const finding = db.findings.find((item) => item.id === input.findingId);
    const run = finding ? db.runs.find((item) => item.id === finding.runId && item.matterId === input.matterId) : null;
    if (!matter || !finding || !run) return null;
    const review: AttorneyReview = {
      id: randomUUID(),
      findingId: finding.id,
      userId: input.userId,
      action: input.action,
      note: input.note.trim(),
      createdAt: new Date().toISOString(),
    };
    db.reviews.push(review);
    matter.updatedAt = review.createdAt;
    db.audit.push(event(matter.id, input.userId, "finding.reviewed", `${finding.title}: ${input.action}`));
    return review;
  });
}

export async function addQuestion(input: {
  userId: string;
  matterId: string;
  runId: string;
  question: string;
  answer: string;
  offerQuote: string;
  psaQuote: string;
}): Promise<DocQuestion | null> {
  return updateDb((db) => {
    const matter = owned(db, input.userId, input.matterId);
    const run = db.runs.find((item) => item.id === input.runId && item.matterId === input.matterId);
    if (!matter || !run) return null;
    if (!Array.isArray(db.questions)) db.questions = [];
    const saved: DocQuestion = {
      id: randomUUID(),
      matterId: matter.id,
      runId: run.id,
      userId: input.userId,
      question: input.question.trim(),
      answer: input.answer.trim(),
      offerQuote: input.offerQuote.trim(),
      psaQuote: input.psaQuote.trim(),
      createdAt: new Date().toISOString(),
    };
    db.questions.push(saved);
    matter.updatedAt = saved.createdAt;
    db.audit.push(event(matter.id, input.userId, "question.asked", saved.question.slice(0, 160)));
    return saved;
  });
}

export async function recordReportDownload(userId: string, matterId: string): Promise<boolean> {
  return updateDb((db) => {
    const matter = owned(db, userId, matterId);
    if (!matter) return false;
    db.audit.push(event(matter.id, userId, "report.downloaded", "Purchase Agreement Verification Report"));
    return true;
  });
}

export function referenceDocuments(documents: StoredDocument[]): { reference: StoredDocument[]; psa: StoredDocument | null } {
  const offer = latestControlling(documents, "offer");
  const psa = latestControlling(documents, "psa");
  const addenda = documents
    .filter((doc) => doc.role === "addendum" && doc.isControlling)
    .sort((a, b) => a.version - b.version);
  return { reference: offer ? [offer, ...addenda] : addenda, psa };
}

function latestControlling(documents: StoredDocument[], role: DocumentRole): StoredDocument | null {
  const docs = documents.filter((doc) => doc.role === role).sort((a, b) => a.version - b.version);
  const controlling = docs.filter((doc) => doc.isControlling);
  return controlling[controlling.length - 1] ?? docs[docs.length - 1] ?? null;
}

function toRow(db: Database, matter: Matter): MatterRow {
  const documents = db.documents.filter((doc) => doc.matterId === matter.id);
  const runs = db.runs.filter((run) => run.matterId === matter.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const latest = runs[runs.length - 1] ?? null;
  const findings = latest ? db.findings.filter((finding) => finding.runId === latest.id) : [];
  const reviews = db.reviews.filter((review) => findings.some((finding) => finding.id === review.findingId));
  const hasOffer = documents.some((doc) => doc.role === "offer");
  const hasPsa = documents.some((doc) => doc.role === "psa");
  const open = latest ? openCount(findings, reviews) : null;
  let phase = "Needs documents";
  if (hasOffer && hasPsa && !latest) phase = "Ready to compare";
  if (latest && open && open > 0) phase = "Issues open";
  if (latest && open === 0) phase = "Review complete";
  const reviewTimes = [latest?.createdAt ?? null, ...reviews.map((review) => review.createdAt)].filter((item): item is string => Boolean(item));
  const closing = findings.find((finding) => finding.provisionId === "closing");
  return {
    id: matter.id,
    propertyAddress: matter.propertyAddress,
    clientName: matter.clientName,
    matterName: matter.matterName,
    phase,
    documentsLabel: documentLabel(documents),
    latestReview: reviewTimes.sort().at(-1) ?? null,
    openIssues: open,
    closingLabel: matter.closingDate
      ? formatDay(matter.closingDate)
      : closing?.status === "DISCREPANCY"
        ? "Conflict"
        : closing?.offerValue ?? "—",
  };
}

function documentLabel(documents: StoredDocument[]): string {
  if (documents.length === 0) return "None";
  const parts: string[] = [];
  for (const role of ["offer", "psa", "addendum"] as const) {
    const docs = documents.filter((doc) => doc.role === role);
    if (docs.length === 0) continue;
    const latest = docs.reduce((max, doc) => Math.max(max, doc.version), 0);
    const name = role === "offer" ? "Offer" : role === "psa" ? "PSA" : "Addenda";
    parts.push(role === "addendum" ? `${docs.length} ${name}` : `${name} v${latest}`);
  }
  return parts.join(" · ");
}

function findingsFor(db: Database, matterId: string): Finding[] {
  const runIds = new Set(db.runs.filter((run) => run.matterId === matterId).map((run) => run.id));
  return db.findings.filter((finding) => runIds.has(finding.runId));
}

function owned(db: Database, userId: string, matterId: string): Matter | null {
  return db.matters.find((matter) => matter.id === matterId && matter.userId === userId) ?? null;
}

function event(matterId: string | null, userId: string | null, action: string, detail: string): AuditEvent {
  return { id: randomUUID(), matterId, userId, action, detail, createdAt: new Date().toISOString() };
}

function roleLabel(role: DocumentRole): string {
  if (role === "offer") return "Accepted offer";
  if (role === "psa") return "Purchase agreement";
  return "Addendum";
}
