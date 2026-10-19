"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) return "/";
  return value;
}

function Form({ hint }: { hint: string | null }) {
  const params = useSearchParams();
  const error = params.get("error");
  return (
    <form method="post" action="/api/login" className="w-full max-w-sm">
      <h2 className="font-serif text-3xl text-ink">Sign in</h2>
      <p className="mt-2 text-sm leading-6 text-muted">Attorney access for this office.</p>
      <input type="hidden" name="next" value={safeNext(params.get("next"))} />
      <label className="mt-8 block text-sm" htmlFor="email">
        Email
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2"
          required
        />
      </label>
      <label className="mt-4 block text-sm" htmlFor="password">
        Password
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2"
          required
        />
      </label>
      {error ? <p className="mt-3 text-sm text-copper">Email or password is not valid.</p> : null}
      <button type="submit" className="mt-6 w-full rounded-md bg-sidebar px-4 py-2.5 text-sm font-semibold text-white">
        Sign in
      </button>
      {hint ? <p className="mt-4 text-xs leading-5 text-muted">Local sign-in: {hint}</p> : null}
    </form>
  );
}

export function LoginForm({ hint }: { hint: string | null }) {
  return (
    <Suspense>
      <Form hint={hint} />
    </Suspense>
  );
}
