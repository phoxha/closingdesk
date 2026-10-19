import Link from "next/link";
import { NewMatterForm } from "@/components/NewMatterForm";

export default function NewMatterPage() {
  return (
    <div className="min-h-0 flex-1 overflow-auto px-8 py-8">
      <Link href="/" className="text-sm text-muted underline-offset-2 hover:underline">
        Transactions
      </Link>
      <h1 className="mt-3 font-serif text-4xl">New transaction</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
        The address identifies the file. Client and matter details are optional and stay on the report.
      </p>
      <div className="mt-6">
        <NewMatterForm />
      </div>
    </div>
  );
}
