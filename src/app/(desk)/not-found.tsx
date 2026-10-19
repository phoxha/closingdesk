import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-8 py-16">
      <h1 className="font-serif text-4xl">That transaction is not on this desk.</h1>
      <Link href="/" className="mt-4 inline-block text-sm underline-offset-2 hover:underline">
        Back to transactions
      </Link>
    </div>
  );
}
