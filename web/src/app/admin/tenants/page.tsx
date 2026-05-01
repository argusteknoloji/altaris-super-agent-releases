"use client";
import { useEffect, useState } from "react";

type Row = { id: string; slug: string; name: string; status: string; createdAt: string };

export default function TenantsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({ slug: "", name: "" });
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

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

  if (forbidden) {
    return (
      <div className="px-8 py-16 text-center">
        <h2 className="text-2xl font-semibold">Yetki yok</h2>
        <p className="mt-2 text-sm text-neutral-400">Tenant yönetimi için <code className="font-mono text-orange-400">platform_admin</code> rolü gereklidir.</p>
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      <h2 className="text-2xl font-semibold">Tenant'lar (platform yönetimi)</h2>
      <p className="mt-1 text-sm text-neutral-400">Yeni kuruluş için tenant açın. Slug login sırasında JWT'de <code className="font-mono">tid</code> claim'i olur.</p>

      <form onSubmit={create} className="mt-6 grid gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 md:grid-cols-3">
        <input required placeholder="slug (ör. acme-corp)" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm font-mono" />
        <input required placeholder="Tam ad (ör. Acme Corporation)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" />
        <button className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">Tenant oluştur</button>
      </form>
      {err && <p className="mt-4 text-xs text-red-400">Hata: {err}</p>}

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
            <tr><th className="px-4 py-3">Slug</th><th className="px-4 py-3">Ad</th><th className="px-4 py-3">Durum</th><th className="px-4 py-3">Oluşturma</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-neutral-500">Tenant yok.</td></tr>}
            {rows.map(t => (
              <tr key={t.id} className="border-t border-neutral-800">
                <td className="px-4 py-3 font-mono text-xs">{t.slug}</td>
                <td className="px-4 py-3">{t.name}</td>
                <td className="px-4 py-3 text-xs">{t.status}</td>
                <td className="px-4 py-3 text-xs text-neutral-400">{new Date(t.createdAt).toLocaleString("tr-TR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
