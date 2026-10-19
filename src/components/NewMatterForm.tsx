"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function NewMatterForm() {
  const router = useRouter();
  const [propertyAddress, setPropertyAddress] = useState("");
  const [clientName, setClientName] = useState("");
  const [matterName, setMatterName] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/matters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyAddress, clientName, matterName, closingDate }),
    });
    const data = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
    if (!response.ok || !data?.id) {
      setError(data?.error ?? "The transaction could not be created.");
      setBusy(false);
      return;
    }
    router.push(`/matters/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl">
      <Field id="address" label="Property address" value={propertyAddress} onChange={setPropertyAddress} required />
      <Field id="client" label="Client" value={clientName} onChange={setClientName} />
      <Field id="matter" label="Matter name" value={matterName} onChange={setMatterName} />
      <label className="mt-4 block text-sm" htmlFor="closing">
        Closing date, if known
        <input
          id="closing"
          type="date"
          value={closingDate}
          onChange={(event) => setClosingDate(event.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2"
        />
      </label>
      {error ? <p className="mt-3 text-sm text-copper">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="mt-6 rounded-md bg-sidebar px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Creating…" : "Create transaction"}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="mt-4 block text-sm" htmlFor={id}>
      {label}
      <input
        id={id}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2"
      />
    </label>
  );
}
