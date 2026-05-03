"use client";

import { useEffect, useRef, useState } from "react";

type TextPart  = { type: "text";      text: string };
type ImagePart = { type: "image_url"; image_url: { url: string; name?: string } };
type Part      = TextPart | ImagePart;

type Msg = { role: "user" | "assistant"; content: string | Part[] };

type Provider = {
  id: string;
  provider: string;
  name: string;
  defaultModel: string | null;
  isDefault: boolean;
};

type Attachment =
  | { kind: "image"; image_url: { url: string; name: string }; size: number }
  | { kind: "file";  name: string; mime: string; size: number; text: string; truncated?: boolean };

const MAX_BYTES = 16 * 1024 * 1024; // 16 MB per file

export default function ChatPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/proxy/providers", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const list: Provider[] = await r.json();
        setProviders(list);
        const def = list.find(p => p.isDefault) ?? list[0];
        if (def) { setProviderId(def.id); setModel(def.defaultModel ?? ""); }
      } catch (e) {
        setError(`Provider listesi yüklenemedi: ${(e as Error).message}`);
      }
    })();
  }, []);

  function pickProvider(id: string) {
    const p = providers.find(x => x.id === id);
    if (!p) return;
    setProviderId(p.id);
    setModel(p.defaultModel ?? "");
    setSessionId(null);
    setMessages([]);
    setAttachments([]);
  }

  async function addFiles(files: FileList | File[]) {
    setError(null);
    const arr = Array.from(files);
    for (const f of arr) {
      if (f.size > MAX_BYTES) {
        setError(`Dosya çok büyük (max 16 MB): ${f.name}`); continue;
      }
      // Image: read directly as data URL → image_url part
      if (f.type.startsWith("image/")) {
        try {
          const dataUrl: string = await new Promise((res, rej) => {
            const fr = new FileReader();
            fr.onload  = () => res(String(fr.result));
            fr.onerror = () => rej(fr.error);
            fr.readAsDataURL(f);
          });
          setAttachments(a => [...a, { kind: "image", image_url: { url: dataUrl, name: f.name }, size: f.size }]);
        } catch (e) {
          setError(`Resim okunamadı: ${f.name}`);
        }
        continue;
      }
      // Anything else: ship to backend extractor (PDF + text-like supported)
      setUploading(u => u + 1);
      try {
        const fd = new FormData();
        fd.append("file", f, f.name);
        const r = await fetch("/api/proxy/files/extract", { method: "POST", body: fd });
        const json = await r.json().catch(() => ({}));
        if (!r.ok) {
          setError(`${f.name}: ${json?.error ?? `HTTP ${r.status}`}${json?.hint ? " — " + json.hint : ""}`);
          continue;
        }
        setAttachments(a => [...a, {
          kind: "file",
          name: json.name ?? f.name,
          mime: json.mime ?? f.type ?? "application/octet-stream",
          size: f.size,
          text: json.text ?? "",
          truncated: json.truncated
        }]);
      } catch (e) {
        setError(`${f.name}: ${(e as Error).message}`);
      } finally {
        setUploading(u => u - 1);
      }
    }
  }

  function removeAttachment(idx: number) {
    setAttachments(a => a.filter((_, i) => i !== idx));
  }

  function buildContent(text: string): string | Part[] {
    const fileBlock = attachments
      .filter((a): a is Extract<Attachment, { kind: "file" }> => a.kind === "file")
      .map(a => {
        const truncationNote = a.truncated ? " (içerik kısaltıldı)" : "";
        return `\n--- attached file: ${a.name} (${a.mime})${truncationNote} ---\n${a.text}\n--- end of ${a.name} ---`;
      })
      .join("\n");
    const images = attachments.filter((a): a is Extract<Attachment, { kind: "image" }> => a.kind === "image");
    const combinedText = [text.trim(), fileBlock.trim()].filter(Boolean).join("\n\n");

    if (images.length === 0) return combinedText;
    const parts: Part[] = [];
    if (combinedText) parts.push({ type: "text", text: combinedText });
    parts.push(...images.map(i => ({ type: "image_url" as const, image_url: i.image_url })));
    return parts;
  }

  async function send() {
    if ((!input.trim() && attachments.length === 0) || busy) return;
    const p = providers.find(x => x.id === providerId);
    if (!p) { setError("Önce bir provider seç."); return; }
    setError(null);

    const userContent = buildContent(input);
    const userMsg: Msg = { role: "user", content: userContent };
    const next = [...messages, userMsg];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setAttachments([]);
    setBusy(true);

    try {
      const r = await fetch("/api/proxy/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: p.provider,
          providerConfigId: p.id,
          model,
          sessionId,
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
                const cur = typeof last.content === "string" ? last.content : "";
                return [...m.slice(0, -1), { ...last, content: cur + json.text }];
              });
            } else if (type === "error") setError(json.message ?? "Bilinmeyen hata");
          } catch {}
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const items = Array.from(e.clipboardData?.items ?? []);
    const files = items.filter(it => it.kind === "file").map(it => it.getAsFile()).filter((f): f is File => !!f);
    if (files.length) { e.preventDefault(); addFiles(files); }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  }

  const activeProvider = providers.find(x => x.id === providerId);

  return (
    <main
      className="mx-auto flex h-[calc(100vh-3rem)] max-w-4xl flex-col px-4 py-4 sm:px-6 sm:py-6"
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Altaris Web Chat</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={providerId}
            onChange={e => pickProvider(e.target.value)}
            className="min-w-0 max-w-full rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs"
            disabled={providers.length === 0}
          >
            {providers.length === 0 && <option value="">Provider yok — admin'den ekle</option>}
            {providers.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.isDefault ? " ★" : ""}
              </option>
            ))}
          </select>
          <input
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder="model"
            className="w-full sm:w-64 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs font-mono"
          />
        </div>
      </div>
      {activeProvider && (
        <p className="mt-1 text-xs text-neutral-500">
          {activeProvider.provider} · resim, PDF, txt/md/json/csv/code dosyaları yapıştır, sürükle-bırak veya 📎 ile ekle
        </p>
      )}

      <div
        ref={scrollRef}
        className={`mt-4 flex-1 space-y-4 overflow-y-auto rounded-lg border bg-neutral-950 p-4 ${
          dragOver ? "border-orange-500 ring-2 ring-orange-500/40" : "border-neutral-800"
        }`}
      >
        {messages.length === 0 && (
          <p className="text-sm text-neutral-500">
            Bir mesaj yazarak başla. Resim, PDF veya kod dosyası eklemek için yapıştır, sürükle-bırak ya da 📎 butonuna tıkla.
          </p>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} msg={m} streaming={busy && i === messages.length - 1} />
        ))}
      </div>

      {error && <p className="mt-2 text-xs text-red-400">Hata: {error}</p>}

      {(attachments.length > 0 || uploading > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {attachments.map((a, idx) => (
            <AttachmentChip key={idx} a={a} onRemove={() => removeAttachment(idx)} />
          ))}
          {uploading > 0 && (
            <span className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-400">
              {uploading} dosya işleniyor…
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="*/*"
          multiple
          hidden
          onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-md border border-neutral-800 px-3 py-2 text-sm hover:bg-neutral-900"
          title="Dosya ekle (resim, PDF, kod, vb.)"
        >
          📎
        </button>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          onPaste={onPaste}
          rows={2}
          placeholder="Mesajını yaz, Enter ile gönder. Resim/dosya: yapıştır / sürükle / 📎"
          className="flex-1 resize-none rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm focus:border-orange-500 focus:outline-none"
        />
        <button
          onClick={send}
          disabled={busy || (!input.trim() && attachments.length === 0) || !providerId || uploading > 0}
          className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {busy ? "Gönderiliyor…" : "Gönder"}
        </button>
      </div>
    </main>
  );
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function AttachmentChip({ a, onRemove }: { a: Attachment; onRemove: () => void }) {
  if (a.kind === "image") {
    return (
      <div className="group relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={a.image_url.url}
          alt={a.image_url.name}
          className="h-20 w-20 rounded-md border border-neutral-800 object-cover"
        />
        <button
          onClick={onRemove}
          className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white group-hover:flex"
          aria-label="Kaldır"
        >
          ×
        </button>
      </div>
    );
  }
  const icon = a.mime === "application/pdf" ? "📄" : "📝";
  return (
    <div className="group relative flex h-20 w-56 items-start gap-2 rounded-md border border-neutral-800 bg-neutral-900 p-2 text-xs">
      <span className="text-2xl leading-none">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-neutral-200">{a.name}</p>
        <p className="truncate text-[10px] text-neutral-500">{a.mime}</p>
        <p className="text-[10px] text-neutral-500">
          {fmtSize(a.size)} · {a.text.length.toLocaleString("tr-TR")} char{a.truncated ? " · trunc" : ""}
        </p>
      </div>
      <button
        onClick={onRemove}
        className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white group-hover:flex"
        aria-label="Kaldır"
      >
        ×
      </button>
    </div>
  );
}

function MessageBubble({ msg, streaming }: { msg: Msg; streaming: boolean }) {
  const text = typeof msg.content === "string"
    ? msg.content
    : msg.content.filter((p): p is TextPart => p.type === "text").map(p => p.text).join("\n");
  const images = typeof msg.content === "string"
    ? []
    : msg.content.filter((p): p is ImagePart => p.type === "image_url");

  return (
    <div className={msg.role === "user" ? "text-orange-300" : "text-neutral-200"}>
      <span className="text-xs uppercase tracking-wide text-neutral-500">{msg.role}</span>
      {images.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2">
          {images.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={img.image_url.url}
              alt={img.image_url.name ?? `image-${i}`}
              className="max-h-48 rounded-md border border-neutral-800"
            />
          ))}
        </div>
      )}
      {(text || streaming) && (
        <p className="mt-1 whitespace-pre-wrap text-sm">{text}{streaming && !text ? "▍" : ""}</p>
      )}
    </div>
  );
}
