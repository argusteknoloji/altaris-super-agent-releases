"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";

type Catalog = {
  all: string[];
  defaults: { tenant_member: string[]; tenant_admin: string[]; platform_admin: string[] };
};

type UserCaps = {
  userId: string;
  role: string;
  defaults: string[];
  overrides: { capability: string; effect: "allow" | "deny"; grantedAt: string }[];
  effective: string[];
};

type Effect = "default" | "allow" | "deny";

const CAP_LABELS: Record<string, { tr: string; group: string }> = {
  "chat.use":                   { tr: "Sohbet kullanımı",                       group: "Chat" },
  "chat.attach_files":          { tr: "Dosya/resim eki",                        group: "Chat" },
  "session.create":             { tr: "Oturum aç",                              group: "Oturum" },
  "session.view_own":           { tr: "Kendi oturumlarını gör",                 group: "Oturum" },
  "session.view_all":           { tr: "Tenant'ın bütün oturumlarını gör",       group: "Oturum" },
  "vault.read":                 { tr: "Vault oku",                              group: "Vault" },
  "vault.write":                { tr: "Vault yaz",                              group: "Vault" },
  "vault.create":               { tr: "Yeni vault oluştur",                     group: "Vault" },
  "vault.delete":               { tr: "Vault sil",                              group: "Vault" },
  "vault.share":                { tr: "Vault visibility değiştir",              group: "Vault" },
  "remote_control.publish":     { tr: "Kendi oturumunu yayınla",                group: "Remote Control" },
  "remote_control.view":        { tr: "Başkasının yayınını izle",               group: "Remote Control" },
  "remote_control.takeover":    { tr: "Başkasının oturumunu devral",            group: "Remote Control" },
  "admin.users":                { tr: "Kullanıcı yönetimi",                     group: "Admin" },
  "admin.providers":            { tr: "Provider config",                        group: "Admin" },
  "admin.audit":                { tr: "Audit log",                              group: "Admin" },
  "admin.invitations":          { tr: "Davet yönetimi",                         group: "Admin" },
  "admin.tenants":              { tr: "Tenant yönetimi (cross-tenant)",         group: "Platform" },
  "api_key.create":             { tr: "API key oluştur",                        group: "API Key" },
  "api_key.list_own":           { tr: "Kendi API key'lerini listele",           group: "API Key" },
  "api_key.list_all":           { tr: "Tenant'ın tüm API key'lerini listele",   group: "API Key" },
};

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [data, setData]       = useState<UserCaps | null>(null);
  const [matrix, setMatrix]   = useState<Map<string, Effect>>(new Map());
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  async function load() {
    setErr(null);
    try {
      const [c, u] = await Promise.all([
        fetch("/api/proxy/admin/capabilities/catalog", { cache: "no-store" }).then(r => r.json()),
        fetch(`/api/proxy/admin/users/${id}/capabilities`, { cache: "no-store" }).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        }),
      ]);
      setCatalog(c); setData(u);
      const m = new Map<string, Effect>();
      for (const cap of c.all) m.set(cap, "default");
      for (const o of u.overrides ?? []) m.set(o.capability, o.effect);
      setMatrix(m);
    } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const groups = useMemo(() => {
    if (!catalog) return [] as { name: string; caps: string[] }[];
    const map = new Map<string, string[]>();
    for (const cap of catalog.all) {
      const g = CAP_LABELS[cap]?.group ?? "Diğer";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(cap);
    }
    return Array.from(map.entries()).map(([name, caps]) => ({ name, caps }));
  }, [catalog]);

  function setEffect(cap: string, effect: Effect) {
    const m = new Map(matrix);
    m.set(cap, effect);
    setMatrix(m);
  }

  function effectiveSet(): Set<string> {
    if (!data) return new Set();
    const s = new Set(data.defaults);
    for (const [cap, eff] of matrix) {
      if (eff === "allow") s.add(cap);
      else if (eff === "deny") s.delete(cap);
    }
    return s;
  }

  async function save() {
    setBusy(true); setErr(null); setSavedFlash(false);
    try {
      const overrides: { capability: string; effect: "allow" | "deny" }[] = [];
      for (const [cap, eff] of matrix) {
        if (eff === "allow" || eff === "deny") overrides.push({ capability: cap, effect: eff });
      }
      const r = await fetch(`/api/proxy/admin/users/${id}/capabilities`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      await load();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  function reset() {
    if (!catalog) return;
    const m = new Map<string, Effect>();
    for (const cap of catalog.all) m.set(cap, "default");
    setMatrix(m);
  }

  if (!catalog || !data) {
    return <div className="px-8 py-8 text-sm text-neutral-500">{err || "Yükleniyor…"}</div>;
  }

  const eff = effectiveSet();

  return (
    <div className="px-8 py-8">
      <Link href="/admin/users" className="text-xs text-neutral-400 hover:text-orange-400">← Kullanıcılar</Link>
      <div className="mt-3 flex items-baseline justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Yetkiler</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Rol: <span className="font-mono text-orange-400">{data.role}</span> ·
            Default {data.defaults.length} · Effective {eff.size} ·
            Override {Array.from(matrix.values()).filter(e => e !== "default").length}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={reset} className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900">Override'ları temizle</button>
          <button onClick={save} disabled={busy} className="rounded-md bg-orange-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
            {busy ? "Kaydediliyor…" : savedFlash ? "Kaydedildi ✓" : "Değişiklikleri kaydet"}
          </button>
        </div>
      </div>

      {err && <p className="mt-4 text-xs text-red-400">Hata: {err}</p>}

      <p className="mt-4 rounded-md border border-neutral-800 bg-neutral-900/40 p-3 text-xs text-neutral-400">
        Her capability için 3 seçenek: <strong>Default</strong> (rol setine bağlı kal),
        <strong className="text-emerald-400"> Allow</strong> (rol vermese bile ver),
        <strong className="text-red-400"> Deny</strong> (rol verse bile elle).
        Effective = Default ∪ Allow ∖ Deny.
      </p>

      <div className="mt-6 space-y-6">
        {groups.map(g => (
          <section key={g.name} className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-4">
            <h3 className="text-sm font-semibold text-neutral-200">{g.name}</h3>
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="pb-2">Capability</th>
                  <th className="pb-2 w-24 text-center">Default'ta</th>
                  <th className="pb-2 w-24 text-center">Effective</th>
                  <th className="pb-2 w-72 text-right">Override</th>
                </tr>
              </thead>
              <tbody>
                {g.caps.map(cap => {
                  const inDefault = data.defaults.includes(cap);
                  const isEffective = eff.has(cap);
                  const cur = matrix.get(cap) ?? "default";
                  return (
                    <tr key={cap} className="border-t border-neutral-800">
                      <td className="py-2">
                        <div className="font-medium">{CAP_LABELS[cap]?.tr ?? cap}</div>
                        <div className="font-mono text-[11px] text-neutral-500">{cap}</div>
                      </td>
                      <td className="py-2 text-center">
                        {inDefault
                          ? <span className="text-emerald-400">✓</span>
                          : <span className="text-neutral-700">—</span>}
                      </td>
                      <td className="py-2 text-center">
                        {isEffective
                          ? <span className="text-emerald-400">✓</span>
                          : <span className="text-neutral-700">×</span>}
                      </td>
                      <td className="py-2 text-right">
                        <div className="inline-flex rounded-md border border-neutral-800 bg-neutral-950 p-0.5">
                          {(["default", "allow", "deny"] as Effect[]).map(e => (
                            <button
                              key={e}
                              onClick={() => setEffect(cap, e)}
                              className={
                                "rounded px-2 py-1 text-[11px] font-medium transition-colors " + (
                                  cur === e
                                    ? e === "allow" ? "bg-emerald-500/20 text-emerald-300"
                                    : e === "deny"  ? "bg-red-500/20 text-red-300"
                                    :                 "bg-neutral-700 text-neutral-200"
                                    : "text-neutral-500 hover:text-neutral-300"
                                )
                              }
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}
