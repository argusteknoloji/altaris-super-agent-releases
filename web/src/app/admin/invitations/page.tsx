"use client";
import { useEffect, useState } from "react";

type Inv = { id: string; email: string; role: string; expiresAt: string; createdAt: string };

export default function InvitationsPage() {
  const [rows, setRows] = useState<Inv[]>([]);
  const [form, setForm] = useState({ email: "", role: "tenant_member", validDays: 7 });
  const [lastToken, setLastToken] = useState<{ email: string; link: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/proxy/admin/invitations", { cache: "no-store" });
    if (r.ok) setRows(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    const r = await fetch("/api/proxy/admin/invitations", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form)
    });
    if (!r.ok) { setErr(await r.text()); return; }
    const data = await r.json();
    setLastToken({ email: data.email, link: `${window.location.origin}/invite/${data.token}` });
    setForm({ email: "", role: "tenant_member", validDays: 7 });
    load();
  }

  async function del(id: string) {
    if (!confirm("Davet iptal edilsin mi?")) return;
    await fetch(`/api/proxy/admin/invitations/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="px-8 py-8">
      <h2 className="text-2xl font-semibold">Davetler</h2>
      <p className="mt-1 text-sm text-neutral-400">Kullanıcı oluşturmadan e-posta ile davet linki gönder. Davetli linke tıklayıp kayıt olur.</p>

      <form onSubmit={create} className="mt-6 grid gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 md:grid-cols-5">
        <input required type="email" placeholder="E-posta" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
          className="md:col-span-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" />
        <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm">
          <option value="tenant_member">Üye</option>
          <option value="tenant_admin">Tenant Admin</option>
        </select>
        <input type="number" min="1" max="90" value={form.validDays} onChange={e => setForm({...form, validDays: +e.target.value})}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" placeholder="Geçerlilik (gün)" />
        <button className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">Davet gönder</button>
      </form>

      {lastToken && (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
          <p className="text-emerald-300">✓ Davet oluşturuldu — <strong>{lastToken.email}</strong></p>
          <p className="mt-2 break-all text-xs text-neutral-300 font-mono">{lastToken.link}</p>
          <p className="mt-2 text-xs text-neutral-500">Bu link bir kez gösterilir. Davetliye e-posta ile iletin.</p>
        </div>
      )}
      {err && <p className="mt-4 text-xs text-red-400">Hata: {err}</p>}

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
            <tr><th className="px-4 py-3">E-posta</th><th className="px-4 py-3">Rol</th><th className="px-4 py-3">Oluşturma</th><th className="px-4 py-3">Bitiş</th><th className="px-4 py-3 text-right">İşlem</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">Bekleyen davet yok.</td></tr>}
            {rows.map(i => (
              <tr key={i.id} className="border-t border-neutral-800">
                <td className="px-4 py-3">{i.email}</td>
                <td className="px-4 py-3"><span className="rounded bg-neutral-800 px-2 py-0.5 text-xs">{i.role}</span></td>
                <td className="px-4 py-3 text-xs text-neutral-400">{new Date(i.createdAt).toLocaleString("tr-TR")}</td>
                <td className="px-4 py-3 text-xs text-neutral-400">{new Date(i.expiresAt).toLocaleString("tr-TR")}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => del(i.id)} className="rounded-md border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10">İptal</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
