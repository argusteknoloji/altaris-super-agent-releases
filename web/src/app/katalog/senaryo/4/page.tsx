"use client";

// ─────────────────────────────────────────────────────────────────
// Senaryo 04 — "İlk Gün"
// Yeni atanan müdür, boş masa, ekibin tarihçesi yok.
// SuperAgent kurum hafızası açar — geçmiş kararlar, müşteri patterns.
// Mood: Sıcak, hopeful, discovery arpeggios. C major (warm).
// ─────────────────────────────────────────────────────────────────

import { SenaryoPlayer, type ScheduleFn } from "../_lib/SenaryoPlayer";
import { SenaryoStage } from "../_lib/SenaryoStage";
import { bell, heartbeat, lfo, masterEnv, NOTES, pad } from "../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0,3],[3,3],[6,3],[9,6],[15,3],[18,4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });

  // Pad: C major (C + E + G) — warm, optimistic
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.C5/2, NOTES.E5/2, NOTES.G5/2], [
    [0, 0], [2, 0.022], [9, 0.020], [14, 0.026], [17, 0.030], [20, 0.020], [21.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.2, 0.006, TOTAL, t0);

  // Soft heartbeat — gentle pulse
  [1.2, 3.2, 5.4, 7.4, 9.2, 11.5, 13.5, 15.8, 18.0, 20.2].forEach((t) => heartbeat(ctx, master, t0 + t, 0.18));

  // Discovery bells — climbing arpeggios at scene transitions
  bell(ctx, master, t0 + 0.3, NOTES.C5, 0.10, 1.6);
  bell(ctx, master, t0 + 6.2, NOTES.E5, 0.12, 1.8);
  // Scene 4 — kurum hafızası açılıyor (3 katman)
  [9.2, 9.5, 9.8].forEach((t, i) => bell(ctx, master, t0 + t, [NOTES.C5, NOTES.E5, NOTES.G5][i], 0.10, 1.4));
  // Risk benzeri 3 kart
  [10.8, 12.0, 13.2].forEach((t, i) => bell(ctx, master, t0 + t, [NOTES.G5, NOTES.E5, NOTES.C5*2][i], 0.085, 1.0));
  // Reveal — proud
  [NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C5*2].forEach((f, i) => bell(ctx, master, t0 + 15.4 + i*0.18, f, 0.10, 1.0));
  // C-major theme: C E G C
  [NOTES.C5/2, NOTES.E5/2, NOTES.G5/2, NOTES.C5].forEach((f, i) => bell(ctx, master, t0 + 18.2 + i*0.26, f, 0.13, 1.7));
};

export default function Senaryo4Page() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus teknoloji · senaryo 04 · ilk gün"
      timeline={["09:00", "soru", "altaris", "kurum hafızası", "30 dk", "hazır"]}
      accentColors={{ from: "#ffd28a", via: "#f0a060", to: "#c87a3a" }}
    >
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ pazartesi · 09:00 · ilk gün</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
              Yeni müdür.<br />
              <span className="text-[#7a7166]">Yeni masa. Yeni ekip.</span>
            </h1>
            <div className="mt-12 grid grid-cols-3 gap-4 max-w-xl">
              {["12 kişilik ekip", "23 müşteri portföyü", "3 yıllık ürün geçmişi"].map((t) => (
                <div key={t} className="rounded-md border border-[rgba(120,80,50,0.4)] bg-[#0d0b0a]/85 px-3 py-2.5">
                  <div className="text-[11px] text-[#bdb4a6]">{t}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="scene s2">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ ilk düşünce</div>
            <h2 className="mt-6 text-[clamp(36px,5vw,72px)] font-light leading-[1.15] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">"</span>
              Bu ekibi, bu müşterileri<br />
              <span className="grad-text font-medium">nasıl tanıyacağım</span>?
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-10 text-base text-[#7a7166]">Eski müdür ayrıldı. Bilgi onun kafasıydı. <span className="text-[#ddd8d0]">Şimdi yok.</span></p>
          </div>
        </div>
      </section>

      <section className="scene s3">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">altaris · kurum hafızası açılıyor</div>
            <div className="rounded-md border border-[rgba(120,80,50,0.32)] bg-[#0d0b0a] p-6">
              <p className="text-base text-[#ddd8d0]">
                <span className="text-[#f08c50]">▸</span> Bu ekibin son 3 yılını özetle
              </p>
              <div className="mt-4 text-[11px] uppercase tracking-[0.22em] text-[#7a7166]">
                e-posta · toplantı notları · sözleşmeler · proje raporları · çatışma kayıtları
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-6 text-[11px] uppercase tracking-[0.32em] text-[#9bd07e]">/ 3 yıl · özet brief</div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  num: "01",
                  metric: "Önemli karar",
                  title: "2024 — Q3 portföy daralması",
                  detail: "5 müşteri bırakıldı, 2 büyük müşteriye konsolide. Margin %32 → %46.",
                },
                {
                  num: "02",
                  metric: "Ekip dinamiği",
                  title: "2 senior tartışmalı",
                  detail: "Aylin · Mehmet uzun süredir sürtüşmeli. Roller dağıtılırken dikkat.",
                },
                {
                  num: "03",
                  metric: "Müşteri patternı",
                  title: "Acme — Q4 her yıl şikayet",
                  detail: "3 yıldır kasım ayında teslim sıkıntısı. Erken planlama gerek.",
                },
              ].map((r) => (
                <div key={r.num} className="rounded-md border border-[rgba(255,180,100,0.4)] bg-[#0d0b0a] p-4">
                  <div className="flex items-start justify-between">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-[#ffb464]">/{r.num}</div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">{r.metric}</div>
                  </div>
                  <h4 className="mt-3 text-base font-medium text-[#ddd8d0]">{r.title}</h4>
                  <p className="mt-2 text-[12px] leading-relaxed text-[#bdb4a6]">{r.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="scene s5">
        <div className="stage">
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ klasik onboarding</div>
            <div className="mt-6 flex items-center justify-center gap-8">
              <div className="text-[clamp(56px,8vw,128px)] font-light leading-none text-[#7a7166] line-through decoration-[#7a7166]/40">3 hafta</div>
              <div className="text-[#f08c50]">→</div>
              <div className="text-[clamp(72px,11vw,160px)] font-light leading-none">
                <span className="grad-text font-medium">30 dk</span>
              </div>
            </div>
            <p className="mt-8 text-base text-[#bdb4a6]">İlk gün öğleden önce <span className="text-[#ddd8d0]">ekibi tanımış</span> oluyorsunuz.</p>
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
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">superagent — kurum hafızanız hep yanınızda</div>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#f08c50] bg-[#f08c50] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ onboarding</span>
              <span className="font-medium">demo · innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-04-ilk-gun" label="senaryo 04 · ilk gün" />
    </SenaryoStage>
  );
}
