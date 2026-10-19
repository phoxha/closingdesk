import { compareDocuments } from "@/lib/comparison/compare";
import { refineWithModel } from "@/lib/comparison/llm";
import { documentText } from "@/lib/comparison/text";
import { refreshPdfText } from "@/lib/documents/refresh-extraction";
import { getBundle, referenceDocuments, saveComparison } from "@/lib/store";
import type { SourceDoc, StoredDocument } from "@/lib/types";

export async function runComparison(userId: string, matterId: string): Promise<{ runId: string } | { error: string }> {
  await refreshPdfText(userId, matterId);
  const bundle = await getBundle(userId, matterId);
  if (!bundle) return { error: "Transaction not found." };
  const selected = referenceDocuments(bundle.documents);
  const offer = selected.reference.find((doc) => doc.role === "offer");
  if (!offer || !selected.psa) {
    return { error: "Upload an accepted offer and a purchase agreement before comparing." };
  }
  const reference = selected.reference.map(toSource);
  const psa = toSource(selected.psa);
  const compared = compareDocuments({ reference, psa });
  const refined = await refineWithModel({
    offerText: reference.map((doc) => documentText(doc.pages)).join("\n\n"),
    psaText: documentText(psa.pages),
    findings: compared.findings,
  });
  const summary = {
    ...compared.summary,
    narrative: refined.note ? `${compared.summary.narrative} ${refined.note}` : compared.summary.narrative,
  };
  const run = await saveComparison({
    userId,
    matterId,
    offerDocumentIds: reference.map((doc) => doc.documentId),
    psaDocumentId: psa.documentId,
    method: refined.method,
    modelNote: refined.note,
    summary,
    findings: refined.findings,
  });
  if (!run) return { error: "Transaction not found." };
  return { runId: run.id };
}

function toSource(doc: StoredDocument): SourceDoc {
  return {
    documentId: doc.id,
    filename: doc.filename,
    role: doc.role,
    pages: doc.pages,
    extractionStatus: doc.extractionStatus,
  };
}
