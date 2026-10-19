"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import { QuestionsPanel } from "@/components/QuestionsPanel";
import { formatStamp } from "@/lib/format";
import { highlightSegments } from "@/lib/highlight";
import { isOpenFinding, latestReview } from "@/lib/review-state";
import {
  ACTION_LABELS,
  CATEGORIES,
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  type AttorneyReview,
  type CompareSummary,
  type DocQuestion,
  type DocumentRole,
  type Finding,
  type FindingStatus,
  type ReviewAction,
} from "@/lib/types";

type DeskDocument = {
  id: string;
  role: DocumentRole;
  filename: string;
  version: number;
  mimeType: string;
  pageCount: number;
  extractionWarning: string | null;
  pages: Array<{ page: number; text: string }>;
};

const SUMMARY_FIELDS = new Set([
  "property_address",
  "parcel",
  "buyer",
  "seller",
  "purchase_price",
  "earnest_deposit",
  "financing",
  "closing",
  "inspection",
  "due_diligence",
  "appraisal",
  "property_condition",
  "included_items",
  "title_deed",
  "possession",
  "residence_sale",
  "assignment",
  "time_of_essence",
]);

const ROW_TONE: Record<FindingStatus, string> = {
  MATCH: "",
  EQUIVALENT: "",
  DISCREPANCY: "bg-[#f8e8e1]",
  MISSING: "bg-[#f8e8e1]",
  NEW_TERM: "bg-[#f8efd9]",
  UNCLEAR: "bg-[#f4f0e8]",
};

const FILTERS: Array<{ id: string; label: string }> = [
  { id: "open", label: "Open" },
  { id: "all", label: "All" },
  { id: "DISCREPANCY", label: "Discrepancies" },
  { id: "MISSING", label: "Missing" },
  { id: "NEW_TERM", label: "New" },
  { id: "UNCLEAR", label: "Unclear" },
  { id: "EQUIVALENT", label: "Equivalent" },
  { id: "MATCH", label: "Matches" },
];

const STATUS_TONE: Record<FindingStatus, string> = {
  MATCH: "bg-[#e5f2ea] text-forest",
  EQUIVALENT: "bg-[#e4f0ec] text-moss",
  DISCREPANCY: "bg-[#f8e8e1] text-copper",
  MISSING: "bg-[#f8e8e1] text-copper",
  NEW_TERM: "bg-[#f8efd9] text-amber",
  UNCLEAR: "bg-[#ece7dc] text-muted",
};

export function ReviewDesk({
  matterId,
  address,
  documents,
  runId,
  runs,
  summary,
  modelNote,
  findings,
  initialReviews,
  initialQuestions,
}: {
  matterId: string;
  address: string;
  documents: DeskDocument[];
  runId: string;
  runs: Array<{ id: string; createdAt: string }>;
  summary: CompareSummary;
  modelNote: string | null;
  findings: Finding[];
  initialReviews: AttorneyReview[];
  initialQuestions: DocQuestion[];
}) {
  const router = useRouter();
  const [reviews, setReviews] = useState(initialReviews);
  const [filter, setFilter] = useState("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pane, setPane] = useState<"offer" | "psa">("offer");
  const [reviewOpen, setReviewOpen] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    return findings.filter((finding) => {
      if (filter === "all") return true;
      if (filter === "open") return isOpenFinding(finding, reviews);
      return finding.status === filter;
    });
  }, [filter, findings, reviews]);

  const selected = findings.find((finding) => finding.id === selectedId) ?? visible[0] ?? findings[0] ?? null;
  const openCount = findings.filter((finding) => isOpenFinding(finding, reviews)).length;
  const summaryRows = useMemo(() => summaryFindings(findings), [findings]);
  const summaryConflicts = summaryRows.filter((finding) => finding.status === "DISCREPANCY" || finding.status === "MISSING").length;
  const note = selected ? notes[selected.id] ?? "" : "";

  const offerDoc =
    documents.find((doc) => doc.id === selected?.offerDocumentId) ??
    documents.find((doc) => doc.role === "offer") ??
    null;
  const psaDoc = documents.find((doc) => doc.id === selected?.psaDocumentId) ?? documents.find((doc) => doc.role === "psa") ?? null;

  async function act(action: ReviewAction) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/matters/${matterId}/findings/${selected.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    const data = (await response.json().catch(() => null)) as { review?: AttorneyReview; error?: string } | null;
    setBusy(false);
    if (!response.ok || !data?.review) {
      setError(data?.error ?? "The review could not be saved.");
      return;
    }
    setReviews((current) => [...current, data.review!]);
    if (selected) setNotes((current) => ({ ...current, [selected.id]: "" }));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div>
          <Link href={`/matters/${matterId}`} className="text-xs text-muted underline-offset-2 hover:underline">
            Back to documents
          </Link>
          <h1 className="font-serif text-2xl leading-tight">{address}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {runs.length > 1 ? (
            <label>
              <span className="sr-only">Comparison run</span>
              <select
                value={runId}
                onChange={(event) => {
                  router.push(`/matters/${matterId}/review?run=${event.target.value}`);
                }}
                className="rounded-md border border-line bg-panel px-2 py-1.5"
              >
                {runs.map((run, index) => (
                  <option key={run.id} value={run.id}>
                    Run {index + 1} · {formatStamp(run.createdAt)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Link href={`/matters/${matterId}/report?run=${runId}`} className="rounded-md border border-line bg-panel px-3 py-1.5">
            Report
          </Link>
          <a href={`/api/matters/${matterId}/report?run=${runId}`} className="rounded-md bg-sidebar px-3 py-1.5 font-semibold text-white">
            Download PDF
          </a>
        </div>
      </header>
      <div className="max-h-[42vh] shrink-0 overflow-y-auto">
      <SummaryCompare
        open={summaryOpen}
        conflicts={summaryConflicts}
        rows={summaryRows}
        selectedId={selected?.id ?? null}
        onToggle={() => setSummaryOpen((open) => !open)}
        onSelect={(id) => setSelectedId(id)}
      />
      <section className={`border-b border-line bg-panel ${reviewOpen ? "max-h-80 overflow-y-auto" : ""}`}>
        {reviewOpen ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">Review</h2>
                <p className="mt-1 text-sm leading-5 text-muted">{summary.narrative}</p>
                {modelNote ? <p className="mt-1 text-xs leading-5 text-muted">{modelNote}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                  <Count label="Align" value={summary.match + summary.equivalent} />
                  <Count label="Conflicts" value={summary.discrepancy} />
                  <Count label="Review" value={summary.missing + summary.newTerm + summary.unclear} />
                </dl>
                <button
                  type="button"
                  onClick={() => setReviewOpen(false)}
                  className="shrink-0 rounded-md border border-line bg-paper px-2 py-1 text-xs"
                >
                  Collapse
                </button>
              </div>
            </div>
            <div className="flex gap-1 overflow-x-auto border-t border-line px-5 py-2">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${filter === item.id ? "bg-sidebar text-white" : "bg-paper text-muted"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto px-5 pb-3">
              {visible.length === 0 ? <p className="text-sm text-muted">Nothing in this filter.</p> : null}
              {visible.map((finding) => {
                const decision = latestReview(finding.id, reviews);
                const active = finding.id === selected?.id;
                return (
                  <button
                    key={finding.id}
                    type="button"
                    onClick={() => setSelectedId(finding.id)}
                    className={`w-56 shrink-0 rounded-md border px-3 py-2 text-left ${active ? "border-copper bg-white" : "border-line bg-paper"}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium">{finding.title}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[11px] ${STATUS_TONE[finding.status]}`}>
                        {STATUS_LABELS[finding.status]}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {CATEGORY_LABELS[finding.category]} · {SEVERITY_LABELS[finding.severity]}
                    </span>
                    {decision ? (
                      <span className="mt-1 block truncate text-xs text-moss">
                        {ACTION_LABELS[decision.action]}
                        {decision.note ? ` — ${decision.note}` : ""}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {selected ? (
              <div className="grid gap-3 border-t border-line px-5 py-3 text-sm lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <p className="leading-6">{selected.explanation}</p>
                  <label className="mt-3 block text-xs text-muted" htmlFor="note">
                    Internal note
                    <textarea
                      id="note"
                      value={note}
                      onChange={(event) => {
                        const value = event.target.value;
                        setNotes((current) => ({ ...current, [selected.id]: value }));
                      }}
                      rows={2}
                      className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1 text-sm text-ink"
                    />
                  </label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <ActionButton busy={busy} onClick={() => act("confirm")}>Confirm finding</ActionButton>
                    <ActionButton busy={busy} onClick={() => act("acceptable")}>Mark acceptable</ActionButton>
                    <ActionButton busy={busy} onClick={() => act("revision")}>Request revision</ActionButton>
                    <ActionButton busy={busy} onClick={() => act("note")}>Add note</ActionButton>
                    <ActionButton busy={busy} onClick={() => act("resolved")}>Mark resolved</ActionButton>
                  </div>
                  {error ? <p className="mt-2 text-xs text-copper">{error}</p> : null}
                </div>
                <Quote label="Offer" quote={selected.offerQuote} page={selected.offerPage} section={selected.offerSection} />
                <Quote label="Purchase agreement" quote={selected.psaQuote} page={selected.psaPage} section={selected.psaSection} />
              </div>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            className="flex w-full items-center justify-between gap-3 px-5 py-2 text-left text-sm"
            aria-label={`Show review, ${openCount} open`}
          >
            <span className="font-semibold">Review</span>
            <span className="text-xs text-muted">{openCount} open · Show review</span>
          </button>
        )}
      </section>
      <QuestionsPanel matterId={matterId} runId={runId} initialQuestions={initialQuestions} selectedTitle={selected?.title ?? null} />
      </div>
      <div className="flex shrink-0 gap-2 border-b border-line px-5 py-2 xl:hidden">
        {(
          [
            ["offer", "Offer"],
            ["psa", "PSA"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPane(id)}
            className={`rounded-md px-3 py-1 text-sm ${pane === id ? "bg-sidebar text-white" : "bg-panel"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid min-h-64 flex-1 grid-cols-1 xl:grid-cols-2">
        <DocumentPane
          key={`offer-${offerDoc?.id ?? "none"}-${selected?.id ?? "none"}`}
          side="offer"
          title="Accepted offer"
          matterId={matterId}
          document={offerDoc}
          quote={selected?.offerQuote ?? ""}
          page={selected?.offerPage ?? null}
          hidden={pane !== "offer"}
        />
        <DocumentPane
          key={`psa-${psaDoc?.id ?? "none"}-${selected?.id ?? "none"}`}
          side="psa"
          title="Purchase agreement"
          matterId={matterId}
          document={psaDoc}
          quote={selected?.psaQuote ?? ""}
          page={selected?.psaPage ?? null}
          hidden={pane !== "psa"}
        />
      </div>
    </div>
  );
}

function summaryFindings(findings: Finding[]): Finding[] {
  const rank: Record<FindingStatus, number> = {
    DISCREPANCY: 0,
    MISSING: 1,
    NEW_TERM: 2,
    UNCLEAR: 3,
    EQUIVALENT: 4,
    MATCH: 5,
  };
  return findings
    .filter((finding) => SUMMARY_FIELDS.has(finding.provisionId) || finding.severity === "high" || finding.severity === "medium")
    .sort((a, b) => {
      const category = CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category);
      return category || rank[a.status] - rank[b.status] || a.title.localeCompare(b.title);
    });
}

function fieldValue(finding: Finding, side: "offer" | "psa"): string {
  const value = side === "offer" ? finding.offerValue : finding.psaValue;
  if (value) return value;
  if (side === "offer" && finding.status === "NEW_TERM") return "Not in the offer";
  if (side === "psa" && finding.status === "MISSING") return "Not in the purchase agreement";
  return "—";
}

function SummaryCompare({
  open,
  conflicts,
  rows,
  selectedId,
  onToggle,
  onSelect,
}: {
  open: boolean;
  conflicts: number;
  rows: Finding[];
  selectedId: string | null;
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  const groups = CATEGORIES.map((category) => ({
    category,
    rows: rows.filter((finding) => finding.category === category),
  })).filter((group) => group.rows.length > 0);

  return (
    <section className="border-b border-line bg-panel">
      <div className="flex items-center justify-between gap-3 px-5 py-2">
        <h2 className="text-sm font-semibold">
          Summary comparison
          {conflicts ? <span className="ml-2 font-normal text-copper">{conflicts} to review</span> : null}
        </h2>
        <button type="button" onClick={onToggle} className="rounded-md border border-line bg-paper px-2 py-1 text-xs">
          {open ? "Hide summary" : `Show summary${conflicts ? ` · ${conflicts} to review` : ""}`}
        </button>
      </div>
      {open ? (
        <div className="max-h-64 overflow-auto px-5 pb-3">
          {rows.length === 0 ? <p className="text-sm text-muted">No material terms were extracted for this comparison.</p> : null}
          {rows.length > 0 ? (
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-panel">
                <tr className="border-b border-line text-xs tracking-wide text-muted uppercase">
                  <th className="px-2 py-2 font-medium">Field</th>
                  <th className="px-2 py-2 font-medium">Accepted offer</th>
                  <th className="px-2 py-2 font-medium">Purchase agreement</th>
                  <th className="px-2 py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <Fragment key={group.category}>
                    <tr>
                      <th className="bg-paper px-2 pt-3 pb-1 text-left text-xs font-semibold tracking-wide text-muted uppercase" colSpan={4}>
                        {CATEGORY_LABELS[group.category]}
                      </th>
                    </tr>
                    {group.rows.map((finding) => {
                      const attention = finding.status === "DISCREPANCY" || finding.status === "MISSING" || finding.status === "NEW_TERM";
                      return (
                        <tr
                          key={finding.id}
                          tabIndex={0}
                          onClick={() => onSelect(finding.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onSelect(finding.id);
                            }
                          }}
                          className={`cursor-pointer border-b border-line ${ROW_TONE[finding.status]} ${finding.id === selectedId ? "outline outline-1 outline-copper" : "hover:bg-white/70"}`}
                        >
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap">{finding.title}</th>
                          <td className={`max-w-80 px-2 py-2 align-top leading-5 ${finding.status === "DISCREPANCY" ? "font-semibold text-copper" : attention ? "font-semibold" : ""}`}>
                            <span className="line-clamp-2">{fieldValue(finding, "offer")}</span>
                          </td>
                          <td className={`max-w-80 px-2 py-2 align-top leading-5 ${finding.status === "DISCREPANCY" ? "font-semibold text-copper" : attention ? "font-semibold" : ""}`}>
                            <span className="line-clamp-2">{fieldValue(finding, "psa")}</span>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <span className={`rounded px-1.5 py-0.5 text-[11px] ${STATUS_TONE[finding.status]}`}>{STATUS_LABELS[finding.status]}</span>
                          </td>
                        </tr>
                    );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-paper px-2 py-1">
      <dt className="text-muted">{label}</dt>
      <dd className="text-base font-semibold text-ink">{value}</dd>
    </div>
  );
}

function Quote({ label, quote, page, section }: { label: string; quote: string; page: number | null; section: string | null }) {
  return (
    <div className="mt-3">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 line-clamp-3 text-sm leading-5">{quote || "No source text."}</p>
      <p className="text-xs text-muted">{[section, page ? `page ${page}` : null].filter(Boolean).join(" · ") || "No page reference"}</p>
    </div>
  );
}

function ActionButton({ busy, onClick, children }: { busy: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" disabled={busy} onClick={onClick} className="rounded border border-line px-2 py-1 text-xs hover:bg-paper disabled:opacity-50">
      {children}
    </button>
  );
}

function DocumentPane({
  side,
  title,
  matterId,
  document,
  quote,
  page,
  hidden,
}: {
  side: "offer" | "psa";
  title: string;
  matterId: string;
  document: DeskDocument | null;
  quote: string;
  page: number | null;
  hidden: boolean;
}) {
  const [mode, setMode] = useState<"text" | "original">("text");
  const [search, setSearch] = useState("");
  const [activePage, setActivePage] = useState<number | null>(page);

  useEffect(() => {
    const mark = globalThis.document.getElementById(`hit-${side}`);
    mark?.scrollIntoView({ block: "center" });
  }, [quote, document?.id, side, mode]);

  return (
    <section className={`${hidden ? "hidden" : "flex"} min-h-0 flex-col border-r border-line xl:flex`}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="truncate text-xs text-muted">{document ? `v${document.version} · ${document.filename}` : "No document"}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={() => setMode("text")} className={`rounded px-2 py-1 text-xs ${mode === "text" ? "bg-sidebar text-white" : "bg-paper"}`}>
            Text
          </button>
          <button type="button" onClick={() => setMode("original")} className={`rounded px-2 py-1 text-xs ${mode === "original" ? "bg-sidebar text-white" : "bg-paper"}`}>
            Original
          </button>
        </div>
      </div>
      {document?.extractionWarning ? <p className="border-b border-line px-3 py-2 text-xs text-amber">{document.extractionWarning}</p> : null}
      {mode === "text" ? (
        <>
          <div className="flex gap-2 border-b border-line px-3 py-2">
            <label className="min-w-0 flex-1 text-xs">
              <span className="sr-only">Search {title}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search text"
                className="w-full rounded border border-line bg-panel px-2 py-1 text-sm"
              />
            </label>
            <label className="text-xs">
              <span className="sr-only">Page</span>
              <select
                value={activePage ?? document?.pages[0]?.page ?? ""}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setActivePage(next);
                  globalThis.document.getElementById(`page-${side}-${next}`)?.scrollIntoView({ block: "start" });
                }}
                className="rounded border border-line bg-panel px-2 py-1"
              >
                {(document?.pages ?? []).map((item) => (
                  <option key={item.page} value={item.page}>
                    Page {item.page}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
            {document?.pages.map((item) => (
              <article key={item.page} id={`page-${side}-${item.page}`} className="mb-6">
                <h3 className="mb-2 text-xs tracking-wide text-muted uppercase">Page {item.page}</h3>
                <p className="font-serif text-[15px] leading-7 whitespace-pre-wrap">
                  <Highlighted text={item.text} quote={item.page === page ? quote : ""} search={search} side={side} />
                </p>
              </article>
            ))}
            {!document ? <p className="text-sm text-muted">The source document is no longer on this transaction.</p> : null}
          </div>
        </>
      ) : document?.mimeType === "application/pdf" ? (
        <iframe
          title={title}
          key={`${document.id}-${page ?? 1}`}
          src={`/api/matters/${matterId}/documents/${document.id}/file#page=${page ?? activePage ?? 1}`}
          className="min-h-0 w-full flex-1 bg-white"
        />
      ) : (
        <p className="px-4 py-6 text-sm text-muted">
          The original Word file is available as text here.{" "}
          {document ? (
            <a className="underline" href={`/api/matters/${matterId}/documents/${document.id}/file`}>
              Download {document.filename}
            </a>
          ) : null}
        </p>
      )}
    </section>
  );
}

function Highlighted({ text, quote, search, side }: { text: string; quote: string; search: string; side: string }) {
  const needles = [quote, search].filter((item) => item.trim().length >= 4);
  const parts = highlightSegments(text, needles);
  const firstHit = parts.findIndex((part) => part.hit);
  return (
    <>
      {parts.map((part, index) => {
        if (!part.hit) return <span key={index}>{part.text}</span>;
        return (
          <mark key={index} id={index === firstHit && quote ? `hit-${side}` : undefined} className="bg-[#f3d2c3] text-ink">
            {part.text}
          </mark>
        );
      })}
    </>
  );
}
