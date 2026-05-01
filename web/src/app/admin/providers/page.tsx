"use client";
import { useEffect, useState } from "react";

type Row = { id: string; provider: string; name: string; baseUrl: string | null; defaultModel: string | null; isDefault: boolean; enabled: boolean; updatedAt: string };

const PROVIDERS = [
  { id: "anthropic", label: "Anthropic", urlHint: "https://api.anthropic.com" },
  { id: "openai",    label: "OpenAI",    urlHint: "https://api.openai.com/v1" },
  { id: "lmstudio",  label: "LM Studio", urlHint: "http://localhost:1234/v1" },
  { id: "ollama",    label: "Ollama",    urlHint: "http://localhost:11434" }
];

export default function ProvidersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({ provider: "ollama", name: "Default Ollama", baseUrl: "http://localhost:11434", apiKey: "", defaultModel: "qwen2.5-coder:7b", isDefault: true, enabled: true });
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/proxy/admin/providers", { cache: "no-store" });
    if (r.ok) setRows(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    const r = await fetch("/api/proxy/admin/providers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, apiKey: form.apiKey || null })
    });
    if (!r.ok) { setErr(await r.text()); return; }
    setForm({ ...form, apiKey: "" });
    load();
  }

  async function del(id: string) {
    if (!confirm("Provider config silinsin mi?")) return;
    await fetch(`/api/proxy/admin/providers/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="px-8 py-8">
      <h2 className="text-2xl font-semibold">Provider config</h2>
      <p className="mt-1 text-sm text-neutral-400">Tenant için model provider endpoint + API anahtarlarını yönet. Lokal LLM (Ollama, LM Studio) için API anahtarı gereksiz.</p>

      <form onSubmit={save} className="mt-6 grid gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 md:grid-cols-6">
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
        <input type="password" placeholder="API anahtarı (opsiyonel)" value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 text-xs text-neutral-300">
          <input type="checkbox" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} /> Varsayılan
        </label>
        <label className="flex items-center gap-2 text-xs text-neutral-300">
          <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} /> Aktif
        </label>
        <button className="md:col-span-4 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">Kaydet</button>
      </form>

      {err && <p className="mt-4 text-xs text-red-400">Hata: {err}</p>}

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
            <tr><th className="px-4 py-3">Provider</th><th className="px-4 py-3">İsim</th><th className="px-4 py-3">URL</th><th className="px-4 py-3">Model</th><th className="px-4 py-3">Durum</th><th className="px-4 py-3 text-right">İşlem</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">Provider config yok.</td></tr>}
            {rows.map(p => (
              <tr key={p.id} className="border-t border-neutral-800">
                <td className="px-4 py-3"><span className="rounded bg-neutral-800 px-2 py-0.5 text-xs">{p.provider}</span></td>
                <td className="px-4 py-3">{p.name} {p.isDefault && <span className="ml-2 rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] text-orange-300">DEFAULT</span>}</td>
                <td className="px-4 py-3 font-mono text-xs text-neutral-400">{p.baseUrl ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{p.defaultModel ?? "—"}</td>
                <td className="px-4 py-3 text-xs">{p.enabled ? <span className="text-emerald-400">aktif</span> : <span className="text-neutral-500">kapalı</span>}</td>
                <td className="px-4 py-3 text-right">
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
