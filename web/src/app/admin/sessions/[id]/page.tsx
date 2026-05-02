"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { fmtDateTimeTR, fmtTimeTR } from "@/lib/datetime";

type Detail = {
  id: string; source: string; provider: string; model: string; title: string | null;
  status: string; startedAt: string; endedAt: string | null; metadata: string;
  user: { email: string; displayName: string | null };
};
type Msg = { id: number | string; role: string; content: string; createdAt: string };

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    (async () => {
      const [d, m, p] = await Promise.all([
        fetch(`/api/proxy/admin/sessions/${id}`, { cache: "no-store" }),
        fetch(`/api/proxy/admin/sessions/${id}/messages`, { cache: "no-store" }),
        fetch(`/api/proxy/admin/presence`, { cache: "no-store" })
      ]);
      if (d.ok) setDetail(await d.json());
      if (m.ok) setMsgs(await m.json());
      if (p.ok) {
        const arr: Array<{ id: string }> = await p.json();
        setLive(arr.some(x => x.id === id));
      }
    })();
  }, [id]);

  if (!detail) return <div className="px-8 py-8 text-sm text-neutral-500">Yükleniyor…</div>;

  return (
    <div className="px-8 py-8">
      <Link href="/admin/sessions" className="text-xs text-neutral-400 hover:text-orange-400">← Tüm oturumlar</Link>
      <div className="mt-3 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{detail.title ?? "Oturum detayı"}</h2>
          <p className="mt-1 text-sm text-neutral-400">
            <span className="font-mono">{detail.user.email}</span> · {detail.source} · {detail.provider}/{detail.model}
          </p>
        </div>
        <div className="text-right">
          {live
            ? <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400 ring-1 ring-emerald-500/30"><span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>connected</span>
            : <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-800 px-3 py-1 text-xs text-neutral-500"><span className="h-2 w-2 rounded-full bg-neutral-600"></span>not connected</span>}
          {live && (detail.source === "remote" || detail.source === "cli") && (
            <Link href={`/admin/sessions/${id}/live`} className="mt-2 inline-block rounded-md bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600">
              Canlı izle / Takeover →
            </Link>
          )}
          <p className="mt-2 text-xs text-neutral-500">başlangıç {fmtDateTimeTR(detail.startedAt)}</p>
          {detail.endedAt && <p className="text-xs text-neutral-500">bitiş {fmtDateTimeTR(detail.endedAt)}</p>}
        </div>
      </div>

      <h3 className="mt-8 text-sm font-semibold text-neutral-300">Transcript ({msgs.length} mesaj)</h3>
      <div className="mt-3 space-y-2 rounded-lg border border-neutral-800 bg-neutral-950 p-4">
        {msgs.length === 0 && <p className="text-xs text-neutral-500">Mesaj yok.</p>}
        {msgs.map(m => {
          let content = m.content;
          try {
            const parsed = JSON.parse(m.content);
            content = parsed.text ?? parsed.data ?? JSON.stringify(parsed, null, 2);
          } catch {}
          return (
            <div key={m.id} className="border-l-2 border-neutral-800 pl-3">
              <div className="flex items-baseline justify-between">
                <span className={
                  m.role === "user" ? "text-xs uppercase tracking-wide text-orange-400"
                  : m.role === "assistant" ? "text-xs uppercase tracking-wide text-emerald-400"
                  : m.role === "tool" ? "text-xs uppercase tracking-wide text-blue-400"
                  : "text-xs uppercase tracking-wide text-neutral-500"
                }>{m.role}</span>
                <span className="text-[10px] text-neutral-600 font-mono">{fmtTimeTR(m.createdAt)}</span>
              </div>
              <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-xs text-neutral-200">{content}</pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}
