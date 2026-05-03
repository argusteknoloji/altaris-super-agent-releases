"use client";

// ─────────────────────────────────────────────────────────────────
// Senaryo 09 — "5 Milyon Dolar"
// Yatırım kararı simülasyonu. Hafta sonu, tek başına.
// Mood: Cinematic trailer, big swell, dramatic resolve.
// ─────────────────────────────────────────────────────────────────

import { SenaryoPlayer, type ScheduleFn } from "../_lib/SenaryoPlayer";
import { SenaryoStage } from "../_lib/SenaryoStage";
import { bell, heartbeat, masterEnv, NOTES, pad, sweep } from "../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0,3],[3,3],[6,3],[9,6],[15,3],[18,4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.55, totalDur: TOTAL });

  // Pad: G minor → G major (cinematic build)
  pad(ctx, master, t0, TOTAL, [NOTES.G4/2, NOTES.D4, NOTES.G4], [
    [0, 0], [2, 0.026], [9, 0.024], [13, 0.030], [17, 0.040], [20, 0.024], [21.6, 0],
  ]);

  // Building heartbeat — slow → fast → slow
  const hbTimes: Array<[number, number]> = [
    [0.5, 0.18], [2.5, 0.20], [4.0, 0.22], [5.5, 0.22], [7.0, 0.24], [8.0, 0.26],
    [9.0, 0.36],
    [10.5, 0.22], [11.8, 0.22], [13.0, 0.22], [14.0, 0.24],
    [15.2, 0.30], [16.4, 0.22],
    [17.8, 0.40],
    [20.0, 0.20],
  ];
  hbTimes.forEach(([t, p]) => heartbeat(ctx, master, t0 + t, p));

  // Cinematic sweep at scene 3→4
  sweep(ctx, master, t0 + 6.5, 2.6, 200, 2000, 0.12, 4);

  // Major bell hits at key moments
  bell(ctx, master, t0 + 0.3, NOTES.G4, 0.10, 1.6);
  bell(ctx, master, t0 + 6.2, NOTES.D5, 0.13, 1.8);
  bell(ctx, master, t0 + 9.05, NOTES.G5, 0.18, 2.2);   // BIG hit
  bell(ctx, master, t0 + 9.05, NOTES.D5, 0.10, 2.0);
  // Senaryo 1, 2, 3
  [9.5, 11.0, 12.5].forEach((t, i) => bell(ctx, master, t0 + t, [NOTES.G4, NOTES["F#4"], NOTES.D5][i], 0.10, 1.4));
  // Reveal — heroic
  [NOTES.G4, NOTES.B3, NOTES.D5, NOTES.G5].forEach((f, i) => bell(ctx, master, t0 + 15.4 + i*0.18, f, 0.11, 1.0));
  // G-major theme: G B D G (heroic)
  [NOTES.G4, NOTES.B3, NOTES.D5, NOTES.G5].forEach((f, i) => bell(ctx, master, t0 + 18.2 + i*0.26, f, 0.16, 1.7));
};

export default function Senaryo9Page() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus teknoloji · senaryo 09 · 5 milyon dolar"
      timeline={["pazar", "soru", "simülasyon", "3 senaryo", "öneri", "karar"]}
    >
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ pazar gecesi · yönetim kuruluna 36 saat</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
              Tek başına.<br />
              <span className="text-[#7a7166]">5 milyon dolar.</span>
            </h1>
            <div className="mt-12 max-w-xl">
              <div className="rounded-md border border-[rgba(120,80,50,0.4)] bg-[#0d0b0a]/85 p-5">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#f08c50]/70">teklif</div>
                <p className="mt-2 text-base text-[#ddd8d0]">Yeni hat yatırımı · 5M USD · 18 ay geri dönüş öngörüsü</p>
                <p className="mt-2 text-xs text-[#9b9285]">Pazartesi sabah 09:00 — kurul kararı bekleniyor.</p>
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
              Gitsek <span className="grad-text font-medium">ne olur</span>?<br />
              Gitmesek <span className="grad-text font-medium">ne olur</span>?
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-10 text-base text-[#7a7166]">5 yıllık projection — <span className="text-[#ddd8d0]">tahmin etmek zor</span>.</p>
          </div>
        </div>
      </section>

      <section className="scene s3">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">altaris · 60 ay simülasyon</div>
            <div className="rounded-md border border-[rgba(120,80,50,0.32)] bg-[#0d0b0a] p-6">
              <p className="text-base text-[#ddd8d0]">
                <span className="text-[#f08c50]">▸</span> Pazar dinamikleri · döviz · enflasyon · talep eğrisi · finansman maliyeti
              </p>
              <div className="mt-4 text-[11px] uppercase tracking-[0.22em] text-[#7a7166]">monte carlo · 10.000 iterasyon</div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-6 text-[11px] uppercase tracking-[0.32em] text-[#9bd07e]">/ 3 senaryo · 5 yıllık projection</div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  tag: "yatırım yap",
                  delta: "+12.4M",
                  irr: "%21.4",
                  payback: "26 ay",
                  detail: "Yeni hat 18 ay payback hedef, gerçek 26 ay. IRR pazar ortalamasının üzerinde.",
                },
                {
                  tag: "yatırım yapma",
                  delta: "−4.8M",
                  irr: "—",
                  payback: "—",
                  detail: "Mevcut hatla pazar payı %12 → %7.5. Rakip yatırım yapacak. Geri dönüş yok.",
                  warn: true,
                },
                {
                  tag: "kademeli (yarım yatırım)",
                  delta: "+5.2M",
                  irr: "%14.8",
                  payback: "32 ay",
                  detail: "2.5M ile başla, 12 ayda gözle ölç, gerekirse ek 2.5M. Risk düşer, getiri azalır.",
                  best: true,
                },
              ].map((s) => (
                <div key={s.tag} className={`relative rounded-md border bg-[#0d0b0a] p-4 ${s.best ? "border-[#f08c50] shadow-[0_0_0_1px_rgba(240,140,80,0.18)]" : s.warn ? "border-[rgba(255,160,160,0.4)]" : "border-[rgba(120,80,50,0.32)]"}`}>
                  {s.best && <div className="absolute -top-2.5 left-3 rounded-full bg-[#f08c50] px-2.5 py-0.5 text-[9px] uppercase tracking-[0.22em] text-[#0a0908]">★ önerilen</div>}
                  <div className="text-[10px] uppercase tracking-[0.28em] text-[#bdb4a6]">{s.tag}</div>
                  <div className={`mt-3 text-3xl font-light ${s.warn ? "text-[#ffa0a0]" : "text-[#ffb464]"}`}>{s.delta}</div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">
                    <span>irr: <span className="text-[#ddd8d0]">{s.irr}</span></span>
                    <span>geri: <span className="text-[#ddd8d0]">{s.payback}</span></span>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-[#9b9285]">{s.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="scene s5">
        <div className="stage">
          <div className="text-center max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ veri konuşur · karar sizde</div>
            <h2 className="mt-8 text-[clamp(36px,5vw,72px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              Pazartesi 09:00<br />
              <span className="grad-text font-medium">veriyle savunulan karar</span>
            </h2>
            <p className="mt-8 text-base text-[#bdb4a6]">Sezgi değil. Korku değil. <span className="text-[#ddd8d0]">10.000 iterasyonun ortalaması</span>.</p>
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
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">superagent — büyük kararlara veri zırhı</div>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#f08c50] bg-[#f08c50] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ yatırım simülasyonu</span>
              <span className="font-medium">demo · innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-09-yatirim" label="senaryo 09 · 5 milyon dolar" />
    </SenaryoStage>
  );
}
