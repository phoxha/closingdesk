import { NextResponse } from "next/server";
import { isUser, requireApiUser } from "@/lib/auth/current";
import { textToPdf } from "@/lib/documents/extract-text";
import { ingestDocument } from "@/lib/documents/ingest";
import { SAMPLE_PSA_REVISED } from "@/lib/documents/sample-contracts";
import { getBundle } from "@/lib/store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!isUser(user)) return user;
  const { id } = await context.params;
  const bundle = await getBundle(user.id, id);
  if (!bundle?.matter.sample) {
    return NextResponse.json({ error: "A revised sample is only available on the sample transaction." }, { status: 404 });
  }
  const bytes = await textToPdf(SAMPLE_PSA_REVISED);
  const result = await ingestDocument({
    userId: user.id,
    matterId: id,
    role: "psa",
    filename: "Voss-purchase-and-sale-v2.pdf",
    mimeType: "application/pdf",
    bytes,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ id: result.document.id, version: result.document.version });
}
