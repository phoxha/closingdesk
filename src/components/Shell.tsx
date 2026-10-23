"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MODULES, type PublicUser } from "@/lib/types";

const STORAGE_KEY = "closingdesk-sidebar";

const ICONS: Record<string, React.ReactNode> = {
  "offer-psa": (
    <>
      <rect x="2.5" y="3.5" width="6.5" height="13" rx="1" />
      <rect x="11" y="3.5" width="6.5" height="13" rx="1" />
    </>
  ),
  "closing-documents": (
    <>
      <path d="M3.5 7.5h4.2l1.4 1.6H16.5v7.4h-13z" />
      <path d="M3.5 7.5V6.2A1.2 1.2 0 0 1 4.7 5h3.1l1.3 1.4" />
    </>
  ),
  "title-insurance": <path d="M10 2.6 16.4 5.1v5c0 3.3-2.3 6-6.4 7.3C5.9 16.1 3.6 13.4 3.6 10.1v-5z" />,
  checklist: (
    <>
      <path d="M8.5 5.5h8" />
      <path d="M8.5 10h8" />
      <path d="M8.5 14.5h6" />
      <path d="M3.2 5.4 4.5 6.7 6.6 4.4" />
      <path d="M3.2 9.9 4.5 11.2 6.6 8.9" />
      <path d="M3.2 14.4 4.5 15.7 6.6 13.4" />
    </>
  ),
  settlement: <path d="M10 3.2v13.6M13.4 6.2c-.6-.8-1.7-1.3-3.4-1.3-1.9 0-3.1.9-3.1 2.2 0 3.1 6.8 1.5 6.8 4.5 0 1.4-1.3 2.4-3.4 2.4-1.7 0-3.1-.6-3.8-1.6" />,
  communications: <path d="M4 4.2h12v8.2H8.2L4 15.6z" />,
  "post-closing": (
    <>
      <path d="M4 8.2 10 4.8l6 3.4v7.2H4z" />
      <path d="M4 8.2h12" />
      <path d="M10 8.2v7.2" />
    </>
  ),
};

function Glyph({ slug }: { slug: string }) {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[slug]}
    </svg>
  );
}

export function Shell({ user, children }: { user: PublicUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggle() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="flex h-screen bg-paper text-ink">
      <aside className={`flex shrink-0 flex-col bg-sidebar text-[#ebe6dc] transition-[width] duration-200 ${collapsed ? "w-16" : "w-60"}`}>
        <div className={collapsed ? "flex flex-col items-center gap-3 px-2 pt-5 pb-4" : "flex items-start justify-between gap-2 px-5 pt-6 pb-5"}>
          <Link href="/" className="font-serif tracking-tight text-white" title="ClosingDesk">
            {collapsed ? <span className="text-lg">CD</span> : <span className="text-2xl">ClosingDesk</span>}
          </Link>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-md p-1.5 text-[#d5cec3] hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12.5 4.5 7 10l5.5 5.5" />
            </svg>
          </button>
        </div>
        {!collapsed && <p className="-mt-3 px-5 pb-4 text-xs leading-5 text-[#c9c2b6]">Real estate closings</p>}
        <nav className={`flex-1 space-y-1 ${collapsed ? "px-2" : "px-3"}`} aria-label="Modules">
          {MODULES.map((module) => {
            const href = module.slug === "offer-psa" ? "/" : `/modules/${module.slug}`;
            const active = module.slug === "offer-psa" ? pathname === "/" || pathname.startsWith("/matters") : pathname === href;
            return (
              <Link
                key={module.slug}
                href={href}
                title={module.name}
                className={`flex items-center gap-3 rounded-md text-sm ${collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2"} ${active ? "bg-white/10 text-white" : "text-[#d5cec3] hover:bg-white/5"}`}
              >
                <Glyph slug={module.slug} />
                <span className={collapsed ? "sr-only" : "min-w-0"}>
                  <span className="block">{module.name}</span>
                  <span className="block text-[11px] tracking-wide text-[#b7b0a4] uppercase">{module.phase}</span>
                </span>
              </Link>
            );
          })}
        </nav>
        <div className={`border-t border-white/10 ${collapsed ? "px-2 py-4" : "px-5 pt-4 pb-16"}`}>
          {collapsed ? (
            <p className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white" title={user.name}>
              {initials || "V"}
            </p>
          ) : (
            <>
              <p className="text-sm text-white">{user.name}</p>
              <p className="truncate text-xs text-[#b7b0a4]">{user.email}</p>
            </>
          )}
          <form action="/api/logout" method="post" className={collapsed ? "mt-3 flex justify-center" : undefined}>
            <button
              type="submit"
              title="Sign out"
              className={`text-[#eadfce] hover:text-white ${collapsed ? "rounded-md p-1.5 hover:bg-white/10" : "mt-3 text-sm underline-offset-2 hover:underline"}`}
            >
              {collapsed ? (
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 4.5H5.5v11H8" />
                  <path d="M8.5 10h8" />
                  <path d="m13.5 6.5 3.5 3.5-3.5 3.5" />
                </svg>
              ) : (
                "Sign out"
              )}
              {collapsed && <span className="sr-only">Sign out</span>}
            </button>
          </form>
        </div>
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
