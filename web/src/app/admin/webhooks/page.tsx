"use client";

import { useEffect, useState } from "react";
import { fmtDateTimeTR, fmtRelativeTR } from "@/lib/datetime";

type Webhook = {
  id: string; slug: string; name: string;
  targetKind: "agent" | "terminal";
  targetId: string | null;
  enabled: boolean;
  lastFiredAt: string | null;
  fireCount: number;
  createdAt: string;
};
type Agent = { id: string; slug: string; name: string };
type Invocation = {
  id: string; status: string; errorText: string | null;
  jobId: string | null; receivedAt: string; payload_preview: string | null;
};

const PUBLIC_BASE = (typeof window !== "undefined" && window.location.origin) || "";

export default function WebhooksPage() {
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tenantSlug, setTenantSlug] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Create form
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [targetKind, setTargetKind] = useState<"agent" | "terminal">("agent");
  const [targetId, setTargetId] = useState<string>("");
  const [createdSecret, setCreatedSecret] = useState<{ slug: string; secret: string } | null>(null);

  // Inline invocations
  const [openInvocations, setOpenInvocations] = useState<string | null>(null);
  const [invocations, setInvocations] = useState<Invocation[]>([]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [hRes, aRes, meRes] = await Promise.all([
        fetch("/api/proxy/webhooks"),
        fetch("/api/proxy/executive-brain/agents"),
        fetch("/api/proxy/me"),
      ]);
      if (!hRes.ok) throw new Error(`HTTP ${hRes.status}`);
      setHooks(await hRes.json());
      if (aRes.ok) setAgents(await aRes.json());
      if (meRes.ok) {
        const me = await meRes.json();
        setTenantSlug(me.tenantSlug ?? "");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function create() {
    if (!slug.trim() || !name.trim()) return;
    if (targetKind === "agent" && !targetId) { setErr("Agent seç"); return; }
    setErr(null);
    const r = await fetch("/api/proxy/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: slug.trim(), name: name.trim(),
        targetKind, targetId: targetKind === "agent" ? targetId : null,
      }),
    });
    if (!r.ok) { setErr(`HTTP ${r.status}: ${await r.text()}`); return; }
    const j = await r.json();
    setCreatedSecret({ slug: j.slug, secret: j.secret });
    setSlug(""); setName(""); setTargetId("");
    void load();
  }

  async function toggle(id: string, enabled: boolean) {
    await fetch(`/api/proxy/webhooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    void load();
  }

  async function del(id: string, slug: string) {
    if (!confirm(`"${slug}" webhook silinsin mi?`)) return;
    await fetch(`/api/proxy/webhooks/${id}`, { method: "DELETE" });
    void load();
  }

  async function viewInvocations(id: string) {
    if (openInvocations === id) { setOpenInvocations(null); return; }
    setOpenInvocations(id);
    const r = await fetch(`/api/proxy/webhooks/${id}/invocations`);
    if (r.ok) setInvocations(await r.json());
  }

  function publicUrl(h: Webhook) {
    return `${PUBLIC_BASE}/api/v1/hooks/${tenantSlug}/${h.slug}`;
  }

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-semibold mb-1">🪝 Webhook'lar</h1>
      <p className="text-xs text-neutral-500 mb-5">
        Dış sistemler (n8n, Zapier, custom) bu URL'lere POST ettiğinde agent job tetiklenir.
        Her istekte <code className="px-1 rounded bg-neutral-800 text-neutral-200">X-Altaris-Signature: hex(hmac_sha256(secret, body))</code> header'ı zorunlu.
      </p>

      {err && <div className="mb-4 rounded border border-red-700 bg-red-950/40 px-3 py-2 text-sm text-red-300">{err}</div>}

      {createdSecret && (
        <div className="mb-5 rounded border border-amber-600 bg-amber-950/30 p-4">
          <div className="text-sm text-amber-200 font-medium mb-2">⚠ Secret bir kez gösteriliyor — şimdi kopyala:</div>
          <div className="font-mono text-xs bg-neutral-900 p-2 rounded mb-1">
            <span className="text-neutral-500">URL: </span>
            {PUBLIC_BASE}/api/v1/hooks/{tenantSlug}/{createdSecret.slug}
          </div>
          <div className="font-mono text-xs bg-neutral-900 p-2 rounded">
            <span className="text-neutral-500">Secret: </span>
            <span className="text-amber-200">{createdSecret.secret}</span>
          </div>
          <button
            onClick={() => setCreatedSecret(null)}
            className="mt-3 text-xs text-amber-400 underline"
          >
            kopyaladım, kapat
          </button>
        </div>
      )}

      {/* Create form */}
      <div className="mb-6 rounded border border-neutral-800 bg-neutral-900 p-4">
        <div className="text-sm font-medium mb-3">Yeni webhook</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            value={slug} onChange={e => setSlug(e.target.value)}
            placeholder="slug (ör. n8n-daily-report)"
            className="rounded bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm font-mono"
          />
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Görünür ad (ör. n8n Günlük Rapor)"
            className="rounded bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm"
          />
          <select
            value={targetKind} onChange={e => setTargetKind(e.target.value as "agent" | "terminal")}
            className="rounded bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm"
          >
            <option value="agent">Agent tetikle</option>
            <option value="terminal" disabled>Terminal'a komut (yakında)</option>
          </select>
          {targetKind === "agent" && (
            <select
              value={targetId} onChange={e => setTargetId(e.target.value)}
              className="rounded bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm"
            >
              <option value="">— agent seç —</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.slug})</option>
              ))}
            </select>
          )}
        </div>
        <button
          onClick={create}
          className="mt-3 rounded bg-orange-600 hover:bg-orange-500 px-4 py-2 text-sm font-medium"
        >
          Webhook oluştur
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-sm text-neutral-500">Yükleniyor…</div>
      ) : hooks.length === 0 ? (
        <div className="text-sm text-neutral-500">Henüz webhook yok.</div>
      ) : (
        <div className="space-y-3">
          {hooks.map(h => (
            <div key={h.id} className="rounded border border-neutral-800 bg-neutral-900">
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{h.name}</span>
                    <span className="font-mono text-xs text-neutral-500">{h.slug}</span>
                    {!h.enabled && <span className="text-[10px] uppercase tracking-wider rounded bg-neutral-700 text-neutral-300 px-2 py-0.5">disabled</span>}
                    <span className="text-[10px] uppercase tracking-wider rounded bg-blue-900/50 text-blue-300 px-2 py-0.5">{h.targetKind}</span>
                  </div>
                  <div className="font-mono text-xs text-neutral-400 break-all mb-2">
                    POST {publicUrl(h)}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-500">
                    <span>{h.fireCount} fire{h.fireCount === 1 ? "" : "s"}</span>
                    {h.lastFiredAt && <span>son: {fmtRelativeTR(h.lastFiredAt)}</span>}
                    <span>oluşturuldu: {fmtDateTimeTR(h.createdAt)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 items-end">
                  <button
                    onClick={() => navigator.clipboard.writeText(publicUrl(h))}
                    className="text-xs rounded bg-neutral-800 hover:bg-neutral-700 px-2 py-1"
                  >
                    URL kopyala
                  </button>
                  <button
                    onClick={() => toggle(h.id, !h.enabled)}
                    className="text-xs rounded bg-neutral-800 hover:bg-neutral-700 px-2 py-1"
                  >
                    {h.enabled ? "devre dışı" : "etkinleştir"}
                  </button>
                  <button
                    onClick={() => viewInvocations(h.id)}
                    className="text-xs rounded bg-neutral-800 hover:bg-neutral-700 px-2 py-1"
                  >
                    {openInvocations === h.id ? "kapat" : "geçmiş"}
                  </button>
                  <button
                    onClick={() => del(h.id, h.slug)}
                    className="text-xs rounded bg-red-900/50 hover:bg-red-900 text-red-300 px-2 py-1"
                  >
                    sil
                  </button>
                </div>
              </div>

              {openInvocations === h.id && (
                <div className="border-t border-neutral-800 bg-neutral-950 p-4">
                  <div className="text-xs font-medium text-neutral-400 mb-2">Son 50 invocation</div>
                  {invocations.length === 0 ? (
                    <div className="text-xs text-neutral-600">Henüz invocation yok.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {invocations.map(i => (
                        <div key={i.id} className="text-xs flex items-start gap-2">
                          <span className={`font-mono inline-block w-32 shrink-0 ${
                            i.status === "ok" ? "text-emerald-400" :
                            i.status === "invalid_signature" ? "text-red-400" :
                            "text-amber-400"
                          }`}>{i.status}</span>
                          <span className="text-neutral-500 w-40 shrink-0">{fmtDateTimeTR(i.receivedAt)}</span>
                          <span className="text-neutral-400 truncate">
                            {i.errorText ?? (i.payload_preview ? i.payload_preview.replace(/\s+/g, " ").slice(0, 100) : "(no payload)")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* HMAC örnek */}
      <details className="mt-8 rounded border border-neutral-800 bg-neutral-900 p-4">
        <summary className="cursor-pointer text-sm font-medium">Curl ile imzalı çağrı örneği</summary>
        <pre className="mt-3 overflow-x-auto rounded bg-neutral-950 p-3 text-xs leading-relaxed">{`# bash
SECRET="<webhook-secret>"
URL="https://altarisplatform.com/api/v1/hooks/${tenantSlug || "<tenant>"}/<webhook-slug>"
BODY='{"event":"daily_report","date":"2026-05-03"}'
SIG=$(printf "%s" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')
curl -X POST "$URL" \\
  -H "Content-Type: application/json" \\
  -H "X-Altaris-Signature: $SIG" \\
  -d "$BODY"`}</pre>
      </details>
    </div>
  );
}
