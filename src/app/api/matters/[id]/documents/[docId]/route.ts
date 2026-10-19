import { NextResponse } from "next/server";
import { isUser, requireApiUser } from "@/lib/auth/current";
import { deleteDocument, setControlling } from "@/lib/store";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; docId: string }> }) {
  const user = await requireApiUser();
  if (!isUser(user)) return user;
  const { id, docId } = await context.params;
  const body = (await request.json().catch(() => null)) as { isControlling?: boolean } | null;
  if (typeof body?.isControlling !== "boolean") {
    return NextResponse.json({ error: "Missing controlling flag." }, { status: 400 });
  }
  const ok = await setControlling(user.id, id, docId, body.isControlling);
  if (!ok) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; docId: string }> }) {
  const user = await requireApiUser();
  if (!isUser(user)) return user;
  const { id, docId } = await context.params;
  const ok = await deleteDocument(user.id, id, docId);
  if (!ok) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
