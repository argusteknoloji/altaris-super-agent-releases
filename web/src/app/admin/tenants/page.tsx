"use client";
import { useEffect, useState } from "react";
import { fmtDateTimeTR } from "@/lib/datetime";

type Row = { id: string; slug: string; name: string; status: string; createdAt: string };
const STATUSES = ["active", "suspended", "archived"] as const;

export default function TenantsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({ slug: "", name: "" });
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [editing, setEditing] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState({ name: "", status: "active" });
  const [editBusy, setEditBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/proxy/admin/tenants", { cache: "no-store" });
    if (r.status === 403) { setForbidden(true); return; }
    if (r.ok) setRows(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    const r = await fetch("/api/proxy/admin/tenants", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form)
    });
    if (!r.ok) { setErr(await r.text()); return; }
    setForm({ slug: "", name: "" }); load();
  }

  function openEdit(t: Row) {
    setEditing(t);
    setEditForm({ name: t.name, status: t.status });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/proxy/admin/tenants/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!r.ok) throw new Error(await r.text());
      setEditing(null);
      await load();
    } catch (e) { setErr((e as Error).message); }
    finally { setEditBusy(false); }
  }

  async function del(t: Row) {
    const phrase = `tenant'ı sil ${t.slug}`;
    const typed = prompt(
      `'${t.slug}' ve içindeki tüm kullanıcılar / vault'lar / oturumlar silinecek. ` +
      `Geri alınamaz.\n\nOnay için yaz: "${phrase}"`
    );
    if (typed !== phrase) return;
    const r = await fetch(`/api/proxy/admin/tenants/${t.id}`, { method: "DELETE" });
    if (r.ok) load(); else setErr(`Silinemedi: HTTP ${r.status}`);
  }

  if (forbidden) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 text-center">
        <h2 className="text-2xl font-semibold">Yetki yok</h2>
        <p className="mt-2 text-sm text-neutral-400">Tenant yönetimi için <code className="font-mono text-orange-400">platform_admin</code> rolü gereklidir.</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <h2 className="text-2xl font-semibold">Tenant'lar (platform yönetimi)</h2>
      <p className="mt-1 text-sm text-neutral-400">Yeni kuruluş için tenant açın. Slug login sırasında JWT'de <code className="font-mono">tid</code> claim'i olur.</p>

      <form onSubmit={create} className="mt-6 grid grid-cols-1 gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 md:grid-cols-3">
        <input required placeholder="slug (ör. acme-corp)" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm font-mono" />
        <input required placeholder="Tam ad (ör. Acme Corporation)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" />
        <button className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">Tenant oluştur</button>
      </form>
      {err && <p className="mt-4 text-xs text-red-400">Hata: {err}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
            <tr>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Ad</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Oluşturma</th>
              <th className="px-4 py-3 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">Tenant yok.</td></tr>}
            {rows.map(t => (
              <tr key={t.id} className="border-t border-neutral-800 hover:bg-neutral-900/40">
                <td className="px-4 py-3 font-mono text-xs">{t.slug}</td>
                <td className="px-4 py-3">{t.name}</td>
                <td className="px-4 py-3">
                  <span className={
                    "rounded px-2 py-0.5 text-xs " + (
                      t.status === "active"   ? "bg-emerald-500/15 text-emerald-300" :
                      t.status === "suspended"? "bg-amber-500/15 text-amber-300" :
                                                "bg-neutral-700 text-neutral-300"
                    )}>{t.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-neutral-400">{fmtDateTimeTR(t.createdAt)}</td>
                <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                  <button onClick={() => openEdit(t)} className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-800">Düzenle</button>
                  <button onClick={() => del(t)} className="rounded-md border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10">Sil</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <form onSubmit={saveEdit} onClick={e => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-lg border border-neutral-700 bg-neutral-950 p-6">
            <h3 className="text-base font-semibold">Tenant düzenle</h3>
            <p className="text-xs text-neutral-500 font-mono">{editing.slug}</p>
            <input placeholder="Ad" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})}
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm" />
            <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm">
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <p className="text-[11px] text-neutral-500">
              <strong>active</strong>: normal kullanım · <strong>suspended</strong>: kullanıcılar giriş yapamaz · <strong>archived</strong>: salt-okunur
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900">İptal</button>
              <button disabled={editBusy} className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
                {editBusy ? "…" : "Kaydet"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
