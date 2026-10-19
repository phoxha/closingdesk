import { readFile } from "fs/promises";
import { decryptBytes } from "@/lib/crypto/files";
import { EXTRACTION_VERSION, extractDocument } from "@/lib/documents/extract-text";
import { filePath, getBundle, updateDocumentExtraction } from "@/lib/store";

/** Re-read stored PDFs when the extractor starts keeping filled form values on their lines. */
export async function refreshPdfText(userId: string, matterId: string): Promise<boolean> {
  const bundle = await getBundle(userId, matterId);
  if (!bundle) return false;
  const stale = bundle.documents.filter(
    (doc) => doc.mimeType === "application/pdf" && doc.extractionVersion !== EXTRACTION_VERSION,
  );
  let changed = false;
  for (const doc of stale) {
    try {
      const bytes = decryptBytes(await readFile(filePath(doc.storageKey)));
      const extracted = await extractDocument(bytes, doc.filename, doc.mimeType);
      const previousChars = doc.pages.reduce((sum, page) => sum + page.text.trim().length, 0);
      if (extracted.status === "failed" && previousChars > 200) {
        await updateDocumentExtraction({
          userId,
          matterId,
          documentId: doc.id,
          pages: doc.pages,
          extractionStatus: doc.extractionStatus,
          extractionWarning: doc.extractionWarning,
        });
        continue;
      }
      const saved = await updateDocumentExtraction({
        userId,
        matterId,
        documentId: doc.id,
        pages: extracted.pages,
        extractionStatus: extracted.status,
        extractionWarning: extracted.warning,
      });
      changed = changed || saved;
    } catch {
      await updateDocumentExtraction({
        userId,
        matterId,
        documentId: doc.id,
        pages: doc.pages,
        extractionStatus: doc.extractionStatus,
        extractionWarning: doc.extractionWarning ?? "The stored PDF could not be read again.",
      });
    }
  }
  return changed;
}
