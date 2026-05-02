"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import PresenceBadge from "./PresenceBadge";
import TenantSwitcher from "./TenantSwitcher";

type Props = {
  email?: string | null;
  tenantSlug?: string | null;
};

const LINKS: Array<{ href: string; label: string; match: (p: string) => boolean }> = [
  { href: "/dashboard",     label: "Panel",         match: p => p.startsWith("/dashboard") },
  { href: "/chat",          label: "Chat",          match: p => p.startsWith("/chat") },
  { href: "/vaults",        label: "Vaults",        match: p => p.startsWith("/vaults") },
  { href: "/remote-control", label: "Remote Control", match: p => p.startsWith("/remote-control") },
  { href: "/terminal",      label: "Terminal",      match: p => p.startsWith("/terminal") },
  { href: "/admin",         label: "Admin",         match: p => p.startsWith("/admin") },
  { href: "/setup",         label: "CLI Kurulum",   match: p => p.startsWith("/setup") }
];

export default function TopNav({ email, tenantSlug }: Props) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-neutral-800 bg-neutral-950/95 px-4 backdrop-blur">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-orange-500/15 text-orange-400">◉</span>
          Altaris
          {tenantSlug && (
            <span className="ml-2 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-neutral-400">
              {tenantSlug}
            </span>
          )}
        </Link>
        <nav className="flex items-center gap-1 text-xs">
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
      <div className="flex items-center gap-3 text-xs">
        <TenantSwitcher />
        <PresenceBadge />
        {email && (
          <Link
            href="/account/security"
            className="text-neutral-400 hover:text-orange-400"
            title="Hesap güvenliği (2FA, şifre)"
          >
            {email}
          </Link>
        )}
        <a
          href="/api/auth/full-signout"
          className="rounded-md border border-neutral-800 px-3 py-1 text-neutral-300 hover:bg-neutral-900"
        >
          Çıkış
        </a>
      </div>
    </header>
  );
}
