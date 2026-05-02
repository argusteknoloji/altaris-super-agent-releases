"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

type Citation = { vault: string; path: string; chunkIndex: number; snippet: string; distance: number };
type Agent = { id: string; slug: string; name: string; description: string | null; enabled: boolean };
type Job = {
  id: string; question: string; status: "pending" | "running" | "completed" | "failed" | "cancelled";
  answer: string | null; citations: string | null; errorText: string | null;
};

const SUGGESTED = [
  "Geçen çeyrek hangi müşteri grubunda marjlarımız düştü?",
  "Bu sözleşmeyi imzalarsak nakit akışımıza 6 ay sonra ne olur?",
  "Satış ekibinin geçen hafta konuştuğu müşterilerden hangileri risk sinyali veriyor?",
];

export default function ExecutiveBrainPage() {
  const [input, setInput] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState<string>("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Array<{ q: string; jobId: string; job?: Job }>>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/proxy/executive-brain/agents", { cache: "no-store" })
      .then(r => r.ok ? r.json() : [])
      .then((list: Agent[]) => setAgents(list.filter(a => a.enabled)));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  // Active turn'leri poll et (status değişince UI güncellesin)
  const pollActive = useCallback(async () => {
    const updates = await Promise.all(turns.map(async (t) => {
      if (t.job?.status === "completed" || t.job?.status === "failed" || t.job?.status === "cancelled") return t;
      const r = await fetch(`/api/proxy/executive-brain/jobs/${t.jobId}`, { cache: "no-store" });
      if (!r.ok) return t;
      const job: Job = await r.json();
      return { ...t, job };
    }));
    setTurns(updates);
    setBusy(updates.some(t => !t.job || t.job.status === "pending" || t.job.status === "running"));
  }, [turns]);
  useEffect(() => {
    if (turns.length === 0) return;
    if (!turns.some(t => !t.job || t.job.status === "pending" || t.job.status === "running")) return;
    const i = setInterval(pollActive, 1500);
    return () => clearInterval(i);
  }, [turns, pollActive]);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/proxy/executive-brain/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          agentId: agentId || null,
          threadId: threadId,
        }),
      });
      if (!r.ok) {
        const txt = await r.text();
        alert(`Job submit fail: ${txt}`);
        setBusy(false); return;
      }
      const submitResp = await r.json() as { id: string; threadId: string };
      if (!threadId) setThreadId(submitResp.threadId);
      setInput("");
      setTurns(t => [...t, { q: question, jobId: submitResp.id }]);
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  }

  function newThread() {
    setTurns([]); setThreadId(null);
  }

  function renderAnswer(answer: string, citations: Citation[]) {
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
    <main className="mx-auto flex h-[calc(100vh-3rem)] max-w-5xl flex-col">
      <header className="border-b border-neutral-800 bg-neutral-950 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <span className="text-orange-400">🧠</span>
              Executive Brain
              {threadId && <span className="font-mono text-[10px] text-neutral-500">thread {threadId.slice(0, 8)}</span>}
            </h1>
            <p className="mt-1 text-sm text-neutral-400">Şirketin İkinci Beyni — vault'lardan kaynaklı cevap.</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={agentId} onChange={e => setAgentId(e.target.value)}
              className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs">
              <option value="">— Default ajan —</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button onClick={newThread} className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900" title="Yeni konuşma">
              + Yeni
            </button>
            <Link href="/executive-brain/agents" className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900">Ajanlar</Link>
            <Link href="/executive-brain/jobs" className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900">Jobs</Link>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        {turns.length === 0 && (
          <div className="mx-auto max-w-2xl">
            <p className="mb-4 text-sm text-neutral-400">Yöneticinin masasında üç tip soru var:</p>
            <div className="space-y-2">
              {SUGGESTED.map(q => (
                <button key={q} onClick={() => ask(q)} disabled={busy}
                  className="block w-full rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-left text-sm text-neutral-200 hover:border-orange-500/40 hover:bg-neutral-900/80 disabled:opacity-50">
                  {q}
                </button>
              ))}
            </div>
            <div className="mt-8 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200/80">
              <strong>İpucu:</strong> <Link href="/executive-brain/agents" className="underline">Ajanlar sayfası</Link>
              {" "}ile rolüne göre ajanlar oluştur (CFO, Risk, Sözleşme); soru sorarken üst seçicide hangi ajan olduğunu seç.
              Vault'a belge ekledikten sonra admin panelinden vault'u <code>visibility=executive</code> yap + reindex.
            </div>
          </div>
        )}

        <div className="space-y-6">
          {turns.map((t, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-end">
                <div className="max-w-2xl rounded-2xl rounded-tr-sm bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
                  {t.q}
                </div>
              </div>

              {!t.job || t.job.status === "pending" || t.job.status === "running" ? (
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-orange-400"></span>
                  {t.job?.status === "running" ? "Belgelerini tarıyorum…" : "Kuyruğa eklendi…"}
                  <Link href={`/executive-brain/jobs/${t.jobId}`} className="ml-2 underline">canlı izle</Link>
                </div>
              ) : t.job.status === "failed" ? (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                  ✗ {t.job.errorText ?? "Bilinmeyen hata"}
                  <Link href={`/executive-brain/jobs/${t.jobId}`} className="ml-2 underline text-xs">detay</Link>
                </div>
              ) : t.job.status === "cancelled" ? (
                <p className="text-xs text-neutral-500">İptal edildi.</p>
              ) : (
                <div className="rounded-2xl rounded-tl-sm border border-neutral-800 bg-neutral-900/40 p-5">
                  <div className="text-sm leading-relaxed text-neutral-100 whitespace-pre-wrap">
                    {renderAnswer(t.job.answer ?? "", t.job.citations ? JSON.parse(t.job.citations) : [])}
                  </div>
                  <p className="mt-3 text-[11px] text-neutral-500">
                    <Link href={`/executive-brain/jobs/${t.jobId}`} className="underline">Job detayı + trace + kaynaklar</Link>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={e => { e.preventDefault(); ask(input); }}
            className="border-t border-neutral-800 bg-neutral-950 px-6 py-4">
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} disabled={busy}
            placeholder={threadId ? "Konuşmaya devam et — geçen turları hatırlıyor…" : "Yöneticinin sorusunu yaz…"}
            className="flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 focus:border-orange-500 focus:outline-none disabled:opacity-50" />
          <button disabled={busy || !input.trim()}
            className="rounded-md bg-orange-500 px-6 py-3 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
            {busy ? "…" : "Sor"}
          </button>
        </div>
      </form>
    </main>
  );
}
