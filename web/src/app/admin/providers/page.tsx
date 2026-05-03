"use client";
import { useEffect, useState } from "react";

type Row = { id: string; provider: string; name: string; baseUrl: string | null; defaultModel: string | null; isDefault: boolean; enabled: boolean; updatedAt: string };
type FormState = { id?: string; provider: string; name: string; baseUrl: string; apiKey: string; defaultModel: string; isDefault: boolean; enabled: boolean };

const PROVIDERS = [
  { id: "anthropic", label: "Anthropic", urlHint: "https://api.anthropic.com" },
  { id: "openai",    label: "OpenAI",    urlHint: "https://api.openai.com/v1" },
  { id: "lmstudio",  label: "LM Studio", urlHint: "http://localhost:1234/v1" },
  { id: "ollama",    label: "Ollama",    urlHint: "http://localhost:11434" }
];

const EMPTY: FormState = { provider: "ollama", name: "Default Ollama", baseUrl: "http://localhost:11434", apiKey: "", defaultModel: "qwen2.5-coder:7b", isDefault: true, enabled: true };

export default function ProvidersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editing, setEditing] = useState<Row | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/proxy/admin/providers", { cache: "no-store" });
    if (r.ok) setRows(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const r = await fetch("/api/proxy/admin/providers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, apiKey: form.apiKey || null })
      });
      if (!r.ok) { setErr(await r.text()); return; }
      setForm(form.id ? EMPTY : { ...form, apiKey: "" });
      setEditing(null);
      load();
    } finally { setBusy(false); }
  }

  function startEdit(p: Row) {
    setEditing(p);
    setForm({
      id: p.id, provider: p.provider, name: p.name,
      baseUrl: p.baseUrl ?? "",
      apiKey: "",   // boş = mevcut secret değişmez (backend null gelirse no-op)
      defaultModel: p.defaultModel ?? "",
      isDefault: p.isDefault, enabled: p.enabled,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditing(null);
    setForm(EMPTY);
  }

  async function del(id: string) {
    if (!confirm("Provider config silinsin mi?")) return;
    await fetch(`/api/proxy/admin/providers/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <h2 className="text-2xl font-semibold">Provider config</h2>
      <p className="mt-1 text-sm text-neutral-400">Tenant için model provider endpoint + API anahtarlarını yönet. Lokal LLM (Ollama, LM Studio) için API anahtarı gereksiz.</p>

      {/* OAuth bağlantı kartı — Claude/Codex için tek-tık (CLI'sız) */}
      <OAuthConnectCards onConnected={load} />

      <form onSubmit={save} className={`mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-6 ${editing ? "border-orange-500/40 bg-orange-500/5" : "border-neutral-800 bg-neutral-900/40"}`}>
        {editing && (
          <div className="md:col-span-6 flex items-center justify-between text-xs">
            <span className="text-orange-300">✏️ Düzenleme: <span className="font-mono">{editing.name}</span></span>
            <button type="button" onClick={cancelEdit} className="text-neutral-400 hover:text-white">İptal</button>
          </div>
        )}
        <select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm">
          {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <input required placeholder="Config adı" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" />
        <input placeholder="Base URL" value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })}
          className="md:col-span-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm font-mono" />
        <input placeholder="Varsayılan model" value={form.defaultModel} onChange={e => setForm({ ...form, defaultModel: e.target.value })}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm font-mono" />
        <input type="password"
          placeholder={editing ? "API anahtarı (boş = değiştirme)" : "API anahtarı (opsiyonel)"}
          value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 text-xs text-neutral-300">
          <input type="checkbox" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} /> Varsayılan
        </label>
        <label className="flex items-center gap-2 text-xs text-neutral-300">
          <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} /> Aktif
        </label>
        <button disabled={busy} className="md:col-span-4 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
          {busy ? "…" : editing ? "Güncelle" : "Kaydet"}
        </button>
      </form>

      {err && <p className="mt-4 text-xs text-red-400">Hata: {err}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
            <tr><th className="px-4 py-3">Provider</th><th className="px-4 py-3">İsim</th><th className="px-4 py-3">URL</th><th className="px-4 py-3">Model</th><th className="px-4 py-3">Durum</th><th className="px-4 py-3 text-right">İşlem</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">Provider config yok.</td></tr>}
            {rows.map(p => (
              <tr key={p.id} className={`border-t border-neutral-800 ${editing?.id === p.id ? "bg-orange-500/5" : ""}`}>
                <td className="px-4 py-3"><span className="rounded bg-neutral-800 px-2 py-0.5 text-xs">{p.provider}</span></td>
                <td className="px-4 py-3">{p.name} {p.isDefault && <span className="ml-2 rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] text-orange-300">DEFAULT</span>}</td>
                <td className="px-4 py-3 font-mono text-xs text-neutral-400">{p.baseUrl ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{p.defaultModel ?? "—"}</td>
                <td className="px-4 py-3 text-xs">{p.enabled ? <span className="text-emerald-400">aktif</span> : <span className="text-neutral-500">kapalı</span>}</td>
                <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                  <button onClick={() => startEdit(p)} className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-900">Düzenle</button>
                  <button onClick={() => del(p.id)} className="rounded-md border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10">Sil</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── OAuth bağlantı kartları ─────────────────────────────────────────── */

function OAuthConnectCards({ onConnected }: { onConnected: () => void }) {
  const [claudeOpen, setClaudeOpen] = useState(false);
  const [codexHelpOpen, setCodexHelpOpen] = useState(false);

  return (
    <>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => setClaudeOpen(true)}
          className="rounded-lg border border-purple-500/40 bg-purple-500/10 p-4 text-left hover:bg-purple-500/15 transition"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🟣</span>
            <div className="flex-1">
              <div className="font-medium text-purple-200">Claude bağla (OAuth)</div>
              <div className="text-xs text-neutral-400 mt-0.5">Anthropic Claude — claude.com hesabı ile tek-tık. Token süresi otomatik tazelenir.</div>
            </div>
            <span className="text-purple-300">→</span>
          </div>
        </button>

        <button
          onClick={() => setCodexHelpOpen(true)}
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-left hover:bg-emerald-500/15 transition"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🟢</span>
            <div className="flex-1">
              <div className="font-medium text-emerald-200">Codex bağla (OAuth)</div>
              <div className="text-xs text-neutral-400 mt-0.5">OpenAI Codex / ChatGPT Plus — sadece CLI üzerinden (auth.openai.com loopback gerektiriyor).</div>
            </div>
            <span className="text-emerald-300">→</span>
          </div>
        </button>
      </div>

      {claudeOpen && <ClaudeConnectModal onClose={() => setClaudeOpen(false)} onConnected={() => { setClaudeOpen(false); onConnected(); }} />}
      {codexHelpOpen && <CodexHelpModal onClose={() => setCodexHelpOpen(false)} />}
    </>
  );
}

function ClaudeConnectModal({ onClose, onConnected }: { onClose: () => void; onConnected: () => void }) {
  const [step, setStep] = useState<"start" | "paste" | "done">("start");
  const [authorizeUrl, setAuthorizeUrl] = useState("");
  const [state, setState] = useState("");
  const [code, setCode] = useState("");
  const [makeDefault, setMakeDefault] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ name?: string; email?: string } | null>(null);

  async function start() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/proxy/admin/oauth-start-claude", { method: "POST" });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      const j = await r.json();
      setAuthorizeUrl(j.authorizeUrl);
      setState(j.state);
      setStep("paste");
      // Otomatik yeni sekme aç
      window.open(j.authorizeUrl, "_blank", "noopener,noreferrer");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function exchange() {
    if (!code.trim()) { setErr("Kodu yapıştır"); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/proxy/admin/oauth-exchange-claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), state, makeDefault, model: null }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      const j = await r.json();
      setResult({ name: j.name, email: j.email });
      setStep("done");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-lg border border-neutral-800 bg-neutral-950 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold">🟣 Claude OAuth bağlantısı</h2>
          <button onClick={onClose} className="text-2xl text-neutral-500 hover:text-neutral-200 leading-none">×</button>
        </div>

        {step === "start" && (
          <>
            <ol className="text-sm text-neutral-300 space-y-2 mb-5 ml-5 list-decimal">
              <li>Aşağıdaki butona tıkla → Anthropic OAuth sayfası yeni sekmede açılır</li>
              <li>claude.com hesabınla giriş yap, "Authorize"a bas</li>
              <li>Anthropic seni <code className="bg-neutral-800 px-1 rounded">platform.claude.com/oauth/code/callback</code>'e yönlendirir, ekranda kod gösterilir</li>
              <li>O kodu kopyala, bu modal'a yapıştır → Bağla</li>
            </ol>
            {err && <div className="mb-3 rounded border border-red-700 bg-red-950/40 px-3 py-2 text-xs text-red-300">{err}</div>}
            <button onClick={start} disabled={busy} className="w-full rounded bg-purple-500 hover:bg-purple-400 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {busy ? "Hazırlanıyor…" : "Anthropic OAuth'u aç →"}
            </button>
          </>
        )}

        {step === "paste" && (
          <>
            <div className="mb-3 rounded border border-amber-600/40 bg-amber-950/20 p-3 text-xs text-amber-200">
              ⚠ Yeni sekme açılmadıysa <a href={authorizeUrl} target="_blank" rel="noreferrer" className="underline">manuel link</a>.
            </div>
            <label className="block text-xs text-neutral-400 mb-1">Anthropic'in verdiği kodu yapıştır</label>
            <textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="ör. abc123def456..."
              rows={3}
              className="w-full rounded bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs font-mono"
              autoFocus
            />
            <label className="mt-3 flex items-center gap-2 text-xs">
              <input type="checkbox" checked={makeDefault} onChange={e => setMakeDefault(e.target.checked)} />
              <span>Tenant için default Claude provider yap</span>
            </label>
            {err && <div className="mt-3 rounded border border-red-700 bg-red-950/40 px-3 py-2 text-xs text-red-300">{err}</div>}
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setStep("start")} className="rounded border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800">Geri</button>
              <button onClick={exchange} disabled={busy || !code.trim()} className="rounded bg-purple-500 hover:bg-purple-400 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                {busy ? "Bağlanıyor…" : "Bağla"}
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <div className="rounded border border-emerald-600/40 bg-emerald-950/20 p-4 mb-4">
              <div className="text-sm text-emerald-200 font-medium mb-1">✓ Bağlandı</div>
              <div className="text-xs text-neutral-300">
                <div><span className="text-neutral-500">Hesap:</span> {result?.email ?? "—"}</div>
                <div><span className="text-neutral-500">Provider adı:</span> {result?.name ?? "—"}</div>
              </div>
            </div>
            <button onClick={onConnected} className="w-full rounded bg-purple-500 hover:bg-purple-400 px-4 py-2 text-sm font-medium text-white">
              Kapat ve listeyi yenile
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CodexHelpModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const cmd = "altaris provider connect codex --tenant " + (typeof window !== "undefined" ? window.location.host.split('.')[0] : "<tenant>");
  function copy() {
    navigator.clipboard.writeText(cmd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-lg border border-neutral-800 bg-neutral-950 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold">🟢 Codex OAuth — CLI gerekiyor</h2>
          <button onClick={onClose} className="text-2xl text-neutral-500 hover:text-neutral-200 leading-none">×</button>
        </div>

        <p className="text-sm text-neutral-300 mb-3">
          OpenAI Codex / ChatGPT Plus OAuth'u <code className="bg-neutral-800 px-1 rounded">auth.openai.com</code> sadece
          <em> loopback callback</em> (http://localhost:1455/...) kabul ediyor — web'den doğrudan başlatılamıyor.
          Şuna ihtiyacın var:
        </p>

        <ol className="text-xs text-neutral-300 space-y-1 mb-4 ml-5 list-decimal">
          <li>Bir laptopta/desktop'ta CLI kurulu olsun (<code className="bg-neutral-800 px-1 rounded">altaris</code> binary)</li>
          <li>Şu komutu çalıştır:</li>
        </ol>

        <div className="flex items-center gap-2 mb-3">
          <code className="flex-1 rounded bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono text-emerald-200 overflow-x-auto">{cmd}</code>
          <button onClick={copy} className="rounded bg-neutral-800 hover:bg-neutral-700 px-3 py-2 text-xs">
            {copied ? "✓" : "📋 kopyala"}
          </button>
        </div>

        <p className="text-xs text-neutral-400">
          CLI tarayıcı açar, OAuth tamamlanır, token bu platforma POST edilir → providers listesinde görünür.
          OpenAI domain'ini whitelist'e ekleyene kadar web tek-tık desteklenmiyor.
        </p>

        <button onClick={onClose} className="mt-4 w-full rounded border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-900">
          Tamam
        </button>
      </div>
    </div>
  );
}
