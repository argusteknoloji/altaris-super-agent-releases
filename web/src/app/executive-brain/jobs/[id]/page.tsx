"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { fmtDateTimeTR } from "@/lib/datetime";

// xterm.js bundle ~80KB — client-only, lazy import
const JobLiveTerminal = dynamic(() => import("./JobLiveTerminal"), { ssr: false });

type Citation = { vault: string; path: string; chunkIndex: number; snippet: string; distance: number };
type TraceStep = { step: string; ms: number; [k: string]: unknown };
type Job = {
  id: string;
  agentId: string | null;
  threadId: string | null;
  question: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  answer: string | null;
  citations: string | null;        // jsonb string
  errorText: string | null;
  trace: string | null;            // jsonb string
  scheduledFor: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  /** Live PTY preview session id — pending/running iken xterm.js viewer bağlanır */
  remoteSessionId: string | null;
};
type ThreadJob = { id: string; question: string; status: string; createdAt: string };

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-neutral-700 text-neutral-200",
  running:   "bg-sky-500/20 text-sky-300 animate-pulse",
  completed: "bg-emerald-500/20 text-emerald-300",
  failed:    "bg-red-500/20 text-red-300",
  cancelled: "bg-neutral-800 text-neutral-500",
};

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [thread, setThread] = useState<ThreadJob[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [followup, setFollowup] = useState("");
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);

  async function submitFollowup() {
    if (!followup.trim() || sending) return;
    setSending(true);
    setSendErr(null);
    try {
      const r = await fetch(`/api/proxy/executive-brain/jobs/${id}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: followup.trim() }),
      });
      if (!r.ok) {
        const t = await r.text();
        setSendErr(`HTTP ${r.status} — ${t.slice(0, 200)}`);
        return;
      }
      const data = await r.json() as { id: string };
      router.push(`/executive-brain/jobs/${data.id}`);
    } catch (e) {
      setSendErr((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function load() {
    const r = await fetch(`/api/proxy/executive-brain/jobs/${id}`, { cache: "no-store" });
    if (!r.ok) { setErr(`HTTP ${r.status}`); return; }
    const j: Job = await r.json();
    setJob(j);
    if (j.threadId) {
      const tr = await fetch(`/api/proxy/executive-brain/jobs?threadId=${j.threadId}&take=20`, { cache: "no-store" });
      if (tr.ok) {
        const data = await tr.json() as { items: ThreadJob[] };
        setThread(data.items);
      }
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  // Auto-refresh while running
  useEffect(() => {
    if (!job || (job.status !== "pending" && job.status !== "running")) return;
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  // eslint-disable-next-line
  }, [job?.status]);

  if (err) return <p className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 text-sm text-red-400">{err}</p>;
  if (!job) return <p className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 text-sm text-neutral-500">Yükleniyor…</p>;

  const citations: Citation[] = job.citations ? JSON.parse(job.citations) : [];
  const trace: TraceStep[] = job.trace ? JSON.parse(job.trace) : [];
  const totalMs = trace.reduce((sum, t) => sum + (t.ms || 0), 0);

  function renderAnswer(answer: string) {
    const parts = answer.split(/(\[\d+\])/g);
    return parts.map((p, i) => {
      const m = p.match(/^\[(\d+)\]$/);
      if (!m) return <span key={i}>{p}</span>;
      const idx = parseInt(m[1]) - 1;
      const src = citations[idx];
      if (!src) return <span key={i} className="text-neutral-500">{p}</span>;
      return (
        <a key={i} href={`/vaults/${src.vault}`}
          className="mx-0.5 inline-flex items-center rounded bg-orange-500/15 px-1.5 py-0 text-[11px] font-medium text-orange-300 hover:bg-orange-500/25"
          title={`${src.vault}/${src.path}\n${src.snippet}`}>
          {p}
        </a>
      );
    });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-10">
      <Link href="/executive-brain/jobs" className="text-xs text-neutral-400 hover:text-orange-400">← Tüm job'lar</Link>

      <header className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <h1 className="text-lg sm:text-xl font-semibold text-neutral-100 break-words">{job.question}</h1>
        <span className={`shrink-0 self-start rounded px-3 py-1 text-xs ${STATUS_COLOR[job.status]}`}>{job.status}</span>
      </header>
      <p className="mt-2 text-xs text-neutral-500 font-mono">
        Job {job.id.slice(0, 8)} · Thread {job.threadId?.slice(0, 8) ?? "—"} · {fmtDateTimeTR(job.createdAt)}
      </p>

      {/* Live PTY preview — running iken xterm.js ile CLI subprocess'in canlı stdout'u */}
      {job.remoteSessionId && (job.status === "pending" || job.status === "running") && (
        <section className="mt-6 rounded-lg border border-sky-500/30 bg-neutral-950 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-mono text-sky-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
            CANLI · CLI çalışıyor
            <span className="ml-auto text-neutral-500">session {job.remoteSessionId.slice(0, 8)}</span>
          </div>
          <JobLiveTerminal sessionId={job.remoteSessionId} />
        </section>
      )}

      {/* Thread (multi-turn previous Q&A) */}
      {thread.length > 1 && (
        <details className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/30 p-3">
          <summary className="cursor-pointer text-xs text-neutral-400">
            🔗 Bu konuşmadaki diğer sorular ({thread.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {thread.map(t => (
              <li key={t.id}>
                <Link href={`/executive-brain/jobs/${t.id}`}
                  className={"block rounded px-2 py-1 hover:bg-neutral-800 " + (t.id === job.id ? "bg-neutral-800 text-orange-400" : "text-neutral-300")}>
                  {t.question}
                  <span className="ml-2 text-[10px] text-neutral-600">{fmtDateTimeTR(t.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Answer */}
      {job.answer && (
        <section className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/40 p-6">
          <h2 className="mb-3 text-sm font-semibold text-neutral-300">Cevap</h2>
          <div className="text-sm leading-relaxed text-neutral-100 whitespace-pre-wrap">
            {renderAnswer(job.answer)}
          </div>
        </section>
      )}

      {/* Follow-up: aynı CLI session üzerinden devam et */}
      {(job.status === "completed" || job.status === "failed") && (
        <section className="mt-6 rounded-lg border border-orange-500/30 bg-neutral-900/40 p-4">
          <h2 className="mb-2 text-sm font-semibold text-neutral-300">↳ Devam et</h2>
          <p className="mb-3 text-[11px] text-neutral-500">
            Aynı CLI session üzerinden takip sorusu — önceki tüm context (dosyalar, araç çıktıları, cevap) korunur.
          </p>
          <textarea
            value={followup}
            onChange={e => setFollowup(e.target.value)}
            onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submitFollowup(); }}
            placeholder="Şimdi şunu da yap..."
            disabled={sending}
            rows={3}
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-orange-500 focus:outline-none disabled:opacity-50"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-neutral-600">⌘/Ctrl + Enter ile gönder</span>
            <button
              onClick={submitFollowup}
              disabled={!followup.trim() || sending}
              className="rounded bg-orange-500 px-4 py-1.5 text-xs font-medium text-neutral-950 hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? "Gönderiliyor…" : "Gönder"}
            </button>
          </div>
          {sendErr && <p className="mt-2 text-[11px] text-red-400">{sendErr}</p>}
        </section>
      )}

      {/* Error */}
      {job.errorText && (
        <section className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <h2 className="mb-2 text-sm font-semibold text-red-300">Hata</h2>
          <pre className="overflow-x-auto text-xs text-red-200">{job.errorText}</pre>
        </section>
      )}

      {/* Citations */}
      {citations.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-neutral-300">📚 Kaynaklar ({citations.length})</h2>
          <div className="space-y-2">
            {citations.map((c, i) => (
              <div key={i} className="rounded border border-neutral-800 bg-neutral-900/30 p-3">
                <div className="flex items-baseline justify-between text-xs">
                  <p className="font-mono text-orange-400">[{i + 1}] {c.vault}/{c.path}:{c.chunkIndex}</p>
                  <span className="text-[10px] text-neutral-600">d={c.distance.toFixed(3)}</span>
                </div>
                <p className="mt-1 text-xs text-neutral-400">{c.snippet}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trace (debug) */}
      {trace.length > 0 && (
        <details className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/30 p-3">
          <summary className="cursor-pointer text-xs text-neutral-400">
            ⚙ Trace ({trace.length} adım, toplam {totalMs}ms)
          </summary>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-xs">
            <thead className="text-left text-neutral-500">
              <tr><th className="pb-1">Step</th><th className="pb-1 w-20 text-right">ms</th><th className="pb-1">Detay</th></tr>
            </thead>
            <tbody>
              {trace.map((t, i) => (
                <tr key={i} className="border-t border-neutral-800">
                  <td className="py-1 font-mono">{t.step}</td>
                  <td className="py-1 text-right text-neutral-400">{t.ms}</td>
                  <td className="py-1 text-[10px] text-neutral-500">
                    {Object.entries(t).filter(([k]) => k !== "step" && k !== "ms")
                      .map(([k, v]) => `${k}=${v}`).join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </details>
      )}
    </main>
  );
}
