"use client";
import { useEffect, useState } from "react";
import { fmtDateTimeTR } from "@/lib/datetime";

type Row = { id: number; actor: string; action: string; resourceType: string | null; resourceId: string | null; ip: string | null; occurredAt: string };

export default function AuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/proxy/admin/audit?take=500", { cache: "no-store" });
      if (r.ok) setRows(await r.json());
      setLoading(false);
    })();
  }, []);

  return (
    <div className="px-8 py-8">
      <h2 className="text-2xl font-semibold">Denetim kaydı</h2>
      <p className="mt-1 text-sm text-neutral-400">Tenant'ta yapılan tüm yönetim ve oturum işlemleri (son 500).</p>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
            <tr><th className="px-4 py-2">Zaman</th><th className="px-4 py-2">Aktör</th><th className="px-4 py-2">İşlem</th><th className="px-4 py-2">Kaynak</th><th className="px-4 py-2">IP</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">Yükleniyor…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">Henüz kayıt yok.</td></tr>}
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
