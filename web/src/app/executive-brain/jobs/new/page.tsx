"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Vault = { id: string; slug: string; name: string };
type Agent = { id: string; name: string; slug: string };
type ScheduleKind = "manual" | "hourly" | "daily" | "weekdays" | "weekly";

const SCHEDULE_LABELS: Record<ScheduleKind, string> = {
  manual:   "Manuel",
  hourly:   "Saatlik",
  daily:    "Günlük",
  weekdays: "Haftaiçi",
  weekly:   "Haftalık",
};

export default function NewJobPage() {
  const router = useRouter();
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [agentId, setAgentId] = useState<string>("");
  const [vaultSlugs, setVaultSlugs] = useState<string[]>([]);
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>("manual");
  const [atTime, setAtTime] = useState("09:00");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/proxy/vaults", { cache: "no-store" })
      .then(r => r.ok ? r.json() : [])
      .then(setVaults)
      .catch(() => {});
    fetch("/api/proxy/executive-brain/agents", { cache: "no-store" })
      .then(r => r.ok ? r.json() : [])
      .then(setAgents)
      .catch(() => {});
  }, []);

  function toggleVault(slug: string) {
    setVaultSlugs(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]);
  }

  async function submit() {
    if (!name.trim() || !instructions.trim()) {
      setErr("Ad ve talimat zorunlu.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (scheduleKind === "manual") {
        // Tek-seferlik job — anında submit
        const r = await fetch("/api/proxy/executive-brain/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: buildQuestion(),
            agentId: agentId || null,
            vaultSlugs: vaultSlugs.length > 0 ? vaultSlugs : null,
          }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
        const j = await r.json();
        router.push(`/executive-brain/jobs/${j.id}`);
      } else {
        // Recurring — schedule template kaydet
        const r = await fetch("/api/proxy/executive-brain/job-schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            instructions: buildQuestion(),
            agentId: agentId || null,
            vaultSlugs: vaultSlugs.length > 0 ? vaultSlugs : null,
            scheduleKind,
            atTime,
          }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
        router.push("/executive-brain/jobs");
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function buildQuestion() {
    // Description varsa instructions'tan önce küçük bir başlık olarak ekle
    const head = description.trim() ? `[${name.trim()}] ${description.trim()}\n\n` : "";
    return head + instructions.trim();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
      <Link href="/executive-brain/jobs" className="text-xs text-neutral-400 hover:text-orange-400">← İş Geçmişi</Link>
      <h1 className="mt-2 text-2xl font-semibold">Yeni İş <span className="text-sm font-normal text-neutral-500">/ New Job</span></h1>

      {scheduleKind !== "manual" && (
        <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          🛡 Zamanlanmış işler sunucuda çalışır — bilgisayarın açık olması gerekmez.
          Server tarafında dakika hassasiyetinde tetiklenir.
        </div>
      )}

      <div className="mt-6 space-y-5">
        <div>
          <label className="block text-xs text-neutral-400 mb-1">Ad <span className="text-red-400">*</span></label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="ör. günlük-ihale-taraması"
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm placeholder:text-neutral-600"
          />
        </div>

        <div>
          <label className="block text-xs text-neutral-400 mb-1">Açıklama</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Bu iş ne yapıyor — kısa özet"
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm placeholder:text-neutral-600"
          />
        </div>

        <div>
          <label className="block text-xs text-neutral-400 mb-1">Talimat <span className="text-red-400">*</span></label>
          <textarea
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder="Agent'a ne yapmasını istediğini detaylıca yaz. Vault'tan ne okumalı, ne çıkarmalı, nasıl raporlamalı."
            rows={6}
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm placeholder:text-neutral-600"
          />
        </div>

        <div>
          <label className="block text-xs text-neutral-400 mb-1">Vault seç (birden fazla seçilebilir)</label>
          {vaults.length === 0 ? (
            <p className="text-xs text-neutral-500 px-2 py-3 border border-neutral-800 rounded">
              Henüz vault yok. <Link href="/vaults" className="underline text-orange-400">Vault yarat</Link>.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {vaults.map(v => {
                const sel = vaultSlugs.includes(v.slug);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => toggleVault(v.slug)}
                    className={
                      "flex items-center justify-between rounded border px-3 py-2 text-left text-sm " +
                      (sel
                        ? "border-orange-500 bg-orange-500/10 text-orange-200"
                        : "border-neutral-700 text-neutral-300 hover:bg-neutral-900")
                    }
                  >
                    <span className="truncate">📂 {v.name}</span>
                    <span className="text-[10px] opacity-60 font-mono">{sel ? "✓" : v.slug}</span>
                  </button>
                );
              })}
            </div>
          )}
          {vaultSlugs.length > 0 && (
            <p className="mt-1 text-[11px] text-neutral-500">{vaultSlugs.length} vault seçili</p>
          )}
        </div>

        <div>
          <label className="block text-xs text-neutral-400 mb-1">Agent</label>
          <select
            value={agentId}
            onChange={e => setAgentId(e.target.value)}
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
          >
            <option value="">— Agent seçme (default davranış) —</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {agents.length === 0 && (
            <p className="mt-1 text-[11px] text-neutral-500">
              Agent yok. <Link href="/executive-brain/agents" className="underline text-orange-400">Agent yarat</Link>.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs text-neutral-400 mb-2">Zamanlama</label>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(SCHEDULE_LABELS) as ScheduleKind[]).map(k => (
              <button
                key={k}
                type="button"
                onClick={() => setScheduleKind(k)}
                className={
                  "rounded px-3 py-1.5 text-xs " +
                  (scheduleKind === k
                    ? "bg-neutral-100 text-neutral-900 font-medium"
                    : "text-neutral-400 hover:bg-neutral-900")
                }
              >
                {SCHEDULE_LABELS[k]}
              </button>
            ))}
          </div>
          {(scheduleKind === "daily" || scheduleKind === "weekdays" || scheduleKind === "weekly") && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-neutral-400">Saat</span>
              <input
                type="time"
                value={atTime}
                onChange={e => setAtTime(e.target.value)}
                className="rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm font-mono"
              />
              <span className="text-[11px] text-neutral-500">UTC</span>
            </div>
          )}
          {scheduleKind !== "manual" && (
            <p className="mt-2 text-[11px] text-neutral-500">
              Zamanlanmış işler birkaç dakikalık rastgele gecikmeyle çalıştırılır (server load için).
            </p>
          )}
        </div>

        {err && <p className="text-xs text-red-400">{err}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
          <Link
            href="/executive-brain/jobs"
            className="rounded border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
          >
            İptal
          </Link>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !name.trim() || !instructions.trim()}
            className="rounded bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? "Oluşturuluyor…" : (scheduleKind === "manual" ? "Şimdi Çalıştır" : "Zamanlamayı Kaydet")}
          </button>
        </div>
      </div>
    </main>
  );
}
