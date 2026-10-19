import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { encryptBytes, dataDir } from "@/lib/crypto/files";
import { extractDocument } from "@/lib/documents/extract-text";
import { addDocument, filePath } from "@/lib/store";
import type { DocumentRole, StoredDocument } from "@/lib/types";

export async function ingestDocument(input: {
  userId: string;
  matterId: string;
  role: DocumentRole;
  filename: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<{ document: StoredDocument } | { error: string }> {
  const extracted = await extractDocument(input.bytes, input.filename, input.mimeType);
  if (extracted.warning === "Upload a PDF or DOCX file." || extracted.warning === "The file is empty." || extracted.warning === "Files must be 20 MB or smaller.") {
    return { error: extracted.warning };
  }
  const storageKey = randomUUID();
  await mkdir(path.join(dataDir(), "files"), { recursive: true });
  await writeFile(filePath(storageKey), encryptBytes(input.bytes));
  const document = await addDocument({
    userId: input.userId,
    matterId: input.matterId,
    role: input.role,
    filename: input.filename.slice(0, 180),
    mimeType: extracted.mimeType,
    byteSize: input.bytes.length,
    storageKey,
    pages: extracted.pages,
    extractionStatus: extracted.status,
    extractionWarning: extracted.warning,
  });
  if (!document) return { error: "Transaction not found." };
  return { document };
}
