"use client";

import { useEffect, useState } from "react";
import { fmtDateTimeTR } from "@/lib/datetime";

type Row = { id: string; email: string; displayName: string | null; role: string; keycloakSub: string; createdAt: string };
type Tenant = { id: string; slug: string; name: string };
type Me = { isPlatformAdmin: boolean; tenantId: string; tenantSlug: string };

const ROLES = [
  { value: "tenant_member", label: "Üye" },
  { value: "tenant_admin",  label: "Tenant Admin" },
  { value: "platform_admin", label: "Platform Admin (cross-tenant)" },
] as const;

export default function UsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    email: "", firstName: "", lastName: "", password: "",
    temporary: true, role: "tenant_member", targetTenantId: ""
  });

  // Edit modal state
  const [editing, setEditing] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState({ email: "", firstName: "", lastName: "", role: "" });
  const [editBusy, setEditBusy] = useState(false);

  // Password reset modal state
  const [resetting, setResetting] = useState<Row | null>(null);
  const [resetForm, setResetForm] = useState({ password: "", temporary: true });
  const [resetBusy, setResetBusy] = useState(false);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const [u, m] = await Promise.all([
        fetch("/api/proxy/admin/users", { cache: "no-store" }),
        fetch("/api/proxy/me", { cache: "no-store" }),
      ]);
      if (!u.ok) throw new Error(`users HTTP ${u.status}`);
      setRows(await u.json());
      if (m.ok) {
        const mi: Me = await m.json();
        setMe(mi);
        // Platform admin → tüm tenant listesini de çek (target picker için)
        if (mi.isPlatformAdmin) {
          const t = await fetch("/api/proxy/admin/tenants", { cache: "no-store" });
          if (t.ok) setTenants(await t.json());
        }
      }
    } catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setCreating(true);
    try {
      const body = {
        ...form,
        targetTenantId: form.targetTenantId || undefined,   // boşsa kendi tenant'ı
      };
      const r = await fetch("/api/proxy/admin/users", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      setForm({ email: "", firstName: "", lastName: "", password: "", temporary: true, role: "tenant_member", targetTenantId: "" });
      await load();
    } catch (e) { setErr((e as Error).message); }
    finally { setCreating(false); }
  }

  async function del(id: string) {
    if (!confirm("Bu kullanıcı silinsin mi? Geri alınamaz.")) return;
    const r = await fetch(`/api/proxy/admin/users/${id}`, { method: "DELETE" });
    if (r.ok) load(); else setErr(`Silinemedi: HTTP ${r.status}`);
  }

  function openEdit(u: Row) {
    setEditing(u);
    const [fn = "", ...rest] = (u.displayName ?? "").split(" ");
    setEditForm({ email: u.email, firstName: fn, lastName: rest.join(" "), role: u.role });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/proxy/admin/users/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      setEditing(null);
      await load();
    } catch (e) { setErr((e as Error).message); }
    finally { setEditBusy(false); }
  }

  function openReset(u: Row) {
    setResetting(u);
    setResetForm({ password: "", temporary: true });
  }

  async function saveReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetting) return;
    setResetBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/proxy/admin/users/${resetting.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: resetForm.password, temporary: resetForm.temporary }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      setResetting(null);
    } catch (e) { setErr((e as Error).message); }
    finally { setResetBusy(false); }
  }

  return (
    <div className="px-8 py-8">
      <h2 className="text-2xl font-semibold">Kullanıcılar</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Tenant'a kullanıcı ekle, düzenle, rol ata, şifre sıfırla, sil. Keycloak'ta otomatik karşılığı oluşturulur.
      </p>

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
          {ROLES.filter(r => r.value !== "platform_admin" || me?.isPlatformAdmin).map(r =>
            <option key={r.value} value={r.value}>{r.label}</option>
          )}
        </select>
        {me?.isPlatformAdmin && tenants.length > 0 && (
          <select value={form.targetTenantId} onChange={e => setForm({...form, targetTenantId: e.target.value})}
            className="md:col-span-2 rounded-md border border-orange-500/30 bg-orange-500/5 px-3 py-2 text-sm" title="Platform admin: hangi tenant'a yaratılsın">
            <option value="">— kendi tenant'ım ({me.tenantSlug}) —</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.slug} · {t.name}</option>)}
          </select>
        )}
        <label className="md:col-span-3 flex items-center gap-2 text-xs text-neutral-400">
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
                <td className="px-4 py-3 text-xs text-neutral-400">{fmtDateTimeTR(u.createdAt)}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => openEdit(u)} className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-800">Düzenle</button>
                  <button onClick={() => openReset(u)} className="rounded-md border border-amber-500/30 px-3 py-1 text-xs text-amber-300 hover:bg-amber-500/10">Şifre sıfırla</button>
                  <button onClick={() => del(u.id)} className="rounded-md border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10">Sil</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditing(null)}>
          <form onSubmit={saveEdit} onClick={e => e.stopPropagation()} className="w-full max-w-lg space-y-3 rounded-lg border border-neutral-700 bg-neutral-950 p-6">
            <h3 className="text-base font-semibold">Kullanıcıyı düzenle</h3>
            <p className="text-xs text-neutral-500">{editing.email} · sub <span className="font-mono">{editing.keycloakSub.slice(0, 8)}…</span></p>
            <input type="email" placeholder="E-posta" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})}
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Ad" value={editForm.firstName} onChange={e => setEditForm({...editForm, firstName: e.target.value})}
                className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm" />
              <input placeholder="Soyad" value={editForm.lastName} onChange={e => setEditForm({...editForm, lastName: e.target.value})}
                className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm" />
            </div>
            <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})}
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm">
              {ROLES.filter(r => r.value !== "platform_admin" || me?.isPlatformAdmin).map(r =>
                <option key={r.value} value={r.value}>{r.label}</option>
              )}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900">İptal</button>
              <button disabled={editBusy} className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
                {editBusy ? "…" : "Kaydet"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Password reset modal */}
      {resetting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setResetting(null)}>
          <form onSubmit={saveReset} onClick={e => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-lg border border-amber-500/30 bg-neutral-950 p-6">
            <h3 className="text-base font-semibold">Şifre sıfırla</h3>
            <p className="text-xs text-neutral-500">{resetting.email}</p>
            <input required type="password" minLength={8} placeholder="Yeni şifre (min 8)" value={resetForm.password} onChange={e => setResetForm({...resetForm, password: e.target.value})}
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-xs text-neutral-400">
              <input type="checkbox" checked={resetForm.temporary} onChange={e => setResetForm({...resetForm, temporary: e.target.checked})} />
              Geçici — kullanıcı ilk girişte değiştirsin
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setResetting(null)} className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900">İptal</button>
              <button disabled={resetBusy} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                {resetBusy ? "…" : "Sıfırla"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
