"use client";

import { useEffect, useState } from "react";

type Row = { id: string; email: string; displayName: string | null; role: string; keycloakSub: string; createdAt: string };

export default function UsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", password: "", temporary: true, role: "tenant_member" });

  async function load() {
    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/proxy/admin/users", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setRows(await r.json());
    } catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setCreating(true);
    try {
      const r = await fetch("/api/proxy/admin/users", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form)
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      setForm({ email: "", firstName: "", lastName: "", password: "", temporary: true, role: "tenant_member" });
      await load();
    } catch (e) { setErr((e as Error).message); }
    finally { setCreating(false); }
  }

  async function del(id: string) {
    if (!confirm("Bu kullanıcı silinsin mi?")) return;
    const r = await fetch(`/api/proxy/admin/users/${id}`, { method: "DELETE" });
    if (r.ok) load(); else setErr(`Silinemedi: HTTP ${r.status}`);
  }

  return (
    <div className="px-8 py-8">
      <h2 className="text-2xl font-semibold">Kullanıcılar</h2>
      <p className="mt-1 text-sm text-neutral-400">Tenant'a kullanıcı ekle, rol ata, sil. Keycloak'ta otomatik karşılığı oluşturulur.</p>

      <form onSubmit={create} className="mt-6 grid gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 md:grid-cols-6">
        <input required type="email" placeholder="E-posta" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
          className="md:col-span-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" />
        <input placeholder="Ad" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" />
        <input placeholder="Soyad" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" />
        <input required type="password" placeholder="Geçici şifre" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" />
        <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm">
          <option value="tenant_member">Üye</option>
          <option value="tenant_admin">Tenant Admin</option>
        </select>
        <label className="md:col-span-5 flex items-center gap-2 text-xs text-neutral-400">
          <input type="checkbox" checked={form.temporary} onChange={e => setForm({...form, temporary: e.target.checked})} />
          Geçici şifre — kullanıcı ilk girişte değiştirsin
        </label>
        <button disabled={creating} className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
          {creating ? "Oluşturuluyor…" : "Kullanıcı oluştur"}
        </button>
      </form>

      {err && <p className="mt-4 text-xs text-red-400">Hata: {err}</p>}

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
            <tr>
              <th className="px-4 py-3">E-posta</th>
              <th className="px-4 py-3">Ad Soyad</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Oluşturma</th>
              <th className="px-4 py-3 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">Yükleniyor…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">Henüz kullanıcı yok.</td></tr>}
            {rows.map(u => (
              <tr key={u.id} className="border-t border-neutral-800 hover:bg-neutral-900/40">
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.displayName || <span className="text-neutral-500">—</span>}</td>
                <td className="px-4 py-3"><span className="rounded bg-neutral-800 px-2 py-0.5 text-xs">{u.role}</span></td>
                <td className="px-4 py-3 text-xs text-neutral-400">{new Date(u.createdAt).toLocaleString("tr-TR")}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => del(u.id)} className="rounded-md border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10">Sil</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
