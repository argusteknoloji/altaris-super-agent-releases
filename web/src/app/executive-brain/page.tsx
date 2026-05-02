"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

type Citation = { vault: string; path: string; chunkIndex: number; snippet: string; distance: number };
type AskResponse = {
  question: string;
  answer: string;
  sources: Citation[];
  model: string;
  vaultCount: number;
};
type Turn =
  | { kind: "question"; text: string; ts: number }
  | { kind: "answer"; data: AskResponse; ts: number }
  | { kind: "thinking"; ts: number }
  | { kind: "error"; text: string; ts: number };

const SUGGESTED = [
  "Geçen çeyrek hangi müşteri grubunda marjlarımız düştü?",
  "Bu sözleşmeyi imzalarsak nakit akışımıza 6 ay sonra ne olur?",
  "Satış ekibinin geçen hafta konuştuğu müşterilerden hangileri risk sinyali veriyor?",
  "ISO 27001 sertifikasyonu için hangi maddelere uyum sağlamamız lazım?",
  "Son 3 ayda en çok hangi konularda toplantı yaptık?",
];

export default function ExecutiveBrainPage() {
  const [input, setInput] = useState("");
  const [includeAll, setIncludeAll] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    setTurns(t => [...t,
      { kind: "question", text: question, ts: Date.now() },
      { kind: "thinking", ts: Date.now() + 1 }
    ]);
    setInput("");
    try {
      const r = await fetch("/api/proxy/executive-brain/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, topK: 8, includeAllVaults: includeAll }),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`HTTP ${r.status}: ${txt}`);
      }
      const data: AskResponse = await r.json();
      setTurns(t => t.filter(x => x.kind !== "thinking").concat({ kind: "answer", data, ts: Date.now() }));
    } catch (e) {
      setTurns(t => t.filter(x => x.kind !== "thinking").concat({
        kind: "error", text: (e as Error).message, ts: Date.now()
      }));
    } finally {
      setBusy(false);
    }
  }

  // Cevaptaki [n] referanslarını link'e çevir
  function renderAnswerWithCites(answer: string, sources: Citation[]) {
    const parts = answer.split(/(\[\d+\])/g);
    return parts.map((part, i) => {
      const m = part.match(/^\[(\d+)\]$/);
      if (!m) return <span key={i}>{part}</span>;
      const idx = parseInt(m[1]) - 1;
      const src = sources[idx];
      if (!src) return <span key={i} className="text-neutral-500">{part}</span>;
      return (
        <a
          key={i}
          href={`/vaults/${src.vault}`}
          className="mx-0.5 inline-flex items-center rounded bg-orange-500/15 px-1.5 py-0 text-[11px] font-medium text-orange-300 hover:bg-orange-500/25"
          title={`${src.vault}/${src.path} · chunk ${src.chunkIndex}\n${src.snippet}`}
        >
          {part}
        </a>
      );
    });
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-3rem)] max-w-5xl flex-col">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-950 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <span className="text-orange-400">🧠</span>
              Executive Brain
              <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-300">MVP</span>
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              Şirketin İkinci Beyni — vault'larındaki belgelere dayanarak doğal Türkçe ile cevap verir.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-neutral-400">
            <input type="checkbox" checked={includeAll} onChange={e => setIncludeAll(e.target.checked)} />
            Bütün vault'larda ara (private dahil)
          </label>
        </div>
      </header>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        {turns.length === 0 && (
          <div className="mx-auto max-w-2xl">
            <p className="mb-4 text-sm text-neutral-400">Yöneticinin masasında üç tip soru var. Birini dene:</p>
            <div className="space-y-2">
              {SUGGESTED.map(q => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  disabled={busy}
                  className="block w-full rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-left text-sm text-neutral-200 hover:border-orange-500/40 hover:bg-neutral-900/80 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="mt-8 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200/80">
              <strong>İpucu:</strong> Cevap kalitesi vault'larındaki belgenin yoğunluğuyla doğru orantılıdır.
              Önce <Link href="/vaults" className="underline">/vaults</Link>'tan bir kasaya
              <code className="font-mono"> visibility=executive</code> ver, içine ERP/CRM/sözleşme/toplantı notlarını
              koy, sonra admin panelinden "Reindex" çalıştır.
            </div>
          </div>
        )}

        <div className="space-y-6">
          {turns.map((t, i) => {
            if (t.kind === "question") {
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-2xl rounded-2xl rounded-tr-sm bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
                    {t.text}
                  </div>
                </div>
              );
            }
            if (t.kind === "thinking") {
              return (
                <div key={i} className="flex items-center gap-2 text-xs text-neutral-500">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-orange-400"></span>
                  Belgelerini tarıyorum…
                </div>
              );
            }
            if (t.kind === "error") {
              return (
                <div key={i} className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                  ✗ {t.text}
                </div>
              );
            }
            return (
              <div key={i} className="space-y-3">
                <div className="rounded-2xl rounded-tl-sm border border-neutral-800 bg-neutral-900/40 p-5">
                  <div className="text-sm leading-relaxed text-neutral-100">
                    {renderAnswerWithCites(t.data.answer, t.data.sources)}
                  </div>
                  <p className="mt-3 text-[11px] text-neutral-500">
                    {t.data.vaultCount} vault tarandı · model {t.data.model}
                  </p>
                </div>

                {t.data.sources.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-neutral-400 hover:text-neutral-200">
                      📚 {t.data.sources.length} kaynak — yakınlıklarına göre sıralı
                    </summary>
                    <div className="mt-2 space-y-2 pl-4">
                      {t.data.sources.map((s, j) => (
                        <div key={j} className="border-l-2 border-neutral-800 pl-3">
                          <div className="flex items-baseline justify-between">
                            <p className="font-mono text-[11px] text-orange-400">
                              [{j + 1}] {s.vault}/{s.path}:{s.chunkIndex}
                            </p>
                            <span className="text-[10px] text-neutral-600">d={s.distance.toFixed(3)}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-neutral-400">{s.snippet}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Input */}
      <form
        onSubmit={e => { e.preventDefault(); ask(input); }}
        className="border-t border-neutral-800 bg-neutral-950 px-6 py-4"
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={busy}
            placeholder="Yöneticinin sorusunu yaz…"
            className="flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 focus:border-orange-500 focus:outline-none disabled:opacity-50"
          />
          <button
            disabled={busy || !input.trim()}
            className="rounded-md bg-orange-500 px-6 py-3 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {busy ? "…" : "Sor"}
          </button>
        </div>
      </form>
    </main>
  );
}
