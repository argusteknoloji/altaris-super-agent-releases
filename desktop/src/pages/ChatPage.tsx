import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

type Msg = { role: "user" | "assistant"; content: string };

const PROVIDERS = [
  { id: "anthropic", label: "Anthropic Claude (cloud)", model: "claude-sonnet-4-6" },
  { id: "ollama",    label: "Ollama (local)",            model: "qwen2.5-coder:7b" },
  { id: "lmstudio",  label: "LM Studio (local)",         model: "qwen2.5-coder-7b" }
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState(PROVIDERS[1].id);
  const [model, setModel] = useState(PROVIDERS[1].model);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  useEffect(() => {
    const unlistens: Array<() => void> = [];
    listen<{ text: string }>("chat:delta", e => {
      setMessages(m => {
        const last = m[m.length - 1];
        if (!last || last.role !== "assistant") return m;
        return [...m.slice(0, -1), { ...last, content: last.content + e.payload.text }];
      });
    }).then(u => unlistens.push(u));
    listen<{ id: string }>("chat:session", e => setSessionId(e.payload.id)).then(u => unlistens.push(u));
    listen<{}>("chat:done", () => setBusy(false)).then(u => unlistens.push(u));
    return () => { unlistens.forEach(u => u()); };
  }, []);

  function pickProvider(id: string) {
    const p = PROVIDERS.find(x => x.id === id)!;
    setProvider(p.id); setModel(p.model); setSessionId(null); setMessages([]);
  }

  async function send() {
    if (!input.trim() || busy) return;
    const next = [...messages, { role: "user" as const, content: input }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput(""); setBusy(true);
    await invoke("chat_send", {
      provider, model, sessionId,
      messages: next.map(m => ({ role: m.role, content: m.content }))
    });
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Chat</h2>
        <div className="flex items-center gap-2 text-xs">
          <select value={provider} onChange={e => pickProvider(e.target.value)} className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1">
            {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <input value={model} onChange={e => setModel(e.target.value)} className="w-48 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 font-mono" />
        </div>
      </div>

      <div ref={scrollRef} className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950 p-4">
        {messages.length === 0 && <p className="text-sm text-neutral-500">Bir mesaj yazarak başla.</p>}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-orange-300" : "text-neutral-200"}>
            <span className="text-xs uppercase tracking-wide text-neutral-500">{m.role}</span>
            <p className="mt-1 whitespace-pre-wrap text-sm">{m.content || (busy && i === messages.length - 1 ? "▍" : "")}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={2} placeholder="Mesajını yaz…"
          className="flex-1 resize-none rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm focus:border-orange-500 focus:outline-none" />
        <button onClick={send} disabled={busy || !input.trim()} className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
          {busy ? "…" : "Gönder"}
        </button>
      </div>
      {sessionId && <p className="mt-2 text-xs text-neutral-600">session: <span className="font-mono">{sessionId.slice(0, 8)}</span></p>}
    </div>
  );
}
