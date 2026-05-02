"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ScenarioParam = { key: string; label: string; type: "text" | "number" | "date"; placeholder?: string; default?: string };
type Scenario = { slug: string; name: string; description: string; icon: string; params: ScenarioParam[] };

/**
 * What-if simulasyonu — yöneticinin "Eğer X olursa ne olur?" sorularını yapılandırılmış
 * bir formdan alıp Executive Brain job pipeline'ına gönderir. CFO/Risk built-in
 * ajanları varsa onlar seçilir (calc tool ile sayısal çıkarsama yapar).
 */
export default function SimulatePage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selected, setSelected] = useState<Scenario | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/proxy/executive-brain/simulations/scenarios", { cache: "no-store" })
      .then(r => r.ok ? r.json() : [])
      .then(setScenarios);
  }, []);

  function pick(s: Scenario) {
    setSelected(s); setErr(null);
    const init: Record<string, string> = {};
    s.params.forEach(p => { init[p.key] = p.default ?? ""; });
    setParams(init);
  }

  async function run() {
    if (!selected) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/proxy/executive-brain/simulations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioSlug: selected.slug, params }),
      });
      if (!r.ok) { setErr(await r.text()); return; }
      const j = await r.json() as { id: string };
      // Direkt job detail/stream sayfasına yönlendir
      window.location.href = `/executive-brain/jobs/${j.id}`;
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <Link href="/executive-brain" className="text-xs text-neutral-400 hover:text-orange-400">← Beyin</Link>
          <h1 className="mt-2 text-3xl font-semibold">🔮 What-if simülatör</h1>
          <p className="mt-1 text-sm text-neutral-400">
            "Eğer X olursa..." sorularını yapılandırılmış formdan sor — CFO/Risk ajanı vault verilerinden
            cevap üretir.
          </p>
        </div>
        <Link href="/executive-brain/jobs" className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900">
          ⌚ Geçmiş simülasyonlar
        </Link>
      </div>

      <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {scenarios.map(s => (
          <button key={s.slug} onClick={() => pick(s)}
            className={`rounded-lg border p-4 text-left transition ${
              selected?.slug === s.slug
                ? "border-orange-500/60 bg-orange-500/10"
                : "border-neutral-800 bg-neutral-900/40 hover:border-neutral-700"
            }`}>
            <div className="text-2xl">{s.icon}</div>
            <h3 className="mt-2 text-sm font-semibold text-orange-400">{s.name}</h3>
            <p className="mt-1 text-xs text-neutral-400">{s.description}</p>
          </button>
        ))}
        {scenarios.length === 0 && (
          <p className="col-span-3 text-sm text-neutral-500">Senaryo yüklenemedi.</p>
        )}
      </section>

      {selected && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-5">
          <h2 className="mb-4 text-base font-semibold">{selected.icon} {selected.name}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {selected.params.map(p => (
              <label key={p.key} className="text-xs text-neutral-300">
                <span className="block mb-1 text-neutral-400">{p.label}</span>
                <input
                  type={p.type}
                  placeholder={p.placeholder}
                  value={params[p.key] ?? ""}
                  onChange={e => setParams({ ...params, [p.key]: e.target.value })}
                  className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm font-mono"
                />
              </label>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button onClick={run} disabled={busy}
              className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
              {busy ? "Senaryo çalıştırılıyor…" : "🔮 Simülasyonu başlat"}
            </button>
            <button onClick={() => setSelected(null)} className="text-xs text-neutral-400 hover:text-white">
              İptal
            </button>
            {err && <span className="text-xs text-red-400">Hata: {err}</span>}
          </div>

          <p className="mt-4 text-[10px] text-neutral-600">
            Simülasyon vault'taki finansal + CRM + sözleşme verilerini kullanır. CFO veya Risk
            ajanı varsa otomatik seçilir; yoksa default agent + calc tool kullanılır.
          </p>
        </section>
      )}
    </main>
  );
}
