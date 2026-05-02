"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtDateTimeTR } from "@/lib/datetime";

type Row = {
  id: string;
  provider: string;
  model: string;
  title: string | null;
  source: string;
  startedAt: string;
  remoteAccessAt: string | null;
  user: { id: string; email: string; displayName: string | null };
  connected: boolean;
  viewers: number;
  inputOwner: string | null;
};

export default function RemoteControlPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/proxy/remote-control/sessions", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setRows(await r.json());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Remote Control</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Lokalde çalışan <code className="font-mono text-orange-400">altaris</code> oturumlarından{" "}
            remote-control açık olanları izle ve gerekirse devral.
          </p>
        </div>
        <button
          onClick={load}
          className="rounded-md border border-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900"
        >
          Yenile
        </button>
      </div>

      <section className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/30 p-4 text-xs text-neutral-400">
        <p className="font-semibold text-neutral-200">Nasıl yayına alırım?</p>
        <ol className="mt-2 ml-4 list-decimal space-y-1">
          <li>Lokal terminalde <code className="font-mono text-orange-400">altaris</code> ile bir oturum aç.</li>
          <li>İnteraktif mod içinde <code className="font-mono text-orange-400">/remote-control</code> yaz veya başlatırken <code className="font-mono text-orange-400">altaris --remote-control</code> ile aç.</li>
          <li>Buraya gel — yayındaki oturumun listede görünür. <em>İzle</em> ile read-only, <em>Takeover</em> ile yönet.</li>
        </ol>
      </section>

      {error && <p className="mt-4 text-xs text-red-400">Hata: {error}</p>}

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
            <tr>
              <th className="px-3 py-2">Durum</th>
              <th className="px-3 py-2">Sahibi</th>
              <th className="px-3 py-2">Başlık</th>
              <th className="px-3 py-2">Provider/Model</th>
              <th className="px-3 py-2">Yayın açıldı</th>
              <th className="px-3 py-2">İzleyici</th>
              <th className="px-3 py-2 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-neutral-500">Yükleniyor…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-neutral-500">
                Yayında oturum yok. Lokal terminalde <code className="font-mono">altaris</code> + <code className="font-mono">/remote-control</code>.
              </td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="border-t border-neutral-800 hover:bg-neutral-900/40">
                <td className="px-3 py-2">
                  {r.connected ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      canlı
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
                      <span className="h-2 w-2 rounded-full bg-neutral-600" />
                      yayın açık · publisher offline
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{r.user.email}</td>
                <td className="px-3 py-2 text-xs text-neutral-300">{r.title ?? <span className="text-neutral-500">—</span>}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.provider}/{r.model}</td>
                <td className="px-3 py-2 text-xs text-neutral-400 font-mono">
                  {r.remoteAccessAt ? fmtDateTimeTR(r.remoteAccessAt) : "—"}
                </td>
                <td className="px-3 py-2 text-xs">{r.viewers}</td>
                <td className="px-3 py-2 text-right">
                  {r.connected ? (
                    <Link
                      href={`/remote-control/${r.id}`}
                      className="rounded-md bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600"
                    >
                      Bağlan →
                    </Link>
                  ) : (
                    <span className="text-xs text-neutral-600">çevrimdışı</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
