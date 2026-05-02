"use client";
import { useEffect, useState } from "react";
import { fmtDateTimeTR } from "@/lib/datetime";

type Row = { id: string; name: string; prefix: string; lastUsedAt: string | null; expiresAt: string | null; createdAt: string };

export default function ApiKeysPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [validDays, setValidDays] = useState<number | "">(365);
  const [created, setCreated] = useState<{ name: string; secret: string; prefix: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/proxy/admin/api-keys", { cache: "no-store" });
    if (r.ok) setRows(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    const r = await fetch("/api/proxy/admin/api-keys", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, validDays: validDays === "" ? null : validDays })
    });
    if (!r.ok) { setErr(await r.text()); return; }
    setCreated(await r.json());
    setName(""); load();
  }

  async function revoke(id: string) {
    if (!confirm("Anahtar iptal edilsin mi?")) return;
    await fetch(`/api/proxy/admin/api-keys/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <h2 className="text-2xl font-semibold">API anahtarları</h2>
      <p className="mt-1 text-sm text-neutral-400">CLI / Desktop cihazları için uzun ömürlü token. Sırrı sadece oluşturma anında bir kez gösterilir.</p>

      <form onSubmit={create} className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 md:grid-cols-4">
        <input required placeholder="Anahtar adı (ör. ofis-macbook)" value={name} onChange={e => setName(e.target.value)}
          className="md:col-span-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" />
        <input type="number" min="1" placeholder="Geçerlilik (gün)" value={validDays} onChange={e => setValidDays(e.target.value === "" ? "" : +e.target.value)}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" />
        <button className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">Oluştur</button>
      </form>

      {created && (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
          <p className="text-emerald-300">✓ <strong>{created.name}</strong> oluşturuldu</p>
          <p className="mt-2 text-xs text-neutral-400">Bu sır sadece şimdi gösterilir, kopyalayın:</p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-black p-3 font-mono text-xs text-orange-300">{created.secret}</pre>
        </div>
      )}
      {err && <p className="mt-4 text-xs text-red-400">Hata: {err}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
            <tr><th className="px-4 py-3">İsim</th><th className="px-4 py-3">Prefix</th><th className="px-4 py-3">Son kullanım</th><th className="px-4 py-3">Bitiş</th><th className="px-4 py-3 text-right">İşlem</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">Anahtar yok.</td></tr>}
            {rows.map(k => (
              <tr key={k.id} className="border-t border-neutral-800">
                <td className="px-4 py-3">{k.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{k.prefix}…</td>
                <td className="px-4 py-3 text-xs text-neutral-400">{k.lastUsedAt ? fmtDateTimeTR(k.lastUsedAt) : "—"}</td>
                <td className="px-4 py-3 text-xs text-neutral-400">{k.expiresAt ? fmtDateTimeTR(k.expiresAt) : "süresiz"}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => revoke(k.id)} className="rounded-md border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10">İptal</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
