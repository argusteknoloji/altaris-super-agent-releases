"use client";

import { useEffect, useState } from "react";

type Tenant = { id: string; slug: string; name: string };
type Me = { isPlatformAdmin: boolean; tenantSlug: string };

const COOKIE_NAME = "altaris_tenant_override";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[2]) : null;
}

function writeCookie(name: string, value: string | null) {
  if (typeof document === "undefined") return;
  if (value === null) {
    document.cookie = `${name}=; path=/; max-age=0`;
  } else {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=86400; SameSite=Lax`;
  }
}

export default function TenantSwitcher() {
  const [me, setMe] = useState<Me | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [override, setOverride] = useState<string | null>(null);

  useEffect(() => {
    setOverride(readCookie(COOKIE_NAME));
    fetch("/api/proxy/me", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(m => {
        if (!m) return;
        setMe(m);
        if (m.isPlatformAdmin) {
          fetch("/api/proxy/admin/tenants", { cache: "no-store" })
            .then(r => r.ok ? r.json() : [])
            .then(setTenants);
        }
      });
  }, []);

  if (!me?.isPlatformAdmin) return null;

  function pick(slug: string | null) {
    writeCookie(COOKIE_NAME, slug);
    setOverride(slug);
    // Force a full reload so all server-rendered + client-rendered surfaces
    // re-fetch with the new override header.
    window.location.reload();
  }

  const active = override ?? me.tenantSlug;

  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md border border-purple-500/30 bg-purple-500/5 px-2 py-1 text-[10px] uppercase tracking-wide text-purple-300 hover:bg-purple-500/10">
        🛡 {active}{override ? " ⚠" : ""}
      </summary>
      <div className="absolute right-0 z-50 mt-1 w-72 max-h-96 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-950 p-2 shadow-2xl">
        <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-neutral-500">Tenant olarak görüntüle</p>
        <button
          onClick={() => pick(null)}
          className={
            "block w-full rounded px-3 py-1.5 text-left text-xs " +
            (override === null ? "bg-orange-500/15 text-orange-300" : "text-neutral-300 hover:bg-neutral-900")
          }
        >
          {me.tenantSlug} <span className="text-[10px] text-neutral-500">(varsayılan)</span>
        </button>
        <div className="my-1 border-t border-neutral-800" />
        {tenants.length === 0 && <p className="px-3 py-2 text-xs text-neutral-500">Tenant yok</p>}
        {tenants.filter(t => t.slug !== me.tenantSlug).map(t => (
          <button
            key={t.id}
            onClick={() => pick(t.slug)}
            className={
              "block w-full rounded px-3 py-1.5 text-left text-xs " +
              (override === t.slug ? "bg-purple-500/15 text-purple-300" : "text-neutral-300 hover:bg-neutral-900")
            }
          >
            <span className="font-mono">{t.slug}</span> · {t.name}
          </button>
        ))}
      </div>
    </details>
  );
}
