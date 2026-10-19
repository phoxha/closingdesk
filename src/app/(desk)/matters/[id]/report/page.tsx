import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current";
import { formatDay, formatStamp } from "@/lib/format";
import { buildReportModel } from "@/lib/report/model";
import { getBundle } from "@/lib/store";
import { ACTION_LABELS, type ReviewAction } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReportPage({
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
  const bundle = await getBundle(user.id, id);
  if (!bundle) notFound();
  const run = bundle.runs.find((item) => item.id === requested) ?? bundle.runs[bundle.runs.length - 1];
  if (!run) redirect(`/matters/${id}`);
  const findings = bundle.findings.filter((finding) => finding.runId === run.id);
  const model = buildReportModel({
    matter: bundle.matter,
    documents: bundle.documents,
    findings,
    reviews: bundle.reviews,
    narrative: run.summary.narrative,
    preparedAt: new Date().toISOString(),
  });

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#e7e1d6] px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href={`/matters/${id}/review?run=${run.id}`} className="text-sm text-muted underline-offset-2 hover:underline">
            Back to review
          </Link>
          <a href={`/api/matters/${id}/report?run=${run.id}`} className="rounded-md bg-sidebar px-3 py-2 text-sm font-semibold text-white">
            Download PDF
          </a>
        </div>
        <article className="bg-white px-10 py-12 shadow-sm">
          <p className="text-xs tracking-[0.18em] text-copper">CLOSINGDESK</p>
          <h1 className="mt-2 font-serif text-4xl">{model.title}</h1>
          <p className="mt-4 text-sm leading-6 text-muted">{model.disclaimer}</p>
          <Section title="Transaction">
            <p>Property: {model.propertyAddress}</p>
            <p>Client: {model.clientName || "—"}</p>
            <p>Matter: {model.matterName || "—"}</p>
            <p>Closing date on file: {formatDay(model.closingDate)}</p>
            <p>Prepared: {formatStamp(model.preparedAt)}</p>
          </Section>
          <Section title="Documents compared">
            {model.documents.length === 0 ? <p>No document records were attached.</p> : null}
            {model.documents.map((doc) => (
              <p key={`${doc.role}-${doc.version}-${doc.filename}`}>
                {doc.role}, version {doc.version}: {doc.filename} ({doc.pages} page{doc.pages === 1 ? "" : "s"}, extraction {doc.extraction})
              </p>
            ))}
          </Section>
          <Section title="Summary">
            <p>{model.narrative}</p>
            <p className="mt-2">{model.counts.map((count) => `${count.label} ${count.value}`).join(" · ")}</p>
          </Section>
          <RowSection title="Confirmed matching terms" rows={model.aligned} empty="No matching terms were confirmed." />
          <RowSection title="Material differences" rows={model.differences} empty="No conflicting terms were found." />
          <RowSection title="Missing or new provisions requiring review" rows={model.reviewItems} empty="No missing, new, or unclear provisions were flagged." />
          <Section title="Attorney comments and resolutions">
            {model.comments.length === 0 ? <p>No attorney comments have been recorded.</p> : null}
            {model.comments.map((comment, index) => (
              <p key={`${comment.title}-${index}`}>
                {comment.title} — {ACTION_LABELS[comment.action as ReviewAction] ?? comment.action}
                {comment.note ? `. ${comment.note}` : "."} {formatStamp(comment.at)}
              </p>
            ))}
          </Section>
          <RowSection title="Outstanding items" rows={model.outstanding} empty="No items remain open." />
          <p className="mt-8 text-xs text-muted">Word export is planned for a later release.</p>
        </article>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="border-b border-line pb-1 font-serif text-2xl">{title}</h2>
      <div className="mt-3 space-y-1 text-sm leading-6">{children}</div>
    </section>
  );
}

function RowSection({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{
    title: string;
    category: string;
    status: string;
    severity: string;
    explanation: string;
    offerQuote: string;
    offerRef: string;
    psaQuote: string;
    psaRef: string;
    decision: string;
  }>;
  empty: string;
}) {
  return (
    <Section title={title}>
      {rows.length === 0 ? <p>{empty}</p> : null}
      {rows.map((row) => (
        <div key={`${row.title}-${row.status}`} className="border-b border-line py-3 last:border-0">
          <p className="font-medium">
            {row.title} · {row.category} · {row.status} · {row.severity}
          </p>
          <p>{row.explanation}</p>
          {row.offerQuote ? <p className="text-muted">Offer ({row.offerRef}): {row.offerQuote}</p> : null}
          {row.psaQuote ? <p className="text-muted">Purchase agreement ({row.psaRef}): {row.psaQuote}</p> : null}
          <p>Attorney: {row.decision}</p>
        </div>
      ))}
    </Section>
  );
}
