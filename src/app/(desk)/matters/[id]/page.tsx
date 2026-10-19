import { notFound, redirect } from "next/navigation";
import { MatterWorkspace } from "@/components/MatterWorkspace";
import { currentUser } from "@/lib/auth/current";
import { runComparison } from "@/lib/comparison/run";
import { refreshPdfText } from "@/lib/documents/refresh-extraction";
import { getBundle } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function MatterPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (await refreshPdfText(user.id, id)) await runComparison(user.id, id);
  const bundle = await getBundle(user.id, id);
  if (!bundle) notFound();
  return (
    <MatterWorkspace
      matterId={bundle.matter.id}
      address={bundle.matter.propertyAddress}
      clientName={bundle.matter.clientName}
      matterName={bundle.matter.matterName}
      sample={bundle.matter.sample}
      documents={bundle.documents.map((doc) => ({
        id: doc.id,
        role: doc.role,
        filename: doc.filename,
        version: doc.version,
        isControlling: doc.isControlling,
        extractionStatus: doc.extractionStatus,
        extractionWarning: doc.extractionWarning,
        pageCount: doc.pageCount,
      }))}
      runs={bundle.runs.map((run) => ({ id: run.id, createdAt: run.createdAt, narrative: run.summary.narrative }))}
      activity={bundle.audit.map((item) => ({
        id: item.id,
        action: item.action,
        detail: item.detail,
        createdAt: item.createdAt,
      }))}
    />
  );
}
