"use client";

// ─────────────────────────────────────────────────────────────────
// Senaryo 03 — "Boardroom"
// 5 yöneticili toplantı. Tedarikçi seçimi. SuperAgent simülasyon.
// Mood: Methodical analitik, slow build, major key resolve.
// ─────────────────────────────────────────────────────────────────

import { SenaryoPlayer, type ScheduleFn } from "../_lib/SenaryoPlayer";
import { SenaryoStage } from "../_lib/SenaryoStage";
import { bell, heartbeat, lfo, masterEnv, NOTES, pad } from "../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0,3],[3,3],[6,3],[9,6],[15,3],[18,4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });

  // Pad: F major (F + A + C) — refined, contemplative
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.F3, NOTES.A3, NOTES.C5], [
    [0, 0], [2, 0.020], [9, 0.018], [14, 0.022], [17, 0.028], [20, 0.018], [21.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.15, 0.005, TOTAL, t0);

  // Slow methodical heartbeat — like a clock
  [1.0, 3.0, 5.0, 7.0, 9.0, 11.0, 13.0, 15.0, 17.0, 19.0].forEach((t, i) => {
    heartbeat(ctx, master, t0 + t, i === 0 ? 0.16 : i === 4 || i === 8 ? 0.28 : 0.18);
  });

  // Bell accents
  bell(ctx, master, t0 + 0.3, NOTES.C5, 0.10, 1.6);
  bell(ctx, master, t0 + 6.2, NOTES.E5, 0.12, 1.8);     // simülasyon başla
  bell(ctx, master, t0 + 9.05, NOTES.G5, 0.14, 1.8);    // sonuçlar
  bell(ctx, master, t0 + 9.05, NOTES.C5 * 2, 0.08, 2.0);
  // 3 senaryo bell'leri
  [9.5, 11.0, 12.5].forEach((t, i) => bell(ctx, master, t0 + t, [NOTES.C5, NOTES.E5, NOTES.G5][i], 0.085, 1.0));
  // Reveal — proud major arpej
  [NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C5 * 2].forEach((f, i) => bell(ctx, master, t0 + 15.4 + i*0.18, f, 0.10, 1.0));
  // F-major theme: F A C F
  [NOTES.F4, NOTES.A4, NOTES.C5, NOTES.F4 * 2].forEach((f, i) => bell(ctx, master, t0 + 18.2 + i*0.26, f, 0.13, 1.7));
};

export default function Senaryo3Page() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus teknoloji · senaryo 03 · boardroom"
      timeline={["toplantı", "soru", "simülasyon", "3 senaryo", "öneri", "karar"]}
    >
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ yönetim kurulu · perşembe 14:00</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
              Masa çevresinde<br />
              <span className="text-[#7a7166]">5 yönetici. Tek karar.</span>
            </h1>
            <div className="mt-12 flex gap-6 flex-wrap">
              {["CEO", "CFO", "COO", "Satınalma", "Üretim"].map((r) => (
                <div key={r} className="rounded-md border border-[rgba(120,80,50,0.4)] bg-[#0d0b0a]/85 px-4 py-2 text-sm text-[#bdb4a6]">{r}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="scene s2">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ gündem maddesi</div>
            <h2 className="mt-6 text-[clamp(36px,5.5vw,80px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">"</span>
              3 tedarikçi adayı.<br />
              <span className="grad-text font-medium">Hangisi?</span>
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-10 text-base text-[#7a7166]">Fiyat, kalite, lojistik, geçmiş performans — <span className="text-[#ddd8d0]">çok değişken</span>.</p>
          </div>
        </div>
      </section>

      <section className="scene s3">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">altaris · simülasyon başlıyor</div>
            <div className="rounded-md border border-[rgba(120,80,50,0.32)] bg-[#0d0b0a] p-6">
              <p className="text-base text-[#ddd8d0]">
                <span className="text-[#f08c50]">▸</span> Tedarikçi A · B · C için 6 aylık projection hesapla
              </p>
              <div className="mt-4 grid grid-cols-4 gap-3 text-[11px]">
                {["18 ay geçmiş", "fiyat eğrisi", "kalite skoru", "lojistik yükü"].map((d) => (
                  <div key={d} className="rounded border border-[rgba(120,80,50,0.32)] bg-[#1a1612] px-3 py-2 text-[#bdb4a6]">
                    <span className="text-[#9bd07e]">✓</span> {d}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-6 text-[11px] uppercase tracking-[0.32em] text-[#9bd07e]">/ 3 senaryo · 6 aylık öngörü</div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { tag: "A", color: "#7a7166", title: "Mevcut · Tedarikçi A", cost: "₺ baz", risk: "düşük", note: "Statik · iyileştirme yok" },
                { tag: "B", color: "#ffb464", title: "Geçiş · Tedarikçi B", cost: "%-12", risk: "%4 gecikme", note: "Hemen geçiş · Q1 darboğaz", best: true },
                { tag: "C", color: "#7a7166", title: "Karma · A + C", cost: "%-7", risk: "%2", note: "Kademeli · daha güvenli" },
              ].map((s) => (
                <div key={s.tag} className={`relative rounded-md border bg-[#0d0b0a] p-4 ${s.best ? "border-[#f08c50] shadow-[0_0_0_1px_rgba(240,140,80,0.18)]" : "border-[rgba(120,80,50,0.32)]"}`}>
                  {s.best && <div className="absolute -top-2.5 left-3 rounded-full bg-[#f08c50] px-2.5 py-0.5 text-[9px] uppercase tracking-[0.22em] text-[#0a0908]">★ önerilen</div>}
                  <div className="text-[10px] uppercase tracking-[0.28em]" style={{ color: s.color }}>senaryo {s.tag}</div>
                  <h4 className="mt-2 text-base font-medium text-[#ddd8d0]">{s.title}</h4>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div><span className="text-[#7a7166]">maliyet:</span> <span className="text-[#ddd8d0]">{s.cost}</span></div>
                    <div><span className="text-[#7a7166]">risk:</span> <span className="text-[#ddd8d0]">{s.risk}</span></div>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-[#9b9285]">{s.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="scene s5">
        <div className="stage">
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ veri konuştu · ekip tartışsın</div>
            <h2 className="mt-8 text-[clamp(40px,6vw,90px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              Önerilen: <span className="grad-text font-medium">Senaryo C</span>
            </h2>
            <p className="mt-6 text-base text-[#bdb4a6]">
              Maliyet %7 düşer, risk %2'de kalır.<br />
              <span className="text-[#7a7166]">Karar yine sizin — ama veriden değil sezgiden değil.</span>
            </p>
          </div>
        </div>
      </section>

      <section className="scene s6">
        <div className="stage">
          <div className="w-full max-w-4xl text-center">
            <pre aria-label="Altaris" className="grad-shimmer mx-auto select-none whitespace-pre font-bold leading-[1.05] tracking-[0.02em] text-[clamp(13px,1.8vw,22px)]">
{`█▀█   █    ▀█▀   █▀█   █▀▄   █   █▀▀
█▀█   █     █    █▀█   █▀▄   █   ▀▀█
▀ ▀   ▀▀▀   ▀    ▀ ▀   ▀ ▀   ▀   ▀▀▀`}
            </pre>
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">superagent — boardroom kararlarına veri gücü</div>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#f08c50] bg-[#f08c50] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ simülasyon</span>
              <span className="font-medium">demo · innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-03-boardroom" label="senaryo 03 · boardroom" />
    </SenaryoStage>
  );
}
