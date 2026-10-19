"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatStamp } from "@/lib/format";
import type { MatterRow } from "@/lib/store";

export function Dashboard({ rows, name }: { rows: MatterRow[]; name: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => `${row.propertyAddress} ${row.clientName} ${row.matterName}`.toLowerCase().includes(needle));
  }, [query, rows]);

  async function loadSample() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/sample", { method: "POST" });
    const data = (await response.json().catch(() => null)) as { matterId?: string; error?: string } | null;
    if (!response.ok || !data?.matterId) {
      setError(data?.error ?? "The sample transaction could not be created.");
      setBusy(false);
      return;
    }
    router.push(`/matters/${data.matterId}`);
    router.refresh();
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto px-8 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{name}</p>
          <h1 className="font-serif text-4xl tracking-tight">Transactions</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadSample}
            disabled={busy}
            className="rounded-md border border-line bg-panel px-3 py-2 text-sm disabled:opacity-60"
          >
            {busy ? "Preparing sample…" : "Load sample"}
          </button>
          <Link href="/matters/new" className="rounded-md bg-sidebar px-3 py-2 text-sm font-semibold text-white">
            New transaction
          </Link>
        </div>
      </div>
      {error ? <p className="mt-4 text-sm text-copper">{error}</p> : null}
      <label className="mt-6 block max-w-md text-sm" htmlFor="matter-search">
        <span className="sr-only">Search transactions</span>
        <input
          id="matter-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search address, client, or matter"
          className="w-full rounded-md border border-line bg-panel px-3 py-2"
        />
      </label>
      {shown.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-line bg-panel px-6 py-12">
          <p className="font-serif text-2xl">No transactions yet.</p>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
            Start a file with the property address, then upload the accepted offer and the purchase agreement.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-line bg-panel">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Property</th>
                <th className="px-4 py-3 font-medium">Client / matter</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Documents</th>
                <th className="px-4 py-3 font-medium">Reviewed</th>
                <th className="px-4 py-3 font-medium">Open</th>
                <th className="px-4 py-3 font-medium">Closing</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0 hover:bg-[#f3efe6]">
                  <td className="px-4 py-3">
                    <Link href={`/matters/${row.id}`} className="font-medium text-ink underline-offset-2 hover:underline">
                      {row.propertyAddress}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {row.clientName || "—"}
                    {row.matterName ? <span className="block text-xs">{row.matterName}</span> : null}
                  </td>
                  <td className="px-4 py-3">{row.phase}</td>
                  <td className="px-4 py-3">{row.documentsLabel}</td>
                  <td className="px-4 py-3">{formatStamp(row.latestReview)}</td>
                  <td className="px-4 py-3">{row.openIssues == null ? "—" : row.openIssues}</td>
                  <td className="px-4 py-3">{row.closingLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
