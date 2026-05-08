"use client";

// ─────────────────────────────────────────────────────────────────
// Senaryo 17 — "SAHA EXPO 2026" (Savunma Sanayii)
// Argus Teknoloji + Altaris ekosistemi — SSB EYDEB akrediteli partner.
// Mood: defense gravity + AI dynamism. D minor → D major resolution.
// Accent: gold #c9a961 (EYDEB güven mührü · institutional gold)
// ─────────────────────────────────────────────────────────────────

import { SenaryoPlayer, type ScheduleFn } from "../_lib/SenaryoPlayer";
import { SenaryoStage } from "../_lib/SenaryoStage";
import { bell, gain, heartbeat, lfo, masterEnv, NOTES, osc, pad, sweep } from "../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0, 3], [3, 4], [7, 5], [12, 4], [16, 3], [19, 4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });

  // D minor pad — defense gravity
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.D3, NOTES.A3, NOTES.D4], [
    [0, 0], [1.5, 0.022], [7, 0.020], [12, 0.024], [16, 0.030], [19, 0.034], [21.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.18, 0.005, TOTAL, t0);

  // Radar ping motif — tek nota, her sahne geçişinde tekrar (brand signature)
  const ping = (at: number, freq = NOTES.A5, peak = 0.10) =>
    bell(ctx, master, t0 + at, freq, peak, 1.6);
  ping(0.6);          // sahne 1 açılış
  ping(3.2);          // sahne 2 giriş
  ping(7.2);          // sahne 3 giriş (Altaris)
  ping(12.2);         // sahne 4 giriş
  ping(16.2, NOTES.D5, 0.13); // sahne 5 — daha alçak, mühür ağırlığı
  ping(19.2, NOTES.D5, 0.11); // sahne 6 — kapanış

  // Sahne 1 — radar tarama: low drone pulse
  heartbeat(ctx, master, t0 + 0.4, 0.20, 90, 40, 0.6);
  heartbeat(ctx, master, t0 + 1.8, 0.16, 90, 40, 0.5);

  // Sahne 2 — disonant arpej (ERP/CRM/BPM dağınık)
  bell(ctx, master, t0 + 3.4, NOTES.D4, 0.10, 0.9);
  bell(ctx, master, t0 + 3.9, NOTES["F4"] - 8, 0.10, 0.9);  // tritone-ish dissonance
  bell(ctx, master, t0 + 4.4, NOTES.B3, 0.10, 0.9);
  bell(ctx, master, t0 + 5.2, NOTES["C#4"], 0.09, 0.8);
  bell(ctx, master, t0 + 6.0, NOTES.A3, 0.08, 0.7);
  // Heartbeat tension — silos circulating
  [3.5, 4.5, 5.5, 6.5].forEach((t) => heartbeat(ctx, master, t0 + t, 0.14));

  // Sahne 3 — Altaris çözümü: rising sweep + resolution chord
  sweep(ctx, master, t0 + 7.0, 1.4, 200, 1800, 0.06);
  // Theme motif first hint (D pentatonic ascending) — yumuşak
  [NOTES.D4, NOTES["F#4"], NOTES.A4, NOTES.D5].forEach((f, i) => {
    bell(ctx, master, t0 + 8.4 + i * 0.32, f, 0.10, 1.4);
  });
  // Orbit ticks — AI agent dots
  [10.2, 10.5, 10.8, 11.1, 11.4].forEach((t) => {
    bell(ctx, master, t0 + t, NOTES.A5 + Math.random() * 30, 0.04, 0.4);
  });

  // Sahne 4 — sektörel derinlik: ritmik puls
  [12.4, 13.0, 13.6, 14.2, 14.8, 15.4].forEach((t, i) => {
    heartbeat(ctx, master, t0 + t, i % 2 === 0 ? 0.20 : 0.13, 110, 45, 0.4);
  });
  // 4 etiket bell hits — yörünge revealing
  [
    [12.7, NOTES.D4],
    [13.4, NOTES["F#4"]],
    [14.1, NOTES.A4],
    [14.8, NOTES.D5],
  ].forEach(([t, f]) => bell(ctx, master, t0 + (t as number), f as number, 0.09, 1.2));

  // Sahne 5 — EYDEB mührü: rezonanslı tek vuruş + sustained gold tone
  bell(ctx, master, t0 + 16.4, NOTES.D3, 0.18, 2.6, 0.5);
  bell(ctx, master, t0 + 16.5, NOTES.D4, 0.14, 2.4, 0.4);
  // Sustained gold drone
  const goldOsc = osc(ctx, NOTES.A3, "sine");
  const goldG = gain(ctx, 0);
  goldOsc.connect(goldG).connect(master);
  goldG.gain.setValueAtTime(0, t0 + 16.4);
  goldG.gain.linearRampToValueAtTime(0.05, t0 + 16.9);
  goldG.gain.linearRampToValueAtTime(0.04, t0 + 18.6);
  goldG.gain.exponentialRampToValueAtTime(0.0001, t0 + 19.2);
  goldOsc.start(t0 + 16.4);
  goldOsc.stop(t0 + 19.3);

  // Sahne 6 — kapanış: D pentatonic ascending (brand theme motif full forte)
  [NOTES.D4, NOTES["F#4"], NOTES.A4, NOTES.D5].forEach((f, i) => {
    bell(ctx, master, t0 + 19.3 + i * 0.28, f, 0.13, 1.8);
  });
  // Final D drone resolve
  const finalOsc = osc(ctx, NOTES.D3, "triangle");
  const finalG = gain(ctx, 0);
  finalOsc.connect(finalG).connect(master);
  finalG.gain.setValueAtTime(0, t0 + 19.2);
  finalG.gain.linearRampToValueAtTime(0.06, t0 + 19.8);
  finalG.gain.linearRampToValueAtTime(0.05, t0 + 21.2);
  finalG.gain.exponentialRampToValueAtTime(0.0001, t0 + 22);
  finalOsc.start(t0 + 19.2);
  finalOsc.stop(t0 + 22.1);
};

const extraCss = `
  /* Radar grid (sahne 1) */
  .radar-grid {
    position: absolute; inset: 0;
    background-image:
      radial-gradient(circle at center, transparent 0, transparent 8%, rgba(201,169,97,0.08) 8.1%, rgba(201,169,97,0.08) 8.3%, transparent 8.4%),
      radial-gradient(circle at center, transparent 0, transparent 18%, rgba(201,169,97,0.10) 18.1%, rgba(201,169,97,0.10) 18.3%, transparent 18.4%),
      radial-gradient(circle at center, transparent 0, transparent 32%, rgba(201,169,97,0.10) 32.1%, rgba(201,169,97,0.10) 32.3%, transparent 32.4%),
      radial-gradient(circle at center, transparent 0, transparent 48%, rgba(201,169,97,0.08) 48.1%, rgba(201,169,97,0.08) 48.3%, transparent 48.4%);
    opacity: 0.6;
  }
  .radar-sweep {
    position: absolute; inset: 0;
    background: conic-gradient(from 0deg at 50% 50%, rgba(201,169,97,0.45) 0deg, rgba(201,169,97,0.05) 12deg, transparent 30deg, transparent 360deg);
    animation: radar-spin 3s linear infinite;
    mix-blend-mode: screen;
  }
  @keyframes radar-spin { to { transform: rotate(360deg); } }

  /* Silo nodes (sahne 2) */
  .silo {
    position: absolute;
    border: 1px solid rgba(229, 96, 80, 0.55);
    background: rgba(20, 14, 12, 0.85);
    border-radius: 50%;
    width: 140px; height: 140px;
    display: grid; place-items: center;
    text-transform: uppercase; letter-spacing: 0.32em;
    font-size: 11px; color: #e88070;
    animation: silo-drift 6s ease-in-out infinite;
  }
  .silo.s-erp { top: 22%; left: 22%; animation-delay: 0s; }
  .silo.s-crm { top: 22%; right: 22%; animation-delay: -2s; }
  .silo.s-bpm { bottom: 18%; left: 50%; transform: translateX(-50%); animation-delay: -4s; }
  @keyframes silo-drift {
    0%, 100% { transform: translate(0, 0) rotate(-2deg); }
    50%      { transform: translate(8px, -6px) rotate(3deg); }
  }
  .scene.s3 .silo.s-bpm { transform: translateX(-50%); }

  .silo-link {
    position: absolute;
    border-top: 1px dashed rgba(229, 96, 80, 0.55);
    transform-origin: 0 0;
    pointer-events: none;
  }

  /* Altaris core ring (sahne 3) */
  .altaris-ring {
    position: absolute; left: 50%; top: 50%;
    width: 320px; height: 320px;
    margin-left: -160px; margin-top: -160px;
    border: 1px solid rgba(201,169,97,0.55);
    border-radius: 50%;
    box-shadow: 0 0 80px rgba(201,169,97,0.18) inset, 0 0 60px rgba(201,169,97,0.10);
    animation: ring-pulse 3s ease-in-out infinite;
  }
  @keyframes ring-pulse {
    0%, 100% { box-shadow: 0 0 80px rgba(201,169,97,0.18) inset, 0 0 60px rgba(201,169,97,0.10); }
    50%      { box-shadow: 0 0 120px rgba(201,169,97,0.28) inset, 0 0 90px rgba(201,169,97,0.18); }
  }
  .ai-orbit {
    position: absolute; left: 50%; top: 50%;
    width: 4px; height: 4px;
    margin: -2px 0 0 -2px;
    background: #c9a961;
    border-radius: 50%;
    box-shadow: 0 0 12px #c9a961, 0 0 20px rgba(201,169,97,0.6);
  }
  .ai-orbit.o1 { animation: orbit 4s linear infinite; }
  .ai-orbit.o2 { animation: orbit 4s linear infinite -1.3s; }
  .ai-orbit.o3 { animation: orbit 4s linear infinite -2.6s; }
  @keyframes orbit {
    from { transform: rotate(0deg) translateX(180px) rotate(0deg); }
    to   { transform: rotate(360deg) translateX(180px) rotate(-360deg); }
  }

  /* Sahne 4 — orbital labels */
  .orbital-label {
    position: absolute; left: 50%; top: 50%;
    width: 200px;
    margin-left: -100px;
    text-align: center;
    border: 1px solid rgba(201,169,97,0.45);
    background: rgba(10, 22, 40, 0.85);
    padding: 10px 12px;
    color: #e8eef5;
    font-size: 12px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .orbital-label.l1 { transform: translate(-260px, -120px); }
  .orbital-label.l2 { transform: translate(60px, -120px); }
  .orbital-label.l3 { transform: translate(-260px, 60px); }
  .orbital-label.l4 { transform: translate(60px, 60px); }

  /* Sahne 5 — EYDEB seal */
  .seal {
    position: relative;
    width: 280px; height: 280px;
    border: 2px solid #c9a961;
    border-radius: 50%;
    display: grid; place-items: center;
    box-shadow:
      0 0 0 8px rgba(201,169,97,0.10),
      0 0 0 18px rgba(201,169,97,0.05),
      0 0 60px rgba(201,169,97,0.30) inset,
      0 0 80px rgba(201,169,97,0.25);
    animation: seal-glow 2.4s ease-in-out infinite;
  }
  @keyframes seal-glow {
    0%, 100% { box-shadow: 0 0 0 8px rgba(201,169,97,0.10), 0 0 0 18px rgba(201,169,97,0.05), 0 0 60px rgba(201,169,97,0.30) inset, 0 0 80px rgba(201,169,97,0.25); }
    50%      { box-shadow: 0 0 0 8px rgba(201,169,97,0.18), 0 0 0 18px rgba(201,169,97,0.10), 0 0 90px rgba(201,169,97,0.45) inset, 0 0 120px rgba(201,169,97,0.40); }
  }
  .trust-ring {
    position: absolute;
    left: 50%; top: 50%;
    width: 280px; height: 280px;
    margin: -140px 0 0 -140px;
    border: 1px solid rgba(201,169,97,0.55);
    border-radius: 50%;
    animation: trust-expand 2.6s ease-out infinite;
  }
  @keyframes trust-expand {
    0%   { transform: scale(1);    opacity: 0.7; }
    100% { transform: scale(2.4);  opacity: 0; }
  }
`;

export default function Senaryo17Page() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus + altaris · senaryo 17 · saha expo 2026"
      timeline={["radar", "silo", "altaris", "yörünge", "eydeb", "saha expo"]}
      accentColors={{ from: "#e8d090", via: "#c9a961", to: "#8a6f3a" }}
      extraCss={extraCss}
    >
      {/* SAHNE 1 — Radar açılış */}
      <section className="scene s1">
        <div className="stage relative">
          <div aria-hidden className="radar-grid" />
          <div aria-hidden className="radar-sweep" />
          <div className="relative z-10 text-center max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#8a8270]">/ savunma sanayii · 2026</div>
            <h1 className="mt-6 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#e8eef5]">
              Dijital dönüşüm artık<br />
              <span className="text-[#8a8270]">bir tercih değil.</span>
            </h1>
            <p className="mt-6 text-lg uppercase tracking-[0.32em] grad-text font-medium">
              stratejik bir zorunluluk
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 2 — Üç dağınık silo */}
      <section className="scene s2">
        <div className="stage relative">
          <div className="absolute inset-0">
            <div className="silo s-erp">ERP</div>
            <div className="silo s-crm">CRM</div>
            <div className="silo s-bpm">BPM</div>
          </div>
          <div className="relative z-10 text-center max-w-3xl">
            <h2 className="text-[clamp(28px,4vw,56px)] font-light leading-[1.15] tracking-tight text-[#e8eef5]">
              Parçalı sistemler.<br />
              <span className="text-[#e88070]">Kopuk veri.</span>{" "}
              <span className="text-[#7a7166]">Yavaş karar.</span>
            </h2>
            <p className="mt-8 text-sm uppercase tracking-[0.32em] text-[#7a7166]">
              üç ayrı motor · senkron yok · tek pano yok
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 3 — Altaris devreye girer */}
      <section className="scene s3">
        <div className="stage relative">
          <div aria-hidden className="altaris-ring" />
          <div aria-hidden className="ai-orbit o1" />
          <div aria-hidden className="ai-orbit o2" />
          <div aria-hidden className="ai-orbit o3" />
          <div className="relative z-10 text-center">
            <pre aria-label="Altaris" className="grad-shimmer mx-auto select-none whitespace-pre font-bold leading-[1.05] tracking-[0.02em] text-[clamp(11px,1.4vw,18px)]">
{`█▀█   █    ▀█▀   █▀█   █▀▄   █   █▀▀
█▀█   █     █    █▀█   █▀▄   █   ▀▀█
▀ ▀   ▀▀▀   ▀    ▀ ▀   ▀ ▀   ▀   ▀▀▀`}
            </pre>
            <div className="mt-6 text-[11px] uppercase tracking-[0.32em] text-[#c9a961]">
              ERP <span className="text-[#5a534a]">+</span> CRM <span className="text-[#5a534a]">+</span> BPM
              <span className="mx-3 text-[#c9a961]">→</span>
              <span className="text-[#e8eef5]">tek AI ekosistemi</span>
            </div>
            <p className="mt-12 max-w-2xl mx-auto text-sm text-[#9b9285] leading-relaxed">
              <span className="text-[#e8eef5]">Altaris altyapısı</span> ile silolar yıkıldı.
              Veri tek noktada · karar tek panoda · ajanlar yörüngede.
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 4 — Yörüngede sektörel etiketler */}
      <section className="scene s4">
        <div className="stage relative">
          <div aria-hidden className="altaris-ring" style={{ opacity: 0.4 }} />
          <div className="absolute inset-0 grid place-items-center">
            <div className="relative">
              <div className="orbital-label l1">Tedarik Zinciri</div>
              <div className="orbital-label l2">Üretim Takibi</div>
              <div className="orbital-label l3">Uyumluluk</div>
              <div className="orbital-label l4">Karar Desteği</div>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-[12vh] z-10 text-center">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#c9a961]">/ savunma sanayii özel</div>
            <h3 className="mt-3 text-[clamp(28px,4vw,52px)] font-light tracking-tight text-[#e8eef5]">
              AI <span className="grad-text font-medium">native</span>.
              Sektör <span className="grad-text font-medium">spesifik</span>.
            </h3>
          </div>
        </div>
      </section>

      {/* SAHNE 5 — EYDEB güven mührü */}
      <section className="scene s5">
        <div className="stage relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_50%,rgba(0,0,0,0.6),transparent_70%)]" />
          <div className="relative z-10 text-center">
            <div className="relative inline-block">
              <div aria-hidden className="trust-ring" />
              <div className="seal">
                <div className="text-center px-6">
                  <div className="text-[10px] uppercase tracking-[0.36em] text-[#c9a961]">/ ssb</div>
                  <div className="mt-2 text-2xl font-medium text-[#e8d090]">EYDEB</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.28em] text-[#c9a961]">akrediteli</div>
                  <div className="mt-3 mx-auto h-px w-12 bg-[#c9a961]" />
                  <div className="mt-3 text-[9px] uppercase tracking-[0.32em] text-[#9b9285]">argus teknoloji</div>
                </div>
              </div>
            </div>
            <p className="mt-12 text-base uppercase tracking-[0.32em] text-[#e8eef5]">
              <span className="text-[#7a7166]">belge değil.</span>{" "}
              <span className="grad-text font-medium">teminat.</span>
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 6 — Kapanış: SAHA EXPO */}
      <section className="scene s6">
        <div className="stage">
          <div className="w-full max-w-4xl text-center">
            <div className="text-[10px] uppercase tracking-[0.36em] text-[#9b9285]">argus teknoloji</div>
            <pre aria-label="Altaris" className="grad-shimmer mx-auto mt-3 select-none whitespace-pre font-bold leading-[1.05] tracking-[0.02em] text-[clamp(13px,1.8vw,22px)]">
{`█▀█   █    ▀█▀   █▀█   █▀▄   █   █▀▀
█▀█   █     █    █▀█   █▀▄   █   ▀▀█
▀ ▀   ▀▀▀   ▀    ▀ ▀   ▀ ▀   ▀   ▀▀▀`}
            </pre>
            <div className="mt-3 text-[11px] uppercase tracking-[0.32em] text-[#c9a961]">
              ERP · CRM · BPM · AI ekosistemi
            </div>
            <div className="mx-auto mt-12 inline-flex flex-col items-center gap-3 rounded-md border border-[#c9a961] bg-[#c9a961] px-10 py-5 text-[#0a1628]">
              <span className="text-[10px] uppercase tracking-[0.36em] opacity-80">/ saha expo 2026</span>
              <span className="text-lg font-medium">Savunma sanayiine güvenilir AI ortağı</span>
              <span className="text-[11px] uppercase tracking-[0.28em] opacity-80">argus.com.tr · altaris.run</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer
        schedule={schedule}
        durationSec={TOTAL}
        filenamePrefix="senaryo-17-saha-expo-2026"
        label="senaryo 17 · saha expo 2026"
      />
    </SenaryoStage>
  );
}
