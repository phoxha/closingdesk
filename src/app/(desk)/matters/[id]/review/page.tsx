import { notFound, redirect } from "next/navigation";
import { ReviewDesk } from "@/components/ReviewDesk";
import { currentUser } from "@/lib/auth/current";
import { runComparison } from "@/lib/comparison/run";
import { refreshPdfText } from "@/lib/documents/refresh-extraction";
import { getBundle } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ run?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const { run: requested } = await searchParams;
  if (await refreshPdfText(user.id, id)) await runComparison(user.id, id);
  const bundle = await getBundle(user.id, id);
  if (!bundle) notFound();
  const run = bundle.runs.find((item) => item.id === requested) ?? bundle.runs[bundle.runs.length - 1];
  if (!run) redirect(`/matters/${id}`);
  const findings = bundle.findings.filter((finding) => finding.runId === run.id);
  return (
    <ReviewDesk
      matterId={id}
      address={bundle.matter.propertyAddress}
      documents={bundle.documents.map((doc) => ({
        id: doc.id,
        role: doc.role,
        filename: doc.filename,
        version: doc.version,
        mimeType: doc.mimeType,
        pageCount: doc.pageCount,
        extractionWarning: doc.extractionWarning,
        pages: doc.pages,
      }))}
      runId={run.id}
      runs={bundle.runs.map((item) => ({ id: item.id, createdAt: item.createdAt }))}
      summary={run.summary}
      modelNote={run.modelNote}
      findings={findings}
      initialReviews={bundle.reviews}
      initialQuestions={bundle.questions.filter((item) => item.runId === run.id)}
    />
  );
}
