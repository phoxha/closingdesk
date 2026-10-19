import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { isUser, requireApiUser } from "@/lib/auth/current";
import { decryptBytes } from "@/lib/crypto/files";
import { filePath, getBundle } from "@/lib/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string; docId: string }> }) {
  const user = await requireApiUser();
  if (!isUser(user)) return user;
  const { id, docId } = await context.params;
  const bundle = await getBundle(user.id, id);
  const document = bundle?.documents.find((item) => item.id === docId);
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  try {
    const bytes = decryptBytes(await readFile(filePath(document.storageKey)));
    const filename = document.filename.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "document";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "The stored file could not be opened." }, { status: 500 });
  }
}
