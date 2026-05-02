"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtRelativeTR, fmtDateTimeTR } from "@/lib/datetime";

type Citation = { vault: string; path: string; chunkIndex: number; snippet: string; distance: number };
type Job = {
  id: string; agentId: string | null; question: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  answer: string | null; citations: string | null;
  scheduledFor: string | null; createdAt: string; completedAt: string | null;
};
type Agent = { id: string; slug: string; name: string; description: string | null; enabled: boolean; scheduleCron: string | null };

/**
 * Brief feed — scheduled cron job'larının cevaplarını günlük gazete gibi
 * akış halinde gösterir. Yöneticinin "bugün ne oldu" özetini bir bakışta
 * görmesi için. Agent kartları üstte, brief akışı altta.
 */
export default function BriefsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [briefs, setBriefs] = useState<Job[]>([]);
  const [filter, setFilter] = useState({ agentId: "", days: 30 });
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const [a, j] = await Promise.all([
      fetch("/api/proxy/executive-brain/agents", { cache: "no-store" }).then(r => r.ok ? r.json() : []),
      fetch(`/api/proxy/executive-brain/jobs?status=completed&take=200`, { cache: "no-store" })
        .then(r => r.ok ? r.json() : { items: [] })
        .then((d: { items: Job[] }) => d.items),
    ]);
    setAgents(a);
    // Sadece scheduled (cron-tetiklenen) brief'leri filtrele:
    // user_id == null + scheduled_for != null => system-scheduled
    // (bunu gerçekten ayırt etmek için API listJobs response'unda flag eklenmeli;
    // şimdilik scheduledFor != null veya question == agent.schedule_prompt heuristiği)
    setBriefs(j);
  }
  useEffect(() => { load(); }, []);

  async function triggerNow(a: Agent) {
    setBusy(a.id);
    try {
      const r = await fetch("/api/proxy/executive-brain/jobs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "Şu anki durumu özetle (manuel tetik)", agentId: a.id }),
      });
      if (!r.ok) throw new Error(await r.text());
      const sub = await r.json() as { id: string };
      window.location.href = `/executive-brain/jobs/${sub.id}`;
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(null); }
  }

  const cutoff = Date.now() - filter.days * 86400_000;
  const visible = briefs.filter(b => {
    if (new Date(b.createdAt).getTime() < cutoff) return false;
    if (filter.agentId && b.agentId !== filter.agentId) return false;
    return true;
  });
  const agentMap = new Map(agents.map(a => [a.id, a]));

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <Link href="/executive-brain" className="text-xs text-neutral-400 hover:text-orange-400">← Beyin</Link>
          <h1 className="mt-2 text-3xl font-semibold">📰 Brief Feed</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Cron-tetiklenen ajan özetleri — yöneticinin günlük "ne oldu" akışı.
          </p>
        </div>
        <Link href="/executive-brain/agents" className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900">
          🧠 Ajan ayarları
        </Link>
      </div>

      {/* Active scheduled agents */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-neutral-300">Cron-aktif ajanlar</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.filter(a => a.enabled && a.scheduleCron).length === 0 && (
            <p className="col-span-full text-sm text-neutral-500">
              Cron-aktif ajan yok. <Link href="/executive-brain/agents" className="underline">Ajan oluştur</Link> ve "schedule_cron" set et.
            </p>
          )}
          {agents.filter(a => a.enabled && a.scheduleCron).map(a => (
            <div key={a.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-orange-400">{a.name}</h3>
                <span className="text-[10px] font-mono text-purple-300">⏰ {a.scheduleCron}</span>
              </div>
              {a.description && <p className="mt-1 text-xs text-neutral-400 line-clamp-2">{a.description}</p>}
              <button onClick={() => triggerNow(a)} disabled={busy === a.id}
                className="mt-3 w-full rounded-md border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50">
                {busy === a.id ? "…" : "Şimdi tetikle"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/40 p-2">
        <select value={filter.agentId} onChange={e => setFilter({...filter, agentId: e.target.value})}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1 text-xs">
          <option value="">— Tüm ajanlar —</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={filter.days} onChange={e => setFilter({...filter, days: Number(e.target.value)})}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1 text-xs">
          <option value={1}>Son 24 saat</option>
          <option value={7}>Son 7 gün</option>
          <option value={30}>Son 30 gün</option>
          <option value={90}>Son 90 gün</option>
        </select>
        <span className="ml-auto text-xs text-neutral-500">{visible.length} brief</span>
      </div>

      {/* Feed */}
      <section className="space-y-4">
        {visible.length === 0 && (
          <p className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-6 text-center text-sm text-neutral-500">
            Bu aralıkta brief yok.
          </p>
        )}
        {visible.map(b => {
          const agent = b.agentId ? agentMap.get(b.agentId) : null;
          let citations: Citation[] = [];
          try { citations = b.citations ? JSON.parse(b.citations) : []; } catch {}
          return (
            <article key={b.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-5">
              <header className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-orange-400">{agent?.name ?? "—"}</h3>
                  <p className="text-xs text-neutral-500">{b.question}</p>
                </div>
                <Link href={`/executive-brain/jobs/${b.id}`} className="text-[10px] text-neutral-500 hover:text-orange-400">
                  {fmtRelativeTR(b.createdAt)} · detay →
                </Link>
              </header>
              <div className="text-sm leading-relaxed text-neutral-200 whitespace-pre-wrap line-clamp-12">
                {b.answer}
              </div>
              {citations.length > 0 && (
                <p className="mt-3 text-[10px] text-neutral-500">
                  📚 {citations.length} kaynak · {citations.slice(0, 3).map(c => c.vault).join(", ")}{citations.length > 3 ? "…" : ""}
                </p>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
