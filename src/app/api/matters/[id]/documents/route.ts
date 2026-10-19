import { NextResponse } from "next/server";
import { isUser, requireApiUser } from "@/lib/auth/current";
import { ingestDocument } from "@/lib/documents/ingest";
import type { DocumentRole } from "@/lib/types";

const ROLES = new Set<DocumentRole>(["offer", "psa", "addendum"]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!isUser(user)) return user;
  const { id } = await context.params;
  const form = await request.formData();
  const role = String(form.get("role") ?? "");
  const file = form.get("file");
  if (!ROLES.has(role as DocumentRole)) {
    return NextResponse.json({ error: "Choose an offer, purchase agreement, or addendum." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await ingestDocument({
    userId: user.id,
    matterId: id,
    role: role as DocumentRole,
    filename: file.name || "document",
    mimeType: file.type || "",
    bytes,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ id: result.document.id });
}
