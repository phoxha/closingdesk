"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatStamp } from "@/lib/format";
import type { DocumentRole } from "@/lib/types";

export type WorkspaceDocument = {
  id: string;
  role: DocumentRole;
  filename: string;
  version: number;
  isControlling: boolean;
  extractionStatus: string;
  extractionWarning: string | null;
  pageCount: number;
};

type RunLink = { id: string; createdAt: string; narrative: string };

type Activity = { id: string; action: string; detail: string; createdAt: string };

const SLOTS: Array<{ role: DocumentRole; title: string; hint: string }> = [
  { role: "offer", title: "Accepted offer", hint: "The controlling reference, with any addenda you mark." },
  { role: "psa", title: "Purchase and sale", hint: "Upload a revised draft as a new version and compare again." },
  { role: "addendum", title: "Addenda", hint: "Optional. Controlling addenda amend the offer." },
];

export function MatterWorkspace({
  matterId,
  address,
  clientName,
  matterName,
  sample,
  documents,
  runs,
  activity,
}: {
  matterId: string;
  address: string;
  clientName: string;
  matterName: string;
  sample: boolean;
  documents: WorkspaceDocument[];
  runs: RunLink[];
  activity: Activity[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const hasOffer = documents.some((doc) => doc.role === "offer");
  const hasPsa = documents.some((doc) => doc.role === "psa");
  const latest = runs[runs.length - 1];

  async function upload(role: DocumentRole, file: File | null) {
    if (!file) return;
    setBusy(role);
    setError(null);
    const body = new FormData();
    body.set("role", role);
    body.set("file", file);
    const response = await fetch(`/api/matters/${matterId}/documents`, { method: "POST", body });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) setError(data?.error ?? "The file could not be uploaded.");
    setBusy(null);
    router.refresh();
  }

  async function compare() {
    setBusy("compare");
    setError(null);
    const response = await fetch(`/api/matters/${matterId}/compare`, { method: "POST" });
    const data = (await response.json().catch(() => null)) as { error?: string; runId?: string } | null;
    setBusy(null);
    if (!response.ok || !data?.runId) {
      setError(data?.error ?? "The comparison did not finish.");
      return;
    }
    router.push(`/matters/${matterId}/review?run=${data.runId}`);
  }

  async function reviseSample() {
    setBusy("revision");
    setError(null);
    const response = await fetch(`/api/matters/${matterId}/sample-revision`, { method: "POST" });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) setError(data?.error ?? "The revised sample could not be added.");
    setBusy(null);
    router.refresh();
  }

  async function toggle(doc: WorkspaceDocument) {
    setBusy(doc.id);
    await fetch(`/api/matters/${matterId}/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isControlling: !doc.isControlling }),
    });
    setBusy(null);
    router.refresh();
  }

  async function remove(doc: WorkspaceDocument) {
    if (!window.confirm(`Delete ${doc.filename}? The file is removed from this transaction.`)) return;
    setBusy(doc.id);
    await fetch(`/api/matters/${matterId}/documents/${doc.id}`, { method: "DELETE" });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto px-8 py-8">
      <Link href="/" className="text-sm text-muted underline-offset-2 hover:underline">
        Transactions
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl leading-tight">{address}</h1>
          <p className="mt-2 text-sm text-muted">
            {[clientName, matterName].filter(Boolean).join(" · ") || "No client details"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sample ? (
            <button
              type="button"
              onClick={reviseSample}
              disabled={busy !== null}
              className="rounded-md border border-line bg-panel px-3 py-2 text-sm disabled:opacity-60"
            >
              {busy === "revision" ? "Adding revision…" : "Upload revised sample PSA"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={compare}
            disabled={!hasOffer || !hasPsa || busy !== null}
            className="rounded-md bg-sidebar px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy === "compare" ? "Comparing…" : latest ? "Compare again" : "Compare offer to PSA"}
          </button>
          {latest ? (
            <Link href={`/matters/${matterId}/review`} className="rounded-md border border-line bg-panel px-3 py-2 text-sm">
              Open review
            </Link>
          ) : null}
        </div>
      </div>
      {error ? <p className="mt-4 text-sm text-copper">{error}</p> : null}
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {SLOTS.map((slot) => (
          <section key={slot.role} className="rounded-lg border border-line bg-panel p-4">
            <h2 className="font-serif text-2xl">{slot.title}</h2>
            <p className="mt-1 text-sm leading-5 text-muted">{slot.hint}</p>
            <label className="mt-4 block text-sm">
              <span className="sr-only">Upload {slot.title}</span>
              <input
                type="file"
                accept=".pdf,.docx,application/pdf"
                disabled={busy !== null}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  void upload(slot.role, file);
                  event.target.value = "";
                }}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-sidebar file:px-3 file:py-2 file:text-sm file:text-white"
              />
            </label>
            <ul className="mt-4 space-y-3">
              {documents.filter((doc) => doc.role === slot.role).length === 0 ? (
                <li className="text-sm text-muted">Nothing uploaded.</li>
              ) : null}
              {documents
                .filter((doc) => doc.role === slot.role)
                .map((doc) => (
                  <li key={doc.id} className="rounded-md border border-line px-3 py-2 text-sm">
                    <p className="font-medium">
                      v{doc.version} · {doc.filename}
                    </p>
                    <p className="text-xs text-muted">
                      {doc.pageCount} page{doc.pageCount === 1 ? "" : "s"} · {doc.extractionStatus}
                      {doc.isControlling ? " · controlling" : ""}
                    </p>
                    {doc.extractionWarning ? <p className="mt-1 text-xs text-amber">{doc.extractionWarning}</p> : null}
                    <div className="mt-2 flex gap-3 text-xs">
                      <button type="button" className="underline-offset-2 hover:underline" onClick={() => toggle(doc)}>
                        {doc.isControlling ? "Stop using as controlling" : "Use as controlling"}
                      </button>
                      <button type="button" className="text-copper underline-offset-2 hover:underline" onClick={() => remove(doc)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
      {latest ? (
        <p className="mt-6 max-w-3xl text-sm leading-6 text-muted">{latest.narrative}</p>
      ) : null}
      <section className="mt-8">
        <h2 className="font-serif text-2xl">Activity</h2>
        {activity.length === 0 ? <p className="mt-2 text-sm text-muted">No activity yet.</p> : null}
        <ul className="mt-3 max-w-3xl divide-y divide-line border-y border-line">
          {activity.map((item) => (
            <li key={item.id} className="py-2 text-sm">
              <span className="text-muted">{formatStamp(item.createdAt)}</span>
              <span className="mx-2 text-line">/</span>
              {item.detail}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
