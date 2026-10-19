"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES, type PublicUser } from "@/lib/types";

export function Shell({ user, children }: { user: PublicUser; children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex h-screen bg-paper text-ink">
      <aside className="flex w-60 shrink-0 flex-col bg-sidebar text-[#ebe6dc]">
        <div className="px-5 pt-6 pb-5">
          <Link href="/" className="font-serif text-2xl tracking-tight text-white">
            ClosingDesk
          </Link>
          <p className="mt-1 text-xs leading-5 text-[#c9c2b6]">Real estate closings</p>
        </div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Modules">
          {MODULES.map((module) => {
            const href = module.slug === "offer-psa" ? "/" : `/modules/${module.slug}`;
            const active = module.slug === "offer-psa" ? pathname === "/" || pathname.startsWith("/matters") : pathname === href;
            return (
              <Link
                key={module.slug}
                href={href}
                className={`block rounded-md px-3 py-2 text-sm ${active ? "bg-white/10 text-white" : "text-[#d5cec3] hover:bg-white/5"}`}
              >
                <span className="block">{module.name}</span>
                <span className="block text-[11px] tracking-wide text-[#b7b0a4] uppercase">{module.phase}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-5 pt-4 pb-16">
          <p className="text-sm text-white">{user.name}</p>
          <p className="truncate text-xs text-[#b7b0a4]">{user.email}</p>
          <form action="/api/logout" method="post">
            <button type="submit" className="mt-3 text-sm text-[#eadfce] underline-offset-2 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
