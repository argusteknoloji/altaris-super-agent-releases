"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

type Citation = { vault: string; path: string; chunkIndex: number; snippet: string; distance: number };
type Agent = { id: string; slug: string; name: string; description: string | null; enabled: boolean };
type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
// Streaming-aware turn — answer chunk-by-chunk SSE delta'ları ile büyür
type Turn = {
  q: string;
  jobId: string;
  status: JobStatus;
  answer: string;
  citations: Citation[];
  error: string | null;
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
  const [turns, setTurns] = useState<Turn[]>([]);
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

  /**
   * SSE okuyucu — bir job'un /stream endpoint'ine bağlanır, event'leri
   * teker teker UI'a iter. EventSource header desteklemediği için fetch +
   * ReadableStream ile manual SSE parsing.
   */
  const streamJob = useCallback(async (jobId: string) => {
    let res: Response;
    try {
      res = await fetch(`/api/proxy/executive-brain/jobs/${jobId}/stream`, {
        headers: { Accept: "text/event-stream" },
      });
    } catch (e) {
      setTurns(t => t.map(x => x.jobId === jobId ? { ...x, status: "failed" as JobStatus, error: String(e) } : x));
      return;
    }
    if (!res.ok || !res.body) {
      setTurns(t => t.map(x => x.jobId === jobId ? { ...x, status: "failed" as JobStatus, error: `HTTP ${res.status}` } : x));
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // Event sınırı: çift newline
      let idx;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        let evt = "message"; let data = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) evt = line.slice(7);
          else if (line.startsWith("data: ")) data += line.slice(6);
        }
        if (!data) continue;
        try {
          const payload = JSON.parse(data);
          setTurns(prev => prev.map(t => {
            if (t.jobId !== jobId) return t;
            if (evt === "status") return { ...t, status: payload.status as JobStatus };
            if (evt === "delta")  return { ...t, answer: t.answer + (payload.text ?? "") };
            if (evt === "done") {
              return {
                ...t,
                status: payload.status as JobStatus,
                answer: payload.answer ?? t.answer,
                citations: Array.isArray(payload.citations) ? payload.citations : t.citations,
                error: payload.error ?? null,
              };
            }
            if (evt === "error") return { ...t, status: "failed" as JobStatus, error: payload.message ?? "stream error" };
            return t;
          }));
          if (evt === "done" || evt === "error") return;
        } catch { /* malformed event — skip */ }
      }
    }
  }, []);

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
      setTurns(t => [...t, {
        q: question, jobId: submitResp.id, status: "pending",
        answer: "", citations: [], error: null,
      }]);
      // SSE bağlan — fire-and-forget, event'ler turn'ü güncellesin
      streamJob(submitResp.id).finally(() => setBusy(false));
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

              {/* Pending/running iken answer hâlâ akıyorsa typewriter göster */}
              {(t.status === "pending" || t.status === "running") && t.answer.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-orange-400"></span>
                  {t.status === "running" ? "Belgelerini tarıyorum…" : "Kuyruğa eklendi…"}
                  <Link href={`/executive-brain/jobs/${t.jobId}`} className="ml-2 underline">detay</Link>
                </div>
              ) : t.status === "failed" ? (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                  ✗ {t.error ?? "Bilinmeyen hata"}
                  <Link href={`/executive-brain/jobs/${t.jobId}`} className="ml-2 underline text-xs">detay</Link>
                </div>
              ) : t.status === "cancelled" ? (
                <p className="text-xs text-neutral-500">İptal edildi.</p>
              ) : (
                <div className="rounded-2xl rounded-tl-sm border border-neutral-800 bg-neutral-900/40 p-5">
                  <div className="text-sm leading-relaxed text-neutral-100 whitespace-pre-wrap">
                    {renderAnswer(t.answer, t.citations)}
                    {(t.status === "pending" || t.status === "running") && (
                      <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-orange-400 align-middle" />
                    )}
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
