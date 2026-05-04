"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fmtDateTimeTR, fmtRelativeTR } from "@/lib/datetime";

type Job = {
  id: string;
  userId: string | null;
  agentId: string | null;
  threadId: string | null;
  question: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  scheduledFor: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  hasError: boolean;
};
type Resp = { items: Job[]; total: number };
type Agent = { id: string; name: string; slug: string };

const STATUS_COLOR: Record<Job["status"], string> = {
  pending:   "bg-neutral-700 text-neutral-200",
  running:   "bg-sky-500/20 text-sky-300 animate-pulse",
  completed: "bg-emerald-500/20 text-emerald-300",
  failed:    "bg-red-500/20 text-red-300",
  cancelled: "bg-neutral-800 text-neutral-500",
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState({ status: "", agentId: "", threadId: "" });
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ take: "50", skip: String(page * 50) });
    for (const [k, v] of Object.entries(filter)) if (v) params.set(k, v);
    const r = await fetch(`/api/proxy/executive-brain/jobs?${params}`, { cache: "no-store" });
    if (r.ok) {
      const data: Resp = await r.json();
      setJobs(data.items); setTotal(data.total);
    }
    const a = await fetch("/api/proxy/executive-brain/agents", { cache: "no-store" });
    if (a.ok) setAgents(await a.json());
  }, [page, filter]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh: pending/running varsa 2 sn'de bir
  useEffect(() => {
    if (!autoRefresh) return;
    const hasActive = jobs.some(j => j.status === "pending" || j.status === "running");
    if (!hasActive) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [autoRefresh, jobs, load]);

  async function cancel(j: Job) {
    if (!confirm("Bu job iptal edilsin mi?")) return;
    await fetch(`/api/proxy/executive-brain/jobs/${j.id}/cancel`, { method: "POST" });
    load();
  }
  async function retry(j: Job) {
    await fetch(`/api/proxy/executive-brain/jobs/${j.id}/retry`, { method: "POST" });
    load();
  }

  const agentName = (id: string | null) => id ? (agents.find(a => a.id === id)?.name ?? id.slice(0, 8)) : "—";

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <Link href="/executive-brain" className="text-xs text-neutral-400 hover:text-orange-400">← Beyin'e dön</Link>
          <h1 className="mt-2 text-3xl font-semibold">📋 İş Geçmişi <span className="text-sm font-normal text-neutral-500">/ Job History</span></h1>
          <p className="mt-1 text-sm text-neutral-400">
            Tüm tek-seferlik ve zamanlanmış işlerin durumu.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/executive-brain/jobs/new" className="rounded-md bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600">
            + Yeni İş
          </Link>
          <Link href="/executive-brain/agents" className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900">
            🧠 Ajanlar
          </Link>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 md:grid-cols-5">
        <select value={filter.status} onChange={e => { setFilter({...filter, status: e.target.value}); setPage(0); }}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs">
          <option value="">— Durum —</option>
          <option value="pending">pending</option>
          <option value="running">running</option>
          <option value="completed">completed</option>
          <option value="failed">failed</option>
          <option value="cancelled">cancelled</option>
        </select>
        <select value={filter.agentId} onChange={e => { setFilter({...filter, agentId: e.target.value}); setPage(0); }}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs">
          <option value="">— Ajan —</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input placeholder="Thread ID" value={filter.threadId} onChange={e => setFilter({...filter, threadId: e.target.value})}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs font-mono" />
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
          Auto-refresh (2sn)
        </label>
        <span className="text-right text-xs text-neutral-500">
          {total} job · sayfa {page + 1}/{Math.max(1, Math.ceil(total / 50))}
          <button onClick={() => page > 0 && setPage(page - 1)} className="ml-2 rounded border border-neutral-700 px-2">←</button>
          <button onClick={() => (page + 1) * 50 < total && setPage(page + 1)} className="ml-1 rounded border border-neutral-700 px-2">→</button>
        </span>
      </div>

      {/* Job list */}
      <div className="space-y-2">
        {jobs.length === 0 && (
          <p className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-6 text-center text-sm text-neutral-500">
            Job yok. <Link href="/executive-brain" className="underline">Beyin'den</Link> bir soru sor.
          </p>
        )}
        {jobs.map(j => (
          <Link key={j.id} href={`/executive-brain/jobs/${j.id}`}
                className="block rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 hover:border-orange-500/30 hover:bg-neutral-900/80">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm text-neutral-100">{j.question}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                  <span className={`rounded px-2 py-0.5 ${STATUS_COLOR[j.status]}`}>{j.status}</span>
                  {j.agentId && <span className="text-neutral-500">🧠 {agentName(j.agentId)}</span>}
                  {j.scheduledFor && <span className="text-purple-400">⏰ scheduled</span>}
                  <span className="text-neutral-600">· {fmtRelativeTR(j.createdAt)}</span>
                  {j.startedAt && j.completedAt && (
                    <span className="text-neutral-600">·
                      {Math.round((new Date(j.completedAt).getTime() - new Date(j.startedAt).getTime()) / 100) / 10}s sürdü
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                {(j.status === "pending" || j.status === "running") && (
                  <button onClick={e => { e.preventDefault(); cancel(j); }}
                    className="rounded border border-amber-500/30 px-2 py-0.5 text-[10px] text-amber-300 hover:bg-amber-500/10">
                    İptal
                  </button>
                )}
                {j.status === "failed" && (
                  <button onClick={e => { e.preventDefault(); retry(j); }}
                    className="rounded border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-500/10">
                    Yeniden dene
                  </button>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
