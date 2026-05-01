"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const PROVIDERS = [
  { id: "anthropic", label: "Anthropic Claude (cloud)", defaultModel: "claude-sonnet-4-6" },
  { id: "ollama",    label: "Ollama (local)",            defaultModel: "qwen2.5-coder:7b" },
  { id: "lmstudio",  label: "LM Studio (local OpenAI)",  defaultModel: "qwen2.5-coder-7b" }
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState(PROVIDERS[1].id);
  const [model, setModel] = useState(PROVIDERS[1].defaultModel);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  function pickProvider(id: string) {
    setProvider(id);
    setModel(PROVIDERS.find(p => p.id === id)?.defaultModel ?? "");
    setSessionId(null);
    setMessages([]);
  }

  async function send() {
    if (!input.trim() || busy) return;
    setError(null);
    const userMsg: Msg = { role: "user", content: input };
    const next = [...messages, userMsg];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);

    try {
      const r = await fetch("/api/proxy/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider, model, sessionId,
          messages: next.map(m => ({ role: m.role, content: m.content })),
          maxTokens: 2048
        })
      });
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const evt of events) {
          const lines = evt.split("\n");
          const type = lines.find(l => l.startsWith("event: "))?.slice(7) ?? "delta";
          const data = lines.find(l => l.startsWith("data: "))?.slice(6) ?? "";
          if (!data) continue;
          try {
            const json = JSON.parse(data);
            if (type === "session" && json.id) setSessionId(json.id);
            else if (type === "delta" && json.text) {
              setMessages(m => {
                const last = m[m.length - 1];
                return [...m.slice(0, -1), { ...last, content: last.content + json.text }];
              });
            } else if (type === "error") {
              setError(json.message ?? "Bilinmeyen hata");
            }
          } catch {}
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex h-screen max-w-4xl flex-col px-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Altaris Web Chat</h1>
        <div className="flex items-center gap-2 text-sm">
          <select
            value={provider}
            onChange={e => pickProvider(e.target.value)}
            className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs"
          >
            {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <input
            value={model}
            onChange={e => setModel(e.target.value)}
            className="w-48 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs font-mono"
          />
        </div>
      </div>

      <div ref={scrollRef} className="mt-4 flex-1 space-y-4 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950 p-4">
        {messages.length === 0 && <p className="text-sm text-neutral-500">Bir mesaj yazarak başla.</p>}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-orange-300" : "text-neutral-200"}>
            <span className="text-xs uppercase tracking-wide text-neutral-500">{m.role}</span>
            <p className="mt-1 whitespace-pre-wrap text-sm">{m.content || (busy && i === messages.length - 1 ? "▍" : "")}</p>
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-xs text-red-400">Hata: {error}</p>}

      <div className="mt-4 flex gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={2}
          placeholder="Mesajını yaz, Enter ile gönder…"
          className="flex-1 resize-none rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm focus:border-orange-500 focus:outline-none"
        />
        <button onClick={send} disabled={busy || !input.trim()} className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
          {busy ? "Gönderiliyor…" : "Gönder"}
        </button>
      </div>
    </main>
  );
}
