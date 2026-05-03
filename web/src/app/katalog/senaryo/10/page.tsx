"use client";

// ─────────────────────────────────────────────────────────────────
// Senaryo 10 — "Denetim Hazır"
// KVKK denetimi geliyor. Tam audit trail çıkartılır.
// Mood: Methodical, official, precise ticks.
// ─────────────────────────────────────────────────────────────────

import { SenaryoPlayer, type ScheduleFn } from "../_lib/SenaryoPlayer";
import { SenaryoStage } from "../_lib/SenaryoStage";
import { bell, gain, heartbeat, masterEnv, NOTES, osc, pad } from "../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0,3],[3,3],[6,3],[9,6],[15,3],[18,4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });

  // Pad: C major (clean, official)
  pad(ctx, master, t0, TOTAL, [NOTES.C5/2, NOTES.G4/2], [
    [0, 0], [2, 0.018], [9, 0.020], [14, 0.024], [17, 0.026], [21.6, 0],
  ]);

  // Methodical clock ticks — every 1 second, very precise
  for (let i = 0; i < 20; i++) {
    const at = t0 + i + 0.5;
    if (at > t0 + TOTAL - 1) break;
    const o = osc(ctx, 1500, "square");
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 1000;
    const g = gain(ctx, 0);
    o.connect(f).connect(g).connect(master);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.018, at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
    o.start(at);
    o.stop(at + 0.05);
  }

  // Soft heartbeat at scene transitions
  [3.0, 6.0, 9.0, 15.0, 18.0].forEach((t, i) => heartbeat(ctx, master, t0 + t, i === 2 || i === 4 ? 0.30 : 0.20));

  // Bells
  bell(ctx, master, t0 + 0.4, NOTES.C5, 0.10, 1.6);
  bell(ctx, master, t0 + 6.2, NOTES.E5, 0.12, 1.6);
  bell(ctx, master, t0 + 9.05, NOTES.G5, 0.14, 1.8);
  // 4 audit categories sequentially
  [9.5, 10.7, 11.9, 13.1].forEach((t, i) => bell(ctx, master, t0 + t, [NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C5*2][i], 0.085, 1.0));
  [NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C5*2].forEach((f, i) => bell(ctx, master, t0 + 15.4 + i*0.18, f, 0.10, 1.0));
  // C-major theme: C E G C
  [NOTES.C5/2, NOTES.E5/2, NOTES.G5/2, NOTES.C5].forEach((f, i) => bell(ctx, master, t0 + 18.2 + i*0.26, f, 0.13, 1.7));
};

export default function Senaryo10Page() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus teknoloji · senaryo 10 · denetim hazır"
      timeline={["denetçi", "soru", "altaris", "audit trail", "süre", "teslim"]}
      accentColors={{ from: "#c8d8ff", via: "#7a98d8", to: "#3a5ea0" }}
    >
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ kvkk denetçisi · pazartesi 10:00</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
              Denetim geldi.<br />
              <span className="text-[#7a7166]">Tüm kayıtlar istendi.</span>
            </h1>
            <p className="mt-12 max-w-xl text-sm leading-relaxed text-[#9b9285]">
              Geçen yıl boyunca <span className="text-[#ddd8d0]">her veri erişimi, her API çağrısı, her karar</span> —
              kim, ne zaman, hangi yetkiyle? KVKK denetçisi 24 saat içinde teslim bekliyor.
            </p>
          </div>
        </div>
      </section>

      <section className="scene s2">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <h2 className="text-[clamp(36px,5.5vw,80px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">"</span>
              Geçen yıl tüm<br />
              veri işlemleri — <span className="grad-text font-medium">tam izlenebilir mi?</span>
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-10 text-base text-[#7a7166]">365 gün · 8.4M API çağrısı · 47K kullanıcı oturumu — <span className="text-[#ddd8d0]">manuel imkansız</span>.</p>
          </div>
        </div>
      </section>

      <section className="scene s3">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">altaris · audit trail</div>
            <div className="rounded-md border border-[rgba(120,80,50,0.32)] bg-[#0d0b0a] p-6">
              <p className="text-base text-[#ddd8d0]">
                <span className="text-[#f08c50]">▸</span> 12 ay denetim raporu hazırlanıyor
              </p>
              <div className="mt-4 text-[11px] uppercase tracking-[0.22em] text-[#7a7166]">
                her api çağrısı · her veri erişimi · her rol değişikliği · her karar yetki kaydı
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-6 text-[11px] uppercase tracking-[0.32em] text-[#c8d8ff]">/ denetim raporu · 12 ay tam izlenebilir</div>
            <div className="grid gap-3">
              {[
                ["8.4M", "API çağrısı", "her biri zaman + kullanıcı + IP + sonuç"],
                ["47K", "kullanıcı oturumu", "her oturum için tam transcript + audit log"],
                ["1.247", "rol değişikliği", "kim, kim tarafından, ne zaman, hangi yetki"],
                ["234", "veri sahibi başvurusu", "30 gün yasal süre içinde teknik yanıt — %100"],
              ].map(([v, t, d]) => (
                <div key={t} className="grid grid-cols-[7rem_10rem_1fr] items-center gap-4 border-l-2 border-[#7a98d8] pl-4 py-1.5">
                  <span className="text-2xl font-light text-[#c8d8ff]">{v}</span>
                  <span className="text-[11px] uppercase tracking-[0.22em] text-[#9bb5d8]">{t}</span>
                  <span className="text-[12px] text-[#bdb4a6]">{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="scene s5">
        <div className="stage">
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ klasik · denetçiye hazırlık</div>
            <div className="mt-6 flex items-center justify-center gap-8">
              <div className="text-[clamp(56px,8vw,128px)] font-light leading-none text-[#7a7166] line-through decoration-[#7a7166]/40">3 hafta</div>
              <div className="text-[#f08c50]">→</div>
              <div className="text-[clamp(72px,11vw,160px)] font-light leading-none">
                <span className="grad-text font-medium">5 dk</span>
              </div>
            </div>
            <p className="mt-8 text-base text-[#bdb4a6]">Denetçiye <span className="text-[#ddd8d0]">tek dosya</span>. Hepsi imzalı, zaman damgalı, değişmez.</p>
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
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">superagent — kvkk · iso 27001 · denetime hazır</div>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#f08c50] bg-[#f08c50] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ audit ready</span>
              <span className="font-medium">demo · innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-10-denetim" label="senaryo 10 · denetim hazır" />
    </SenaryoStage>
  );
}
