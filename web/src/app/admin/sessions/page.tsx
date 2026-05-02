"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtDateTimeTR } from "@/lib/datetime";

type SessionRow = {
  id: string;
  source: string;
  provider: string;
  model: string;
  title: string | null;
  status: string;
  startedAt: string;
  endedAt: string | null;
  user: { id: string; email: string; displayName: string | null };
};

type ActivePresence = { id: string };

export default function AdminSessionsPage() {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [active, setActive] = useState<Set<string>>(new Set());
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ q: "", source: "", provider: "", status: "", from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const TAKE = 50;

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    params.set("take", String(TAKE));
    params.set("skip", String(page * TAKE));
    const [s, p] = await Promise.all([
      fetch(`/api/proxy/admin/sessions?${params}`, { cache: "no-store" }),
      fetch(`/api/proxy/admin/presence`, { cache: "no-store" })
    ]);
    if (s.ok) { const d = await s.json(); setRows(d.items); setTotal(d.total); }
    if (p.ok) { const a: ActivePresence[] = await p.json(); setActive(new Set(a.map(x => x.id))); }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / TAKE));

  return (
    <div className="px-8 py-8">
      <h2 className="text-2xl font-semibold">Tüm oturumlar</h2>
      <p className="mt-1 text-sm text-neutral-400">Tenant'taki tüm kullanıcıların CLI / Web / Remote terminal oturumları. Canlı durum, transcript erişimi.</p>

      <form onSubmit={e => { e.preventDefault(); setPage(0); load(); }} className="mt-6 grid gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 md:grid-cols-7">
        <input placeholder="Arama (e-posta, başlık, model)" value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })}
          className="md:col-span-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" />
        <select value={filters.source} onChange={e => setFilters({ ...filters, source: e.target.value })} className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm">
          <option value="">Tüm kaynaklar</option><option value="cli">CLI</option><option value="web">Web</option><option value="remote">Remote</option>
        </select>
        <select value={filters.provider} onChange={e => setFilters({ ...filters, provider: e.target.value })} className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm">
          <option value="">Tüm provider</option><option value="anthropic">Anthropic</option><option value="ollama">Ollama</option><option value="lmstudio">LM Studio</option><option value="shell">Shell</option>
        </select>
        <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm">
          <option value="">Tüm durumlar</option><option value="active">Aktif</option><option value="ended">Sonlanmış</option><option value="killed">Kapatıldı</option><option value="error">Hata</option>
        </select>
        <input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" />
        <button className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">Filtrele</button>
      </form>

      <div className="mt-6 flex items-center justify-between text-xs text-neutral-400">
        <span>{loading ? "Yükleniyor…" : `${total} oturum · sayfa ${page + 1}/${totalPages}`}</span>
        <span><span className="inline-block h-2 w-2 rounded-full bg-emerald-400 mr-1.5"></span>{active.size} canlı</span>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
            <tr>
              <th className="px-3 py-2">Canlı</th>
              <th className="px-3 py-2">Kullanıcı</th>
              <th className="px-3 py-2">Kaynak</th>
              <th className="px-3 py-2">Provider/Model</th>
              <th className="px-3 py-2">Başlık</th>
              <th className="px-3 py-2">Durum</th>
              <th className="px-3 py-2">Başlangıç</th>
              <th className="px-3 py-2 text-right">Detay</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && <tr><td colSpan={8} className="px-4 py-8 text-center text-neutral-500">Eşleşen oturum yok.</td></tr>}
            {rows.map(s => (
              <tr key={s.id} className="border-t border-neutral-800 hover:bg-neutral-900/40">
                <td className="px-3 py-2">
                  {active.has(s.id)
                    ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>connected</span>
                    : <span className="text-xs text-neutral-600">not connected</span>}
                </td>
                <td className="px-3 py-2 text-xs">{s.user.email}</td>
                <td className="px-3 py-2"><span className="rounded bg-neutral-800 px-2 py-0.5 text-xs">{s.source}</span></td>
                <td className="px-3 py-2 font-mono text-xs">{s.provider}/{s.model}</td>
                <td className="px-3 py-2 text-xs text-neutral-300">{s.title ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{s.status}</td>
                <td className="px-3 py-2 text-xs text-neutral-400 font-mono">{fmtDateTimeTR(s.startedAt)}</td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/admin/sessions/${s.id}`} className="text-xs text-orange-400 hover:underline">Görüntüle →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between text-xs">
        <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} className="rounded-md border border-neutral-800 px-3 py-1 disabled:opacity-30">← Önceki</button>
        <button disabled={(page + 1) * TAKE >= total} onClick={() => setPage(p => p + 1)} className="rounded-md border border-neutral-800 px-3 py-1 disabled:opacity-30">Sonraki →</button>
      </div>
    </div>
  );
}
