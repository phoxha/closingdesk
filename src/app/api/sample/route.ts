import { NextResponse } from "next/server";
import { isUser, requireApiUser } from "@/lib/auth/current";
import { runComparison } from "@/lib/comparison/run";
import { textToPdf } from "@/lib/documents/extract-text";
import { ingestDocument } from "@/lib/documents/ingest";
import { SAMPLE_OFFER, SAMPLE_PSA } from "@/lib/documents/sample-contracts";
import { createMatter } from "@/lib/store";

export async function POST() {
  const user = await requireApiUser();
  if (!isUser(user)) return user;
  const matter = await createMatter({
    userId: user.id,
    propertyAddress: "148 Commonwealth Avenue, Unit 4, Boston, MA 02116",
    clientName: "Elena Voss",
    matterName: "Voss purchase",
    closingDate: null,
    sample: true,
  });
  const offer = await textToPdf(SAMPLE_OFFER);
  const psa = await textToPdf(SAMPLE_PSA);
  const offerResult = await ingestDocument({
    userId: user.id,
    matterId: matter.id,
    role: "offer",
    filename: "Voss-accepted-offer.pdf",
    mimeType: "application/pdf",
    bytes: offer,
  });
  const psaResult = await ingestDocument({
    userId: user.id,
    matterId: matter.id,
    role: "psa",
    filename: "Voss-purchase-and-sale.pdf",
    mimeType: "application/pdf",
    bytes: psa,
  });
  if ("error" in offerResult || "error" in psaResult) {
    return NextResponse.json({ error: "The sample documents could not be prepared." }, { status: 500 });
  }
  const compared = await runComparison(user.id, matter.id);
  if ("error" in compared) return NextResponse.json({ error: compared.error }, { status: 500 });
  return NextResponse.json({ matterId: matter.id, runId: compared.runId });
}
