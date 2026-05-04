"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import PresenceBadge from "./PresenceBadge";
import TenantSwitcher from "./TenantSwitcher";

type Props = {
  email?: string | null;
  tenantSlug?: string | null;
  roles?: string[];
};

type NavLink = { href: string; label: string; match: (p: string) => boolean; adminOnly?: boolean };

const ALL_LINKS: NavLink[] = [
  { href: "/dashboard",       label: "Panel",          match: p => p.startsWith("/dashboard") },
  { href: "/executive-brain", label: "🧠 Beyin",       match: p => p.startsWith("/executive-brain") },
  { href: "/chat",            label: "Chat",           match: p => p.startsWith("/chat") },
  { href: "/vaults",          label: "Vaults",         match: p => p.startsWith("/vaults") },
  { href: "/remote-control",  label: "Remote Control", match: p => p.startsWith("/remote-control") },
  { href: "/terminal",        label: "Terminal",       match: p => p.startsWith("/terminal") },
  { href: "/admin",           label: "Admin",          match: p => p.startsWith("/admin"), adminOnly: true },
  { href: "/setup",           label: "CLI Kurulum",    match: p => p.startsWith("/setup") }
];

export default function TopNav({ email, tenantSlug, roles = [] }: Props) {
  const isAdmin = roles.includes("tenant_admin") || roles.includes("platform_admin");
  const LINKS = ALL_LINKS.filter(l => !l.adminOnly || isAdmin);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-neutral-800 bg-neutral-950/95 px-3 sm:px-4 backdrop-blur">
      <div className="flex items-center gap-3 lg:gap-6 min-w-0">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold tracking-tight shrink-0">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-orange-500/15 text-orange-400">◉</span>
          <span className="hidden sm:inline">Altaris</span>
          {tenantSlug && (
            <span className="ml-1 sm:ml-2 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-neutral-400">
              {tenantSlug}
            </span>
          )}
        </Link>
        {/* Desktop nav — hidden under lg */}
        <nav className="hidden lg:flex items-center gap-1 text-xs">
          {LINKS.map(l => {
            const active = l.match(pathname);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={
                  active
                    ? "rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-orange-400"
                    : "rounded-md px-3 py-1.5 text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
                }
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 text-xs">
        <div className="hidden md:block"><TenantSwitcher /></div>
        <div className="hidden sm:block"><PresenceBadge /></div>
        {email && (
          <Link
            href="/account/security"
            className="hidden md:inline text-neutral-400 hover:text-orange-400 truncate max-w-[160px]"
            title="Hesap güvenliği (2FA, şifre)"
          >
            {email}
          </Link>
        )}
        <a
          href="/api/auth/full-signout"
          className="hidden sm:inline-block rounded-md border border-neutral-800 px-3 py-1 text-neutral-300 hover:bg-neutral-900"
        >
          Çıkış
        </a>
        {/* Hamburger — visible under lg */}
        <button
          type="button"
          aria-label="Menü"
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
          className="lg:hidden inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-800 text-neutral-300 hover:bg-neutral-900"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {open ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <>
          <div
            className="lg:hidden fixed inset-0 top-12 z-30 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="lg:hidden fixed left-0 right-0 top-12 z-40 border-b border-neutral-800 bg-neutral-950 px-4 py-4 shadow-lg">
            <nav className="flex flex-col gap-1 text-sm">
              {LINKS.map(l => {
                const active = l.match(pathname);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={
                      active
                        ? "rounded-md bg-neutral-900 px-3 py-2 font-medium text-orange-400"
                        : "rounded-md px-3 py-2 text-neutral-300 hover:bg-neutral-900 hover:text-neutral-100"
                    }
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-4 flex flex-col gap-2 border-t border-neutral-800 pt-4 sm:hidden">
              <div><TenantSwitcher /></div>
              <div><PresenceBadge /></div>
              {email && (
                <Link href="/account/security" className="text-xs text-neutral-400 hover:text-orange-400 truncate">
                  {email}
                </Link>
              )}
              <a
                href="/api/auth/full-signout"
                className="rounded-md border border-neutral-800 px-3 py-2 text-center text-xs text-neutral-300 hover:bg-neutral-900"
              >
                Çıkış
              </a>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
