"use client";

// ─────────────────────────────────────────────────────────────────
// Senaryo 07 — "Sessiz Çıkış"
// İK direktörü, talent retention. SuperAgent davranış sinyalleri.
// Mood: Human, soft piano, gentle alert. A minor (introspective).
// ─────────────────────────────────────────────────────────────────

import { SenaryoPlayer, type ScheduleFn } from "../_lib/SenaryoPlayer";
import { SenaryoStage } from "../_lib/SenaryoStage";
import { bell, heartbeat, lfo, masterEnv, NOTES, pad } from "../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0,3],[3,3],[6,3],[9,6],[15,3],[18,4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.46, totalDur: TOTAL });

  // Pad: A minor (A + C + E) — introspective
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.A2, NOTES.E3, NOTES.A3], [
    [0, 0], [2, 0.024], [9, 0.020], [14, 0.022], [17, 0.026], [21.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.16, 0.006, TOTAL, t0);

  // Soft slow heartbeat
  [1.5, 4.0, 6.5, 9.0, 11.5, 14.0, 17.0, 20.0].forEach((t, i) => {
    heartbeat(ctx, master, t0 + t, [3, 6].includes(i) ? 0.24 : 0.16);
  });

  // Piano-like bell hits — soft, contemplative
  bell(ctx, master, t0 + 0.4, NOTES.A4, 0.10, 1.8);     // intro
  bell(ctx, master, t0 + 6.2, NOTES.E5, 0.10, 1.6);
  bell(ctx, master, t0 + 9.05, NOTES.C5, 0.13, 1.6);    // analiz başla
  // 2 risk yumuşak vurgu (2 kişi)
  bell(ctx, master, t0 + 10.5, NOTES.A4, 0.09, 1.4);
  bell(ctx, master, t0 + 12.5, NOTES.E5, 0.09, 1.4);
  // Reveal — A minor pentatonic ascending
  [NOTES.A4, NOTES.C5, NOTES.E5, NOTES.A5].forEach((f, i) => bell(ctx, master, t0 + 15.4 + i*0.18, f, 0.09, 1.0));
  // A-minor-to-A-major theme: A C# E A (resolved)
  [NOTES.A4, NOTES["C#4"]*2, NOTES.E5, NOTES.A5].forEach((f, i) => bell(ctx, master, t0 + 18.2 + i*0.26, f, 0.13, 1.7));
};

export default function Senaryo7Page() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus teknoloji · senaryo 07 · sessiz çıkış"
      timeline={["i̇k masası", "soru", "altaris", "2 sinyal", "süre", "müdahale"]}
      accentColors={{ from: "#a8c8b0", via: "#7fa890", to: "#5a8770" }}
    >
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ ı̇k direktörü · pazartesi sabahı</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
              En değerli kişiler<br />
              <span className="text-[#7a7166]">Sessizce ayrılır.</span>
            </h1>
            <p className="mt-12 max-w-xl text-sm leading-relaxed text-[#9b9285]">
              Performans değerlendirmeleri normal. Maaş skalası rekabetçi. Ama bazı sinyaller var —
              <span className="text-[#ddd8d0]">e-posta tonunda, izin sıklığında, toplantılardan kaçınmada</span>.
              Onları tek tek görmek imkansız.
            </p>
          </div>
        </div>
      </section>

      <section className="scene s2">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <h2 className="text-[clamp(36px,5.5vw,80px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">"</span>
              Hangi <span className="grad-text font-medium">key talent</span>'i<br />
              kaybediyorum?
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-10 text-base text-[#7a7166]">İstifa mektubu gelmeden önce — <span className="text-[#ddd8d0]">söyleyin</span>.</p>
          </div>
        </div>
      </section>

      <section className="scene s3">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">altaris · davranış pattern analizi</div>
            <div className="rounded-md border border-[rgba(120,80,50,0.32)] bg-[#0d0b0a] p-6">
              <p className="text-base text-[#ddd8d0]">
                <span className="text-[#f08c50]">▸</span> 12 ay · 47 kişi · 8 davranış sinyali
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">
                <span>e-posta tonu</span>
                <span>izin sıklığı</span>
                <span>toplantı katılımı</span>
                <span>proje commit'leri</span>
                <span>eğitime başvuru</span>
                <span>iletişim ağı</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-6 text-[11px] uppercase tracking-[0.32em] text-[#a8c8b0]">/ 2 kişi · yüksek çıkış riski</div>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                {
                  initials: "M.K.",
                  role: "Senior Software Engineer · 6 yıl",
                  score: "%78",
                  signals: [
                    "Son 3 ayda izin × 2.4 (önceki yıl ortalama)",
                    "Ekip toplantılarına katılım %62 → %18",
                    "Pull request hızı %40 düşüş",
                    "1:1 sıklığı azalma",
                  ],
                },
                {
                  initials: "S.A.",
                  role: "Product Manager · 4 yıl",
                  score: "%64",
                  signals: [
                    "E-posta tonunda formelleşme (NLP analizi)",
                    "Yeni projelere isteksizlik",
                    "LinkedIn aktivitesi pasiften aktife",
                    "Öğle yemeği ekipsiz",
                  ],
                },
              ].map((p) => (
                <div key={p.initials} className="rounded-md border border-[rgba(168,200,176,0.4)] bg-[#0d0b0a] p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-2xl font-light text-[#ddd8d0]">{p.initials}</div>
                      <div className="mt-1 text-xs text-[#9b9285]">{p.role}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8c8b0]">çıkış riski</div>
                      <div className="text-2xl font-light text-[#ffa0a0]">{p.score}</div>
                    </div>
                  </div>
                  <ul className="mt-4 space-y-1.5 text-[12px] text-[#bdb4a6]">
                    {p.signals.map((s) => (
                      <li key={s} className="flex items-start gap-2">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#a8c8b0]" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="scene s5">
        <div className="stage">
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ klasik · istifa mektubu geldikten sonra</div>
            <h2 className="mt-8 text-[clamp(40px,6vw,80px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              <span className="text-[#7a7166]">çok geç</span> →
              <span className="grad-text font-medium"> 4 hafta önce</span>
            </h2>
            <p className="mt-8 text-base text-[#bdb4a6]">Şimdi konuşma vakti — <span className="text-[#ddd8d0]">sessizce gitmeden</span>.</p>
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
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">superagent — kaybetmeden önce fark edin</div>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#f08c50] bg-[#f08c50] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ ı̇k retention</span>
              <span className="font-medium">demo · innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-07-cikis" label="senaryo 07 · sessiz çıkış" />
    </SenaryoStage>
  );
}
