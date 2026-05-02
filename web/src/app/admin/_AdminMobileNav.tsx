"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Item = { href: string; label: string };

export default function AdminMobileNav({ items, tenantSlug, role }: { items: Item[]; tenantSlug: string; role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div className="md:hidden border-b border-neutral-800 bg-neutral-950 px-4 py-2">
      <button
        type="button"
        aria-label="Admin menü"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between rounded-md border border-neutral-800 px-3 py-2 text-sm text-neutral-200"
      >
        <span className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
          Admin menü
        </span>
        <span className="text-xs text-neutral-500 font-mono">{tenantSlug}</span>
      </button>
      {open && (
        <nav className="mt-2 space-y-1 rounded-md border border-neutral-800 bg-neutral-900 p-2 text-sm">
          <p className="px-2 py-1 text-[10px] text-neutral-500">Rol: {role}</p>
          {items.map(i => (
            <Link key={i.href} href={i.href}
              className="block rounded-md px-3 py-2 text-neutral-300 hover:bg-neutral-800 hover:text-orange-400">
              {i.label}
            </Link>
          ))}
          <Link href="/dashboard" className="mt-2 block rounded-md border-t border-neutral-800 px-3 pt-3 text-xs text-neutral-400 hover:text-orange-400">
            ← Panele dön
          </Link>
        </nav>
      )}
    </div>
  );
}
