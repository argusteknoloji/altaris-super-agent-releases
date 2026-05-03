"use client";

// ─────────────────────────────────────────────────────────────────
// Senaryo 05 — "10 Dakika Kala"
// 14:50, 15:00'te büyük müşteri toplantısı. Pre-meeting brief.
// Mood: Tick-tock countdown, urgent → triumph.
// ─────────────────────────────────────────────────────────────────

import { SenaryoPlayer, type ScheduleFn } from "../_lib/SenaryoPlayer";
import { SenaryoStage } from "../_lib/SenaryoStage";
import { bell, gain, heartbeat, masterEnv, NOTES, osc, pad } from "../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0,3],[3,3],[6,3],[9,6],[15,3],[18,4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });

  // Pad: D minor → D major (tension to triumph)
  pad(ctx, master, t0, TOTAL, [NOTES.D3, NOTES.A3, NOTES.F3], [
    [0, 0], [2, 0.020], [9, 0.014], [15, 0.020], [21.6, 0],
  ]);

  // Clock ticks — tense countdown (every 0.5s in scenes 1-3)
  for (let i = 0; i < 18; i++) {
    const at = t0 + 0.5 + i * 0.5;
    if (at > t0 + 9) break;
    const o = osc(ctx, 1200, "square");
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 800;
    const g = gain(ctx, 0);
    o.connect(f).connect(g).connect(master);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.022, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    o.start(at);
    o.stop(at + 0.06);
  }

  // Heartbeat — accelerating then resolving
  [1.5, 2.8, 4.0, 5.2, 6.4, 7.4, 8.4].forEach((t, i) => heartbeat(ctx, master, t0 + t, 0.18 + i * 0.015));
  heartbeat(ctx, master, t0 + 9.0, 0.32);
  [10.5, 12.0, 13.5].forEach((t) => heartbeat(ctx, master, t0 + t, 0.20));
  heartbeat(ctx, master, t0 + 15.2, 0.24);
  heartbeat(ctx, master, t0 + 17.8, 0.30);

  // Bells — triumph at scene 4
  bell(ctx, master, t0 + 9.05, NOTES.A4, 0.15, 1.6);
  // History data points sequential
  [9.5, 10.5, 11.5, 12.5, 13.5].forEach((t, i) => bell(ctx, master, t0 + t, [NOTES.D4, NOTES.F4, NOTES.A4, NOTES.D5, NOTES.F4*2][i], 0.08, 0.9));
  // Reveal
  [NOTES.D4, NOTES.F4, NOTES.A4, NOTES.D5].forEach((f, i) => bell(ctx, master, t0 + 15.4 + i*0.18, f, 0.10, 1.0));
  // D-major theme: D F# A D
  [NOTES.D4, NOTES["F#4"], NOTES.A4, NOTES.D5].forEach((f, i) => bell(ctx, master, t0 + 18.2 + i*0.26, f, 0.13, 1.7));
};

export default function Senaryo5Page() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus teknoloji · senaryo 05 · 10 dakika kala"
      timeline={["14:50", "soru", "altaris", "tarihçe", "10 dk", "hazır"]}
    >
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ 14:50 · 10 dakika kaldı</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
              Müşteri 15:00'te.<br />
              <span className="text-[#7a7166]">Hazır mısınız?</span>
            </h1>
            <div className="mt-12 grid grid-cols-2 gap-4 max-w-xl">
              <div className="rounded-md border border-[rgba(120,80,50,0.4)] bg-[#0d0b0a]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#f08c50]/70">müşteri</div>
                <div className="mt-1 text-sm text-[#ddd8d0]">Acme A.Ş. — 3 yıllık portföy</div>
              </div>
              <div className="rounded-md border border-[rgba(120,80,50,0.4)] bg-[#0d0b0a]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#f08c50]/70">gündem</div>
                <div className="mt-1 text-sm text-[#ddd8d0]">Sözleşme yenileme</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s2">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <h2 className="text-[clamp(36px,5.5vw,80px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">"</span>
              Bu müşteriyle son 3 yıl<br />
              <span className="grad-text font-medium">nasıl gitti?</span>
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-10 text-base text-[#7a7166]">Şikayetler, ödemeler, teslimler, yenileme geçmişi — <span className="text-[#ddd8d0]">10 dakika içinde tam tablo</span>.</p>
          </div>
        </div>
      </section>

      <section className="scene s3">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">altaris · flash brief</div>
            <div className="rounded-md border border-[rgba(120,80,50,0.32)] bg-[#0d0b0a] p-6">
              <p className="text-base text-[#ddd8d0]">
                <span className="text-[#f08c50]">▸</span> Acme A.Ş. — son 36 ayın özet brief'i
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">
                <span>e-posta · 1.247</span>
                <span>toplantı · 38</span>
                <span>fatura · 89</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-6 text-[11px] uppercase tracking-[0.32em] text-[#9bd07e]">/ 3 yıllık özet · 5 anahtar nokta</div>
            <div className="space-y-3">
              {[
                ["yıl 1", "Sözleşme · 2.3M TL · zamanında ödendi"],
                ["yıl 2", "%12 büyüme · 2 yeni proje eklendi"],
                ["q4 2024", "Teslim gecikmesi · ek %8 indirim verildi"],
                ["q1 2025", "Memnuniyet skoru +14 · referans verdi"],
                ["bugün", "Yenileme talebi · değer artışı bekleniyor"],
              ].map(([y, t], i) => (
                <div key={i} className="grid grid-cols-[8rem_1fr] items-baseline gap-4 border-l-2 border-[#f08c50] pl-4">
                  <span className="text-[11px] uppercase tracking-[0.28em] text-[#ffb464]">{y}</span>
                  <span className="text-[#ddd8d0]">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="scene s5">
        <div className="stage">
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ klasik hazırlık</div>
            <div className="mt-6 flex items-center justify-center gap-8">
              <div className="text-[clamp(56px,8vw,128px)] font-light leading-none text-[#7a7166] line-through decoration-[#7a7166]/40">2 saat</div>
              <div className="text-[#f08c50]">→</div>
              <div className="text-[clamp(72px,11vw,160px)] font-light leading-none">
                <span className="grad-text font-medium">10 dk</span>
              </div>
            </div>
            <p className="mt-8 text-base text-[#bdb4a6]">Toplantıya <span className="text-[#ddd8d0]">tam donanımlı</span> giriyorsunuz.</p>
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
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">superagent — toplantı öncesi anlık brief</div>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#f08c50] bg-[#f08c50] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ flash brief</span>
              <span className="font-medium">demo · innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-05-10dk" label="senaryo 05 · 10 dakika kala" />
    </SenaryoStage>
  );
}
