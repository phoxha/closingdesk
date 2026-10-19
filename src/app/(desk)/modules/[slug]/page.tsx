import Link from "next/link";
import { notFound } from "next/navigation";
import { MODULES } from "@/lib/types";

export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const planned = MODULES.find((item) => item.slug === slug && item.phase === "Planned");
  if (!planned) notFound();
  return (
    <div className="min-h-0 flex-1 overflow-auto px-8 py-8">
      <Link href="/" className="text-sm text-muted underline-offset-2 hover:underline">
        Transactions
      </Link>
      <p className="mt-6 text-xs tracking-wide text-amber uppercase">Planned</p>
      <h1 className="mt-2 font-serif text-4xl">{planned.name}</h1>
      <p className="mt-4 max-w-xl text-base leading-7">{planned.summary}</p>
      <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
        This module is not in the current release. Offer versus purchase agreement is the working review.
      </p>
    </div>
  );
}
