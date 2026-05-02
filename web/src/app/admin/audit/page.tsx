"use client";
import { useEffect, useState } from "react";
import { fmtDateTimeTR } from "@/lib/datetime";

type Row = { id: number; actor: string; action: string; resourceType: string | null; resourceId: string | null; ip: string | null; occurredAt: string };
type Resp = { items: Row[]; total: number };

const PAGE_SIZE = 100;

export default function AuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState({ q: "", actor: "", action: "", resourceType: "", from: "", to: "" });

  async function load(p = page) {
    setLoading(true);
    const params = new URLSearchParams({ take: String(PAGE_SIZE), skip: String(p * PAGE_SIZE) });
    for (const [k, v] of Object.entries(filter)) if (v) params.set(k, v);
    const r = await fetch(`/api/proxy/admin/audit?${params}`, { cache: "no-store" });
    if (r.ok) {
      const data: Resp = await r.json();
      setRows(data.items); setTotal(data.total);
    }
    setLoading(false);
  }
  useEffect(() => { load(0); /* eslint-disable-next-line */ }, []);

  function applyFilter() { setPage(0); load(0); }
  function nextPage()    { if ((page + 1) * PAGE_SIZE < total) { setPage(page + 1); load(page + 1); } }
  function prevPage()    { if (page > 0) { setPage(page - 1); load(page - 1); } }

  return (
    <div className="px-8 py-8">
      <h2 className="text-2xl font-semibold">Denetim kaydı</h2>
      <p className="mt-1 text-sm text-neutral-400">Tenant'ta yapılan tüm yönetim ve oturum işlemleri.</p>

      <form onSubmit={e => { e.preventDefault(); applyFilter(); }}
            className="mt-6 grid gap-2 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 md:grid-cols-7">
        <input placeholder="Hızlı ara (actor/action/IP)" value={filter.q} onChange={e => setFilter({...filter, q: e.target.value})}
          className="md:col-span-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs" />
        <input placeholder="Aktör" value={filter.actor} onChange={e => setFilter({...filter, actor: e.target.value})}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs" />
        <input placeholder="İşlem" value={filter.action} onChange={e => setFilter({...filter, action: e.target.value})}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs" />
        <input placeholder="Tip" value={filter.resourceType} onChange={e => setFilter({...filter, resourceType: e.target.value})}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs" />
        <input type="date" value={filter.from} onChange={e => setFilter({...filter, from: e.target.value})}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs" />
        <input type="date" value={filter.to} onChange={e => setFilter({...filter, to: e.target.value})}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs" />
        <div className="md:col-span-7 flex items-center gap-2">
          <button className="rounded-md bg-orange-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-orange-600">Filtrele</button>
          <button type="button"
            onClick={() => { setFilter({ q: "", actor: "", action: "", resourceType: "", from: "", to: "" }); setPage(0); setTimeout(() => load(0), 0); }}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900">Temizle</button>
          <span className="ml-auto text-xs text-neutral-500">
            {total} kayıt · sayfa {page + 1} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}
          </span>
          <button type="button" onClick={prevPage} disabled={page === 0}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900 disabled:opacity-40">←</button>
          <button type="button" onClick={nextPage} disabled={(page + 1) * PAGE_SIZE >= total}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900 disabled:opacity-40">→</button>
        </div>
      </form>

      <div className="mt-4 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
            <tr><th className="px-4 py-2">Zaman</th><th className="px-4 py-2">Aktör</th><th className="px-4 py-2">İşlem</th><th className="px-4 py-2">Kaynak</th><th className="px-4 py-2">IP</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">Yükleniyor…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">Eşleşen kayıt yok.</td></tr>}
            {rows.map(a => (
              <tr key={a.id} className="border-t border-neutral-800 hover:bg-neutral-900/40">
                <td className="px-4 py-2 text-xs text-neutral-400 font-mono">{fmtDateTimeTR(a.occurredAt)}</td>
                <td className="px-4 py-2 text-xs">{a.actor}</td>
                <td className="px-4 py-2"><span className="rounded bg-neutral-800 px-2 py-0.5 text-xs">{a.action}</span></td>
                <td className="px-4 py-2 text-xs text-neutral-400">{a.resourceType ? `${a.resourceType}:${a.resourceId?.slice(0,8) ?? ""}` : "—"}</td>
                <td className="px-4 py-2 text-xs font-mono text-neutral-500">{a.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
