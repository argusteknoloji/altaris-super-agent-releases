"use client";

import { useEffect, useState } from "react";
import ScheduleBuilder from "./_ScheduleBuilder";
import Link from "next/link";
import { fmtDateTimeTR } from "@/lib/datetime";

type Agent = {
  id: string; slug: string; name: string; description: string | null;
  systemPrompt: string;
  model: string | null; embeddingModel: string | null;
  providerConfigId: string | null;
  vaultFilter: string[] | null;
  tools: string[];
  scheduleCron: string | null;
  schedulePrompt: string | null;
  enabled: boolean;
  createdAt: string; updatedAt: string;
};
type Template = { slug: string; name: string; description: string; tools: string[]; cron: string | null; cronPrompt: string | null };
type Vault = { slug: string; name: string };
type Provider = { id: string; provider: string; name: string; defaultModel: string | null; isDefault: boolean; enabled: boolean };

const TOOL_LABELS: Record<string, string> = {
  calc:      "🧮 Hesap makinesi",
  code_exec: "💻 Kod çalıştırma (sandbox)",
  sql:       "🗃 Yapılandırılmış sorgu",
  chart:     "📊 Grafik üretme",
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [a, t, v, p] = await Promise.all([
        fetch("/api/proxy/executive-brain/agents", { cache: "no-store" }).then(r => r.ok ? r.json() : []),
        fetch("/api/proxy/executive-brain/templates", { cache: "no-store" }).then(r => r.ok ? r.json() : []),
        fetch("/api/proxy/vaults-root", { cache: "no-store" }).then(r => r.ok ? r.json() : []),
        fetch("/api/proxy/providers", { cache: "no-store" }).then(r => r.ok ? r.json() : []),
      ]);
      setAgents(a); setTemplates(t); setVaults(v);
      setProviders((p as Provider[]).filter(x => x.enabled));
    } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { load(); }, []);

  async function createFromTemplate(slug: string) {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/proxy/executive-brain/agents/from-template/${slug}`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      await load();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function deleteAgent(a: Agent) {
    if (!confirm(`'${a.name}' ajanı silinsin mi? Geçmiş job'lar agent_id=NULL ile kalır.`)) return;
    const r = await fetch(`/api/proxy/executive-brain/agents/${a.id}`, { method: "DELETE" });
    if (r.ok) load(); else setErr(`HTTP ${r.status}`);
  }

  async function toggleEnabled(a: Agent) {
    const r = await fetch(`/api/proxy/executive-brain/agents/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !a.enabled }),
    });
    if (r.ok) load(); else setErr(`HTTP ${r.status}`);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <Link href="/executive-brain" className="text-xs text-neutral-400 hover:text-orange-400">← Beyin'e dön</Link>
          <h1 className="mt-2 text-3xl font-semibold">🧠 Ajanlar</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Şirketin İkinci Beyni — yöneticinin rollerine özel ajanlar (CFO, Risk, Sözleşme, Satış).
            Her ajanın kendi system prompt'u + vault filtresi + tool'ları + (opsiyonel) cron schedule'ı var.
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">
          + Boş ajan oluştur
        </button>
      </div>

      {/* Templates */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-neutral-300">Hazır şablonlar</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map(t => (
            <div key={t.slug} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
              <h3 className="text-sm font-semibold text-orange-400">{t.name}</h3>
              <p className="mt-1 text-xs text-neutral-400 leading-snug">{t.description}</p>
              {t.cron && <p className="mt-2 text-[10px] font-mono text-purple-300">⏰ {t.cron}</p>}
              <button
                onClick={() => createFromTemplate(t.slug)}
                disabled={busy}
                className="mt-3 w-full rounded-md border border-orange-500/30 px-3 py-1.5 text-xs text-orange-400 hover:bg-orange-500/10 disabled:opacity-50"
              >
                Bu şablondan oluştur
              </button>
            </div>
          ))}
        </div>
      </section>

      {err && <p className="mb-4 text-xs text-red-400">Hata: {err}</p>}

      {/* Custom agents */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-300">Tanımlı ajanlar ({agents.length})</h2>
        {agents.length === 0 ? (
          <p className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-6 text-center text-sm text-neutral-500">
            Henüz ajan tanımlanmamış. Yukarıdaki şablonlardan birini seç veya boş ajan oluştur.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {agents.map(a => (
              <div key={a.id} className={
                "rounded-lg border bg-neutral-900/40 p-4 " +
                (a.enabled ? "border-neutral-800" : "border-neutral-800 opacity-60")
              }>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-base font-semibold">
                      {a.name}
                      {!a.enabled && <span className="rounded bg-neutral-800 px-2 py-0.5 text-[10px]">disabled</span>}
                    </h3>
                    <p className="text-xs font-mono text-neutral-500">{a.slug}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => toggleEnabled(a)} className="rounded border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-300 hover:bg-neutral-800">
                      {a.enabled ? "Kapat" : "Aç"}
                    </button>
                    <button onClick={() => setEditing(a)} className="rounded border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-300 hover:bg-neutral-800">
                      Düzenle
                    </button>
                    <button onClick={() => deleteAgent(a)} className="rounded border border-red-500/30 px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-500/10">
                      Sil
                    </button>
                  </div>
                </div>
                {a.description && <p className="mt-2 text-xs text-neutral-400">{a.description}</p>}
                <div className="mt-3 flex flex-wrap gap-1 text-[10px]">
                  {a.tools.map(t => (
                    <span key={t} className="rounded bg-sky-500/15 px-2 py-0.5 text-sky-300">
                      {TOOL_LABELS[t] ?? t}
                    </span>
                  ))}
                  {a.vaultFilter && a.vaultFilter.length > 0 ? (
                    <span className="rounded bg-purple-500/15 px-2 py-0.5 text-purple-300">📚 {a.vaultFilter.length} vault</span>
                  ) : (
                    <span className="rounded bg-neutral-700 px-2 py-0.5 text-neutral-300">📚 tüm exec/tenant vault</span>
                  )}
                  {a.scheduleCron && (
                    <span className="rounded bg-amber-500/15 px-2 py-0.5 text-amber-300">⏰ {a.scheduleCron}</span>
                  )}
                  {a.model && (
                    <span className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-400 font-mono">🧠 {a.model}</span>
                  )}
                </div>
                <p className="mt-2 text-[10px] text-neutral-600">güncellendi {fmtDateTimeTR(a.updatedAt)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {(editing || creating) && (
        <AgentEditor
          agent={editing}
          vaults={vaults}
          providers={providers}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={async () => { setEditing(null); setCreating(false); await load(); }}
        />
      )}
    </main>
  );
}

function AgentEditor({ agent, vaults, providers, onClose, onSaved }: { agent: Agent | null; vaults: Vault[]; providers: Provider[]; onClose: () => void; onSaved: () => void }) {
  const isNew = agent === null;
  const [form, setForm] = useState({
    slug: agent?.slug ?? "",
    name: agent?.name ?? "",
    description: agent?.description ?? "",
    systemPrompt: agent?.systemPrompt ?? "Sen yardımcı bir ajansın. Vault'taki belgelerden kaynaklı cevap ver.",
    model: agent?.model ?? "",
    embeddingModel: agent?.embeddingModel ?? "",
    providerConfigId: agent?.providerConfigId ?? "",
    vaultFilter: agent?.vaultFilter ?? [],
    tools: agent?.tools ?? [],
    scheduleCron: agent?.scheduleCron ?? "",
    schedulePrompt: agent?.schedulePrompt ?? "",
    enabled: agent?.enabled ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const body = {
        ...form,
        vaultFilter: form.vaultFilter.length === 0 ? null : form.vaultFilter,
        scheduleCron: form.scheduleCron || null,
        schedulePrompt: form.schedulePrompt || null,
        model: form.model || null,
        embeddingModel: form.embeddingModel || null,
        providerConfigId: form.providerConfigId || null,
        // PATCH için: provider seçimi temizlendiyse backend'e açık sinyal
        clearProvider: !isNew && form.providerConfigId === "",
      };
      const url = isNew
        ? "/api/proxy/executive-brain/agents"
        : `/api/proxy/executive-brain/agents/${agent!.id}`;
      const r = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      onSaved();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  function toggleVault(slug: string) {
    setForm(f => ({
      ...f,
      vaultFilter: f.vaultFilter.includes(slug)
        ? f.vaultFilter.filter(s => s !== slug)
        : [...f.vaultFilter, slug],
    }));
  }

  function toggleTool(t: string) {
    setForm(f => ({ ...f, tools: f.tools.includes(t) ? f.tools.filter(x => x !== t) : [...f.tools, t] }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form onSubmit={save} onClick={e => e.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-950 p-6 space-y-4">
        <h3 className="text-lg font-semibold">{isNew ? "Yeni ajan" : `Düzenle: ${agent!.name}`}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input required disabled={!isNew} placeholder="slug (a-z 0-9 - _)" value={form.slug}
            onChange={e => setForm({...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "")})}
            className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm font-mono disabled:opacity-50" />
          <input required placeholder="Ad" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
            className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm" />
        </div>
        <input placeholder="Kısa açıklama" value={form.description} onChange={e => setForm({...form, description: e.target.value})}
          className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm" />

        <div>
          <label className="text-xs text-neutral-400">System prompt</label>
          <textarea required rows={8} value={form.systemPrompt} onChange={e => setForm({...form, systemPrompt: e.target.value})}
            className="mt-1 w-full rounded-md border border-neutral-800 bg-neutral-900 p-3 font-mono text-xs" />
          <p className="mt-1 text-[10px] text-neutral-500">İpucu: net kurallar yaz. "Sadece kaynaktan cevap", "Türkçe", "[n] cite et", "Sayıları aynen alıntıla".</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-neutral-400">
            <span className="block mb-1">Provider (boş = tenant default)</span>
            <select
              value={form.providerConfigId}
              onChange={e => setForm({...form, providerConfigId: e.target.value})}
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs"
            >
              <option value="">— Tenant default ({providers.find(p => p.isDefault)?.name ?? "yok"}) —</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.provider}{p.isDefault ? " ★" : ""})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-neutral-400">
            <span className="block mb-1">Model override (opsiyonel — boşsa provider default)</span>
            <input value={form.model} onChange={e => setForm({...form, model: e.target.value})}
              placeholder="örn. claude-opus-4-7, gpt-5.5, qwen/qwen3.6-27b"
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-mono" />
          </label>
        </div>
        <div>
          <input placeholder="Embedding model override (opsiyonel)" value={form.embeddingModel} onChange={e => setForm({...form, embeddingModel: e.target.value})}
            className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-mono" />
        </div>

        <div>
          <label className="text-xs text-neutral-400">Vault filtresi (boş = tüm exec+tenant vault)</label>
          <div className="mt-1 flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded border border-neutral-800 bg-neutral-900/50 p-2">
            {vaults.length === 0 && <span className="text-[10px] text-neutral-500">Vault yok</span>}
            {vaults.map(v => (
              <button key={v.slug} type="button" onClick={() => toggleVault(v.slug)}
                className={
                  "rounded px-2 py-1 text-[10px] font-mono " +
                  (form.vaultFilter.includes(v.slug)
                    ? "bg-purple-500/30 text-purple-200"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700")
                }>
                {v.slug}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-neutral-400">Tool'lar</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {Object.entries(TOOL_LABELS).map(([k, label]) => (
              <button key={k} type="button" onClick={() => toggleTool(k)}
                className={
                  "rounded px-3 py-1 text-xs " +
                  (form.tools.includes(k)
                    ? "bg-sky-500/25 text-sky-200"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700")
                }>
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-neutral-500">Tool'lar EB-3.5'de tam destek alacak; şu an UI placeholder.</p>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-neutral-400">Zamanlama</label>
          <ScheduleBuilder
            value={form.scheduleCron}
            onChange={cron => setForm({ ...form, scheduleCron: cron })}
          />
          <input
            placeholder="Otomatik tetiklendiğinde sorulacak soru (boş = ajanın default davranışı)"
            value={form.schedulePrompt}
            onChange={e => setForm({ ...form, schedulePrompt: e.target.value })}
            className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-neutral-400">
          <input type="checkbox" checked={form.enabled} onChange={e => setForm({...form, enabled: e.target.checked})} />
          Aktif (kapatılırsa job'lar çalışmaz, schedule da tetiklenmez)
        </label>

        {err && <p className="text-xs text-red-400">{err}</p>}

        <div className="flex justify-end gap-2 border-t border-neutral-800 pt-4">
          <button type="button" onClick={onClose} className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900">İptal</button>
          <button disabled={busy} className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
            {busy ? "…" : isNew ? "Oluştur" : "Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}
