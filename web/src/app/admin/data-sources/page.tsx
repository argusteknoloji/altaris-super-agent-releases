"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtDateTimeTR, fmtRelativeTR } from "@/lib/datetime";

type DataSource = {
  id: string; kind: string; name: string; config: string;
  targetVaultId: string | null; enabled: boolean;
  lastSyncAt: string | null; lastSyncStatus: string | null; lastSyncError: string | null;
  syncIntervalMin: number | null;
  createdAt: string; updatedAt: string;
};
type Template = { kind: string; label: string; description: string; authType: string; configTemplate: unknown };
type Vault = { id: string; slug: string; name: string };

const KIND_BADGES: Record<string, string> = {
  csv:        "bg-emerald-500/15 text-emerald-300",
  imap:       "bg-purple-500/15 text-purple-300",
  exchange:   "bg-purple-500/15 text-purple-300",
  logo_tiger: "bg-orange-500/15 text-orange-300",
  netsis:     "bg-orange-500/15 text-orange-300",
  salesforce: "bg-sky-500/15 text-sky-300",
  hubspot:    "bg-pink-500/15 text-pink-300",
  rest_api:   "bg-neutral-700 text-neutral-200",
  pdf_bulk:   "bg-amber-500/15 text-amber-300",
};

export default function DataSourcesPage() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [editing, setEditing] = useState<DataSource | null>(null);
  const [creatingFrom, setCreatingFrom] = useState<Template | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const [s, t, v] = await Promise.all([
      fetch("/api/proxy/admin/data-sources",        { cache: "no-store" }).then(r => r.ok ? r.json() : []),
      fetch("/api/proxy/admin/data-sources/templates", { cache: "no-store" }).then(r => r.ok ? r.json() : []),
      fetch("/api/proxy/vaults-root",               { cache: "no-store" }).then(r => r.ok ? r.json() : []),
    ]);
    setSources(s); setTemplates(t); setVaults(v);
  }
  useEffect(() => { load(); }, []);

  async function testConn(d: DataSource) {
    setBusy(d.id);
    try {
      const r = await fetch(`/api/proxy/admin/data-sources/${d.id}/test`, { method: "POST" });
      const data = await r.json();
      alert(data.ok ? `✓ ${data.message}` : `✗ ${data.message}`);
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(null); }
  }
  async function syncNow(d: DataSource) {
    setBusy(d.id); setErr(null);
    try {
      const r = await fetch(`/api/proxy/admin/data-sources/${d.id}/sync`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      alert(`✓ ${data.fileCount ?? 0} dosya · ${data.note ?? ""}`);
      await load();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  }
  async function del(d: DataSource) {
    if (!confirm(`'${d.name}' connector'ı silinsin mi? Vault'taki dosyalar kalır.`)) return;
    const r = await fetch(`/api/proxy/admin/data-sources/${d.id}`, { method: "DELETE" });
    if (r.ok) load(); else setErr(`HTTP ${r.status}`);
  }
  async function toggleEnabled(d: DataSource) {
    const r = await fetch(`/api/proxy/admin/data-sources/${d.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !d.enabled }),
    });
    if (r.ok) load();
  }

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">🔌 Connector'lar</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Şirket verisini Executive Brain'e besle: ERP (Logo, Netsis), CRM (Salesforce, HubSpot),
            E-posta, Excel/CSV, generic REST API.
          </p>
        </div>
      </div>

      {/* Templates */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-neutral-300">Hazır şablonlar</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map(t => (
            <div key={t.kind} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-[10px] font-mono ${KIND_BADGES[t.kind] ?? "bg-neutral-700"}`}>{t.kind}</span>
                <h3 className="text-sm font-semibold">{t.label}</h3>
              </div>
              <p className="mt-2 text-xs text-neutral-400 leading-snug">{t.description}</p>
              <p className="mt-1 text-[10px] text-neutral-500">Auth: <code>{t.authType}</code></p>
              <button onClick={() => setCreatingFrom(t)}
                className="mt-3 w-full rounded-md border border-orange-500/30 px-3 py-1.5 text-xs text-orange-400 hover:bg-orange-500/10">
                Yeni connector oluştur
              </button>
            </div>
          ))}
        </div>
      </section>

      {err && <p className="mb-4 text-xs text-red-400">{err}</p>}

      {/* Active sources */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-300">Aktif connector'lar ({sources.length})</h2>
        {sources.length === 0 ? (
          <p className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-6 text-center text-sm text-neutral-500">
            Henüz connector yok. Yukarıdaki bir şablondan başla.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Tür</th>
                  <th className="px-3 py-2">Ad</th>
                  <th className="px-3 py-2">Vault</th>
                  <th className="px-3 py-2">Sync</th>
                  <th className="px-3 py-2">Son sync</th>
                  <th className="px-3 py-2 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {sources.map(d => {
                  const v = vaults.find(x => x.id === d.targetVaultId);
                  return (
                    <tr key={d.id} className="border-t border-neutral-800 hover:bg-neutral-900/40">
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-mono ${KIND_BADGES[d.kind] ?? "bg-neutral-700"}`}>{d.kind}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className={d.enabled ? "" : "opacity-50"}>
                          {d.name}
                          {!d.enabled && <span className="ml-2 text-[10px] text-neutral-500">(disabled)</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {v ? <Link href={`/vaults/${v.slug}`} className="text-orange-400 hover:underline">{v.slug}</Link> : <span className="text-red-400">— set et —</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-neutral-500">
                        {d.syncIntervalMin ? `${d.syncIntervalMin} dk` : "manuel"}
                      </td>
                      <td className="px-3 py-2 text-xs text-neutral-400">
                        {d.lastSyncAt ? (
                          <span>
                            {d.lastSyncStatus === "ok"
                              ? <span className="text-emerald-400">✓</span>
                              : <span className="text-red-400" title={d.lastSyncError ?? ""}>✗</span>}
                            {" "}{fmtRelativeTR(d.lastSyncAt)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right space-x-1 whitespace-nowrap">
                        <button onClick={() => testConn(d)} disabled={busy === d.id}
                          className="rounded border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-300 hover:bg-neutral-800 disabled:opacity-50">
                          Test
                        </button>
                        <button onClick={() => syncNow(d)} disabled={busy === d.id || !d.targetVaultId}
                          className="rounded border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50">
                          {busy === d.id ? "…" : "Sync"}
                        </button>
                        <button onClick={() => toggleEnabled(d)}
                          className="rounded border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-300 hover:bg-neutral-800">
                          {d.enabled ? "Kapat" : "Aç"}
                        </button>
                        <button onClick={() => setEditing(d)}
                          className="rounded border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-300 hover:bg-neutral-800">
                          Düzenle
                        </button>
                        <button onClick={() => del(d)}
                          className="rounded border border-red-500/30 px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-500/10">
                          Sil
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(editing || creatingFrom) && (
        <DataSourceEditor
          source={editing}
          template={creatingFrom}
          vaults={vaults}
          onClose={() => { setEditing(null); setCreatingFrom(null); }}
          onSaved={async () => { setEditing(null); setCreatingFrom(null); await load(); }}
        />
      )}
    </main>
  );
}

function DataSourceEditor({ source, template, vaults, onClose, onSaved }: {
  source: DataSource | null;
  template: Template | null;
  vaults: Vault[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = source === null;
  const [form, setForm] = useState({
    kind: source?.kind ?? template?.kind ?? "csv",
    name: source?.name ?? template?.label ?? "",
    config: source?.config ?? JSON.stringify(template?.configTemplate ?? {}, null, 2),
    secret: "",
    targetVaultId: source?.targetVaultId ?? "",
    syncIntervalMin: source?.syncIntervalMin ?? "",
    enabled: source?.enabled ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      JSON.parse(form.config); // validate
      const body = {
        ...form,
        targetVaultId: form.targetVaultId || null,
        syncIntervalMin: form.syncIntervalMin ? Number(form.syncIntervalMin) : null,
        secret: form.secret || (isNew ? null : undefined),
      };
      const url = isNew ? "/api/proxy/admin/data-sources" : `/api/proxy/admin/data-sources/${source!.id}`;
      const r = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      onSaved();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form onSubmit={save} onClick={e => e.stopPropagation()} className="max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-950 p-6">
        <h3 className="text-lg font-semibold">{isNew ? `Yeni connector — ${template?.label ?? ""}` : `Düzenle: ${source!.name}`}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input required disabled={!isNew} placeholder="Tür" value={form.kind} onChange={e => setForm({...form, kind: e.target.value})}
            className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm font-mono disabled:opacity-50" />
          <input required placeholder="Ad" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
            className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="text-xs text-neutral-400">Hedef vault</label>
          <select value={form.targetVaultId} onChange={e => setForm({...form, targetVaultId: e.target.value})}
            className="mt-1 w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm">
            <option value="">— Bir vault seç —</option>
            {vaults.map(v => <option key={v.id} value={v.id}>{v.slug} · {v.name}</option>)}
          </select>
          <p className="mt-1 text-[10px] text-neutral-500">Connector çıktı dosyaları bu vault'a yazılır + embedding pipeline otomatik index eder.</p>
        </div>

        <div>
          <label className="text-xs text-neutral-400">Config (JSON)</label>
          <textarea required rows={12} value={form.config} onChange={e => setForm({...form, config: e.target.value})}
            className="mt-1 w-full rounded-md border border-neutral-800 bg-neutral-900 p-3 font-mono text-[11px]" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="password" placeholder={isNew ? "Secret (token / app password)" : "Secret (boş bırak = değişmez)"}
            value={form.secret} onChange={e => setForm({...form, secret: e.target.value})}
            className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm" />
          <input type="number" placeholder="Sync aralığı (dk, boş = manuel)"
            value={form.syncIntervalMin} onChange={e => setForm({...form, syncIntervalMin: e.target.value})}
            className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm" />
        </div>

        <label className="flex items-center gap-2 text-xs text-neutral-400">
          <input type="checkbox" checked={form.enabled} onChange={e => setForm({...form, enabled: e.target.checked})} />
          Aktif (kapatılırsa periyodik sync çalışmaz)
        </label>

        {err && <p className="text-xs text-red-400">{err}</p>}

        <div className="flex justify-end gap-2 border-t border-neutral-800 pt-4">
          <button type="button" onClick={onClose} className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900">İptal</button>
          <button disabled={busy} className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
            {busy ? "…" : isNew ? "Oluştur" : "Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}
