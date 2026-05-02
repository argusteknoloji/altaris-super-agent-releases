"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { fmtDateTimeTR } from "@/lib/datetime";

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

type SsoSession = {
  id: string;
  username: string;
  ipAddress: string;
  start: number;
  lastAccess: number;
  clients: Record<string, string> | null;
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
  const [sessions, setSessions] = useState<SsoSession[]>([]);

  async function load() {
    setErr(null);
    try {
      const [c, u, s] = await Promise.all([
        fetch("/api/proxy/admin/capabilities/catalog", { cache: "no-store" }).then(r => r.json()),
        fetch(`/api/proxy/admin/users/${id}/capabilities`, { cache: "no-store" }).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        }),
        fetch(`/api/proxy/admin/users/${id}/sso-sessions`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : []),
      ]);
      setCatalog(c); setData(u); setSessions(s);
      const m = new Map<string, Effect>();
      for (const cap of c.all) m.set(cap, "default");
      for (const o of u.overrides ?? []) m.set(o.capability, o.effect);
      setMatrix(m);
    } catch (e) { setErr((e as Error).message); }
  }

  async function killSession(sid: string) {
    if (!confirm("Bu SSO oturumunu sonlandır?")) return;
    const r = await fetch(`/api/proxy/admin/users/${id}/sso-sessions/${sid}`, { method: "DELETE" });
    if (r.ok) load(); else setErr(`HTTP ${r.status}`);
  }
  async function logoutAll() {
    if (!confirm("Bu kullanıcının TÜM SSO oturumları sonlandırılsın? Tekrar login gerekir.")) return;
    const r = await fetch(`/api/proxy/admin/users/${id}/sso-sessions/logout-all`, { method: "POST" });
    if (r.ok) load(); else setErr(`HTTP ${r.status}`);
  }

  async function require2fa() {
    if (!confirm("Bu kullanıcı bir sonraki girişte TOTP (Google Authenticator vb.) kurmak ZORUNDA olsun?")) return;
    const r = await fetch(`/api/proxy/admin/users/${id}/require-totp`, { method: "POST" });
    if (r.ok) alert("✓ Kullanıcı bir sonraki login'de QR code göstereceği zorunlu adıma yönlenecek.");
    else setErr(`HTTP ${r.status}`);
  }
  async function remove2fa() {
    if (!confirm("Mevcut TOTP credential'ları silinsin? Kullanıcı 2FA'sız giriş yapabilir hale gelir.")) return;
    const r = await fetch(`/api/proxy/admin/users/${id}/remove-totp`, { method: "POST" });
    if (r.ok) alert("✓ TOTP kaldırıldı."); else setErr(`HTTP ${r.status}`);
  }
  async function dataExport() {
    // Direkt link — proxy zaten file response döndürüyor.
    window.location.href = `/api/proxy/admin/users/${id}/data-export`;
  }
  async function dataErase() {
    const email = data?.role && prompt(`KVKK 11. madde / GDPR Article 17 — kullanıcı verisi silme.\n\nDoğrulama için yaz: "erase ${"<EMAIL>"}"`)?.trim();
    if (!email) return;
    const r = await fetch(`/api/proxy/admin/users/${id}/data-erase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: email }),
    });
    if (r.ok) {
      alert("✓ Kullanıcı verisi silindi / anonimize edildi. Listeye dönülecek.");
      window.location.href = "/admin/users";
    } else {
      const txt = await r.text();
      setErr(`HTTP ${r.status}: ${txt}`);
    }
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
    return <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 text-sm text-neutral-500">{err || "Yükleniyor…"}</div>;
  }

  const eff = effectiveSet();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <Link href="/admin/users" className="text-xs text-neutral-400 hover:text-orange-400">← Kullanıcılar</Link>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
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

      <section className="mt-6 grid grid-cols-1 gap-3 rounded-lg border border-neutral-800 bg-neutral-900/30 p-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-neutral-200">İki faktörlü doğrulama (TOTP)</h3>
          <p className="mt-1 text-xs text-neutral-500">Kurumsal güvenlik politikası gereği zorunlu kılabilirsin.</p>
          <div className="mt-2 flex gap-2">
            <button onClick={require2fa} className="rounded-md border border-emerald-500/30 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10">Zorunlu kıl (next login)</button>
            <button onClick={remove2fa} className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-900">TOTP kaldır</button>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-neutral-200">KVKK / GDPR — Veri sahibi hakları</h3>
          <p className="mt-1 text-xs text-neutral-500">Veri taşınabilirliği + silme talebi (Article 17 / KVKK 11).</p>
          <div className="mt-2 flex gap-2">
            <button onClick={dataExport} className="rounded-md border border-sky-500/30 px-3 py-1 text-xs text-sky-300 hover:bg-sky-500/10">Tüm veriyi indir (JSON)</button>
            <button onClick={dataErase} className="rounded-md border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10">Veriyi sil (irreversible)</button>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/30 p-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-neutral-200">Aktif SSO oturumları ({sessions.length})</h3>
          {sessions.length > 0 && (
            <button onClick={logoutAll} className="rounded-md border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10">Hepsini sonlandır</button>
          )}
        </div>
        {sessions.length === 0 ? (
          <p className="mt-3 text-xs text-neutral-500">Aktif oturum yok.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr><th className="pb-2">IP</th><th className="pb-2">Başlangıç</th><th className="pb-2">Son erişim</th><th className="pb-2">Client</th><th className="pb-2 text-right">İşlem</th></tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} className="border-t border-neutral-800">
                  <td className="py-2 font-mono text-xs text-neutral-300">{s.ipAddress || "—"}</td>
                  <td className="py-2 text-xs text-neutral-400">{fmtDateTimeTR(new Date(s.start))}</td>
                  <td className="py-2 text-xs text-neutral-400">{fmtDateTimeTR(new Date(s.lastAccess))}</td>
                  <td className="py-2 text-xs text-neutral-500">{s.clients ? Object.values(s.clients).join(", ") : "—"}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => killSession(s.id)} className="rounded-md border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10">Sonlandır</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>

      <div className="mt-6 space-y-6">
        {groups.map(g => (
          <section key={g.name} className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-4">
            <h3 className="text-sm font-semibold text-neutral-200">{g.name}</h3>
            <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
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
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
