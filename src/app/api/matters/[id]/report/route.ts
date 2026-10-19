import { NextResponse } from "next/server";
import { isUser, requireApiUser } from "@/lib/auth/current";
import { buildReportModel } from "@/lib/report/model";
import { renderReportPdf } from "@/lib/report/pdf";
import { getBundle, recordReportDownload } from "@/lib/store";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!isUser(user)) return user;
  const { id } = await context.params;
  const bundle = await getBundle(user.id, id);
  if (!bundle) return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  const requested = new URL(request.url).searchParams.get("run");
  const run = bundle.runs.find((item) => item.id === requested) ?? bundle.runs[bundle.runs.length - 1];
  if (!run) return NextResponse.json({ error: "Compare the documents before downloading a report." }, { status: 400 });
  const findings = bundle.findings.filter((finding) => finding.runId === run.id);
  const model = buildReportModel({
    matter: bundle.matter,
    documents: bundle.documents,
    findings,
    reviews: bundle.reviews,
    narrative: run.summary.narrative,
    preparedAt: new Date().toISOString(),
  });
  const pdf = await renderReportPdf(model);
  await recordReportDownload(user.id, id);
  const filename = `ClosingDesk-verification.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
