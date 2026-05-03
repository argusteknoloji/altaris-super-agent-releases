"use client";

// ─────────────────────────────────────────────────────────────────
// Senaryo 13 — "Hat Duruşu" (Üretim/OEE)
// Üretim müdürü, 14:23 · OEE %72'ye düştü.
// MES + SCADA + ERP + kalite — dört sistem, üç saat veri farkı.
// Altaris: Pareto + kök neden 90 saniyede.
// Mood: industrial pulse, D minor mechanical, steady kicks.
// Accent: steel #7080a8 (çelik / endüstri)
// ─────────────────────────────────────────────────────────────────

import { SenaryoPlayer, type ScheduleFn } from "../_lib/SenaryoPlayer";
import { SenaryoStage } from "../_lib/SenaryoStage";
import { bell, gain, heartbeat, lfo, masterEnv, NOTES, osc, pad } from "../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0,3],[3,3],[6,3],[9,6],[15,3],[18,4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });

  // D minor industrial pad — drone with mechanical undertone
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.D3, NOTES.A3, NOTES.D4], [
    [0, 0], [2, 0.026], [9, 0.024], [14, 0.030], [17, 0.036], [20, 0.022], [21.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.3, 0.008, TOTAL, t0);

  // Industrial mechanical kicks — 0.7sn aralık, machinery rhythm
  const kicks = [0.7, 1.4, 2.1, 2.8, 3.5, 4.2, 4.9, 5.6, 6.3, 7.0, 7.7, 8.4, 9.1,
                 10.0, 11.0, 12.0, 13.0, 14.0,
                 15.0, 15.7, 16.4,
                 17.5, 18.5, 19.5, 20.5];
  kicks.forEach((t, i) => {
    heartbeat(ctx, master, t0 + t, i % 7 === 0 ? 0.30 : 0.18);
  });

  // Sahne 1 — alarm / siren tone
  bell(ctx, master, t0 + 0.4, NOTES.A4, 0.14, 1.6);
  bell(ctx, master, t0 + 0.7, NOTES.F4, 0.10, 1.4);
  bell(ctx, master, t0 + 1.4, NOTES.D4, 0.10, 1.2);

  // Sahne 2 — soru: descending minor (urgency)
  bell(ctx, master, t0 + 3.2, NOTES.F4, 0.10, 1.4);
  bell(ctx, master, t0 + 3.8, NOTES.D4, 0.10, 1.4);
  bell(ctx, master, t0 + 4.6, NOTES.A3, 0.09, 1.4);

  // Sahne 3 — terminal entry: data ingestion ticks
  [6.2, 6.5, 6.8, 7.1, 7.4, 7.7, 8.0].forEach((t) => {
    bell(ctx, master, t0 + t, NOTES.A5 + Math.random() * 40, 0.05, 0.4);
  });
  bell(ctx, master, t0 + 8.6, NOTES.D5, 0.10, 1.3);

  // Sahne 4 — Pareto reveal: 3 root causes
  [
    [9.5, NOTES.D4],
    [10.8, NOTES.F4],
    [12.1, NOTES.A4],
  ].forEach(([t, f]) => {
    bell(ctx, master, t0 + (t as number), f as number, 0.13, 1.4);
  });
  // Resolution chord
  [13.5, 13.8, 14.1].forEach((t, i) => {
    bell(ctx, master, t0 + t, [NOTES.D4, NOTES.F4, NOTES.A4][i], 0.08, 1.0);
  });

  // Sahne 5 — stopwatch ticks (90 saniye message)
  [15.0, 15.4, 15.8, 16.2, 16.6].forEach((t) => {
    bell(ctx, master, t0 + t, NOTES.A5, 0.07, 0.5);
  });

  // Sahne 6 — D minor → D major (resolved, mechanical triumph)
  [NOTES.D4, NOTES["F#4"], NOTES.A4, NOTES.D5].forEach((f, i) => {
    bell(ctx, master, t0 + 18.2 + i * 0.26, f, 0.13, 1.7);
  });

  // Sustain final — D drone resolution
  const finalOsc = osc(ctx, NOTES.D3, "triangle");
  const finalG = gain(ctx, 0);
  finalOsc.connect(finalG).connect(master);
  finalG.gain.setValueAtTime(0, t0 + 18);
  finalG.gain.linearRampToValueAtTime(0.05, t0 + 18.4);
  finalG.gain.linearRampToValueAtTime(0.04, t0 + 21);
  finalG.gain.exponentialRampToValueAtTime(0.0001, t0 + 22);
  finalOsc.start(t0 + 18);
  finalOsc.stop(t0 + 22.1);
};

export default function Senaryo13Page() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus + altaris industry · senaryo 13 · hat duruşu"
      timeline={["alarm", "soru", "altaris", "kök neden", "süre", "endüstri 4.0"]}
      accentColors={{ from: "#a0b0d8", via: "#7080a8", to: "#404870" }}
    >
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ üretim · hat 03 · 14:23</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
              <span className="text-[#ff8060]">⚠</span> OEE düştü.<br />
              <span className="text-[#7a7166]">%84 → %72</span>
            </h1>
            <div className="mt-12 grid grid-cols-3 gap-3 max-w-2xl">
              <div className="rounded-md border border-[rgba(160,176,216,0.45)] bg-[#0a0c10]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a0b0d8]">avalability</div>
                <div className="mt-1 text-[12px] text-[#ddd8d0]">%88 — normal</div>
              </div>
              <div className="rounded-md border border-[rgba(255,140,80,0.45)] bg-[#1a0d08]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#ffae6e]">performance</div>
                <div className="mt-1 text-[12px] text-[#ffae6e]">%79 ↓ kritik</div>
              </div>
              <div className="rounded-md border border-[rgba(255,140,80,0.45)] bg-[#1a0d08]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#ffae6e]">quality</div>
                <div className="mt-1 text-[12px] text-[#ffae6e]">%92 ↓ rework artıyor</div>
              </div>
            </div>
            <p className="mt-8 max-w-xl text-sm leading-relaxed text-[#9b9285]">
              MES · SCADA · ERP · kalite kontrol —
              <span className="text-[#ddd8d0]"> dört ayrı sistem, dakikalık fark</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="scene s2">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <h2 className="text-[clamp(32px,5vw,72px)] font-light leading-[1.15] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">"</span>
              Hangi vardiya, hangi lot,<br />
              <span className="grad-text font-medium">hangi parametre</span>?
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-10 text-base text-[#7a7166]">
              Vardiya kayıtları · parça lot izlenebilirliği · sıcaklık eğrisi · operatör notu —
              <span className="text-[#ddd8d0]"> insan tek başına eşleştiremez</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="scene s3">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">
              <span aria-hidden className="size-1.5 rounded-full bg-[#a0b0d8] animate-pulse" />
              <span>altaris industry · OEE analizi</span>
              <span className="text-[#3a342d]">·</span>
              <span>MES köprülü</span>
            </div>
            <div className="rounded-md border border-[rgba(160,176,216,0.5)] bg-[#0a0c10] p-6">
              <p className="text-base text-[#ddd8d0] font-mono">
                <span className="text-[#a0b0d8]">▸</span> altaris hat-analizi
                <span className="text-[#7a7166]"> --hat=03</span>
                <span className="text-[#7a7166]"> --pencere=4h</span>
                <span className="text-[#7a7166]"> --pareto</span>
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">
                <span>vardiya × lot</span>
                <span>scada parametre</span>
                <span>kalite hatası</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-6 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#a0b0d8]">/ pareto · oee düşüşünün kök nedenleri</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">son 4 saat · 12.4k birim</div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  num: "01",
                  label: "Sıcaklık sapması",
                  metric: "%47",
                  detail: "Pres-04 mengene sıcaklığı 184°C → 196°C. Set-point bandı dışına çıktı 11:50'de.",
                  src: ["SCADA", "Trend log", "Set-point"],
                },
                {
                  num: "02",
                  label: "Lot 7821 hammadde",
                  metric: "%32",
                  detail: "Yeni tedarikçi parti — viskozite +%8. Önceki lot ile parametre uyumu test edilmemiş.",
                  src: ["ERP", "QA giriş", "Tedarikçi"],
                },
                {
                  num: "03",
                  label: "Vardiya geçişi",
                  metric: "%17",
                  detail: "B vardiyasında operatör eğitimi tamamlanmamış 2 kişi. Reset prosedürü gecikmeli.",
                  src: ["MES", "Eğitim", "Vardiya"],
                },
              ].map((r) => (
                <div key={r.num} className="relative rounded-md border border-[rgba(160,176,216,0.45)] bg-[#0a0c10] p-4">
                  <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-[#a0b0d8]" />
                  <div className="flex items-start justify-between">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-[#a0b0d8]">/{r.num}</div>
                    <div className="text-base font-medium text-[#a0b0d8]">{r.metric}</div>
                  </div>
                  <h4 className="mt-3 text-base font-medium text-[#ddd8d0]">{r.label}</h4>
                  <p className="mt-2 text-[12px] leading-relaxed text-[#bdb4a6]">{r.detail}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[rgba(120,80,50,0.25)] pt-2">
                    {r.src.map((s) => (
                      <span key={s} className="rounded-sm border border-[rgba(160,176,216,0.4)] bg-[#0a1018] px-2 py-0.5 text-[9px] uppercase tracking-[0.22em] text-[#9b9285]">{s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-[rgba(160,176,216,0.45)] bg-[#0a0c10] p-4">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#a0b0d8]">öneri · şimdi yapılacak</div>
                <p className="mt-2 text-[12px] leading-relaxed text-[#ddd8d0]">Pres-04 sıcaklık set-point'ini 188°C'a düşür · Lot 7821 batch'lerini ayırıp QA test et · Vardiya değişiminde reset checklist tetikle.</p>
              </div>
              <div className="rounded-md border border-[rgba(159,216,159,0.45)] bg-[#0a100c] p-4">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#9fd89f]">tahmini geri kazanım</div>
                <div className="mt-2 text-2xl font-light text-[#9fd89f]">OEE %72 → %86</div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#bdb4a6]">İki saat içinde, üç aksiyon birden uygulandığında. Saat değer kaybı yaklaşık ₺94k.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s5">
        <div className="stage">
          <div className="text-center max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ veri sahada · karar vardiya amirinde</div>
            <h2 className="mt-8 text-[clamp(36px,5.5vw,80px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              <span className="text-[#7a7166]">Dört sistem</span> →
              <span className="grad-text font-medium"> doksan saniye</span>
            </h2>
            <p className="mt-8 text-base text-[#bdb4a6]">
              Sıcaklık · lot · vardiya — eşleştirildi, sıralandı, önerildi.
              <br />Hat durmadan önce kök neden yazıldı.
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
            <div className="mt-3 text-[11px] uppercase tracking-[0.32em] text-[#a0b0d8]">
              + altaris industry · MES + SCADA köprüsü
            </div>
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">
              endüstri 4.0 · veri saha · karar dakikta değil saniyede
            </div>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#a0b0d8] bg-[#a0b0d8] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ pilot</span>
              <span className="font-medium">demo · innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-13-hat-durusu" label="senaryo 13 · hat duruşu" />
    </SenaryoStage>
  );
}
