"use client";

import { useState } from "react";
import { formatStamp } from "@/lib/format";
import type { DocQuestion } from "@/lib/types";

const SUGGESTIONS = [
  "Why do the closing dates differ?",
  "Do the purchase prices match?",
  "What is missing from the purchase agreement?",
];

export function QuestionsPanel({
  matterId,
  runId,
  initialQuestions,
  selectedTitle,
}: {
  matterId: string;
  runId: string;
  initialQuestions: DocQuestion[];
  selectedTitle: string | null;
}) {
  const [open, setOpen] = useState(true);
  const [questions, setQuestions] = useState(initialQuestions);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(text: string) {
    const question = text.trim();
    if (question.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/matters/${matterId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, runId }),
    });
    const data = (await response.json().catch(() => null)) as { question?: DocQuestion; error?: string } | null;
    setBusy(false);
    if (!response.ok || !data?.question) {
      setError(data?.error ?? "The question could not be answered.");
      return;
    }
    setQuestions((current) => [...current, data.question!]);
    setDraft("");
  }

  return (
    <section className="border-b border-line bg-panel">
      <div className="flex items-center justify-between gap-3 px-5 py-2">
        <h2 className="text-sm font-semibold">Questions</h2>
        <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-md border border-line bg-paper px-2 py-1 text-xs">
          {open ? "Collapse" : `Show questions${questions.length ? ` · ${questions.length}` : ""}`}
        </button>
      </div>
      {open ? (
        <div className="px-5 pb-3">
          <p className="text-xs leading-5 text-muted">
            Ask about the accepted offer, the purchase agreement, or this review. Answers stay with the transaction and are not a legal determination.
          </p>
          <div className="mt-2 max-h-64 space-y-3 overflow-auto">
            {questions.length === 0 ? <p className="text-sm text-muted">No questions yet.</p> : null}
            {questions.map((item) => (
              <article key={item.id} className="rounded-md border border-line bg-white px-3 py-2">
                <p className="text-sm font-medium">{item.question}</p>
                <p className="mt-1 text-sm leading-6">{item.answer}</p>
                {item.offerQuote ? <Quote label="Accepted offer" quote={item.offerQuote} /> : null}
                {item.psaQuote ? <Quote label="Purchase agreement" quote={item.psaQuote} /> : null}
                <p className="mt-1 text-xs text-muted">{formatStamp(item.createdAt)}</p>
              </article>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setDraft(suggestion)}
                className="rounded-full bg-paper px-2.5 py-1 text-xs text-muted"
              >
                {suggestion}
              </button>
            ))}
            {selectedTitle ? (
              <button
                type="button"
                onClick={() => setDraft(`What should I know about ${selectedTitle}?`)}
                className="rounded-full bg-paper px-2.5 py-1 text-xs text-muted"
              >
                Ask about {selectedTitle}
              </button>
            ) : null}
          </div>
          <form
            className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(draft);
            }}
          >
            <label className="min-w-0 flex-1 text-xs text-muted" htmlFor="document-question">
              Question
              <textarea
                id="document-question"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={2}
                placeholder="Ask about a date, amount, party, or finding"
                className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1 text-sm text-ink"
              />
            </label>
            <button type="submit" disabled={busy || draft.trim().length < 3} className="rounded-md bg-sidebar px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? "Looking…" : "Ask"}
            </button>
          </form>
          {error ? <p className="mt-2 text-xs text-copper">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function Quote({ label, quote }: { label: string; quote: string }) {
  return (
    <p className="mt-2 text-xs leading-5 text-muted">
      <span className="tracking-wide uppercase">{label}. </span>
      {quote}
    </p>
  );
}
