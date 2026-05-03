"use client";

// ─────────────────────────────────────────────────────────────────
// Senaryo 12 — "Akşam Vardiyası" (Sağlık)
// Acil servis başhekimi, vardiya değişimi · 19:42.
// Üç hasta beklemede, geçmiş veriler beş ayrı sistemde.
// Altaris klinik karar destek: TC kimlik → tek özet kart.
// Mood: warm clinical, A minor + soft major resolve, gentle pulse.
// Accent: teal #5fa8a0 (sterilite + yaşam)
// ─────────────────────────────────────────────────────────────────

import { SenaryoPlayer, type ScheduleFn } from "../_lib/SenaryoPlayer";
import { SenaryoStage } from "../_lib/SenaryoStage";
import { bell, gain, heartbeat, lfo, masterEnv, NOTES, osc, pad } from "../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0,3],[3,3],[6,3],[9,6],[15,3],[18,4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });

  // A minor pad (A + C + E) — soft, vigilant, hopeful undertone
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.A3 ?? 220, NOTES.C4 ?? 261.6, NOTES.E4 ?? 329.6], [
    [0, 0], [2, 0.024], [9, 0.022], [14, 0.028], [17, 0.034], [20, 0.022], [21.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.22, 0.005, TOTAL, t0);

  // Steady clinical heartbeat — 1.6sn aralık (calm but alert)
  [1.4, 3.0, 4.6, 6.2, 7.8, 9.4, 11.0, 12.6, 14.2, 15.8, 17.4, 19.0, 20.5].forEach((t, i) => {
    heartbeat(ctx, master, t0 + t, i % 4 === 0 ? 0.26 : 0.16);
  });

  // Soft monitor "beep" cluster on scene 1 entry
  bell(ctx, master, t0 + 0.4, NOTES.A4 ?? 440, 0.10, 1.5);
  bell(ctx, master, t0 + 0.7, NOTES.E4 ?? 329.6, 0.08, 1.2);

  // Sahne 2 — soru: minor 6th interval
  bell(ctx, master, t0 + 3.2, NOTES.E4 ?? 329.6, 0.10, 1.4);
  bell(ctx, master, t0 + 4.5, NOTES.C4 ?? 261.6, 0.08, 1.2);

  // Sahne 3 — terminal: typing tick
  [6.2, 6.5, 6.9, 7.3, 7.7].forEach((t) => {
    bell(ctx, master, t0 + t, (NOTES.A5 ?? 880) + Math.random() * 30, 0.05, 0.5);
  });
  bell(ctx, master, t0 + 8.6, NOTES.E5 ?? 659, 0.10, 1.4);

  // Sahne 4 — cevap: 4-card reveal (ascending A minor pentatonic)
  [
    [9.5, NOTES.A3 ?? 220],
    [10.5, NOTES.C4 ?? 261.6],
    [11.5, NOTES.E4 ?? 329.6],
    [12.5, NOTES.A4 ?? 440],
  ].forEach(([t, f]) => {
    bell(ctx, master, t0 + (t as number), f as number, 0.10, 1.3);
  });
  // Alarm-like accent for "alerji uyarısı"
  bell(ctx, master, t0 + 13.3, NOTES.E5 ?? 659, 0.13, 1.6);

  // Sahne 5 — kanıt: stopwatch tick + resolve
  [15.0, 15.4, 15.8, 16.2].forEach((t) => {
    bell(ctx, master, t0 + t, NOTES.A5 ?? 880, 0.06, 0.5);
  });

  // Sahne 6 — CTA: A minor → A major resolve (hopeful)
  [NOTES.A3 ?? 220, NOTES["C#4"] ?? 277, NOTES.E4 ?? 329.6, NOTES.A4 ?? 440].forEach((f, i) => {
    bell(ctx, master, t0 + 18.2 + i * 0.26, f, 0.13, 1.7);
  });

  // Sustain final note
  const finalOsc = osc(ctx, NOTES.A3 ?? 220, "sine");
  const finalG = gain(ctx, 0);
  finalOsc.connect(finalG).connect(master);
  finalG.gain.setValueAtTime(0, t0 + 18);
  finalG.gain.linearRampToValueAtTime(0.05, t0 + 18.4);
  finalG.gain.linearRampToValueAtTime(0.04, t0 + 21);
  finalG.gain.exponentialRampToValueAtTime(0.0001, t0 + 22);
  finalOsc.start(t0 + 18);
  finalOsc.stop(t0 + 22.1);
};

export default function Senaryo12Page() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus + altaris health · senaryo 12 · akşam vardiyası"
      timeline={["devir", "soru", "altaris", "özet kart", "süre", "klinik destek"]}
      accentColors={{ from: "#9fd8d0", via: "#5fa8a0", to: "#3a7068" }}
    >
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ acil servis · başhekim · 19:42</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
              Vardiya devri.<br />
              <span className="text-[#7a7166]">Üç hasta beklemede.</span>
            </h1>
            <div className="mt-12 grid grid-cols-3 gap-3 max-w-2xl">
              <div className="rounded-md border border-[rgba(159,216,208,0.45)] bg-[#0d0e0f]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#9fd8d0]">yatak 04</div>
                <div className="mt-1 text-[12px] text-[#ddd8d0]">62 / E · göğüs ağrısı</div>
              </div>
              <div className="rounded-md border border-[rgba(159,216,208,0.45)] bg-[#0d0e0f]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#9fd8d0]">yatak 07</div>
                <div className="mt-1 text-[12px] text-[#ddd8d0]">38 / K · alerjik reaksiyon</div>
              </div>
              <div className="rounded-md border border-[rgba(159,216,208,0.45)] bg-[#0d0e0f]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#9fd8d0]">yatak 11</div>
                <div className="mt-1 text-[12px] text-[#ddd8d0]">71 / E · senkop</div>
              </div>
            </div>
            <p className="mt-8 max-w-xl text-sm leading-relaxed text-[#9b9285]">
              HBYS · LIS · PACS · eczane sistemi · poliklinik kayıtları —
              <span className="text-[#ddd8d0]"> beş ekran, her biri ayrı pencere</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="scene s2">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <h2 className="text-[clamp(32px,5vw,72px)] font-light leading-[1.15] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">"</span>
              Bu hastanın geçmişi, alerjisi,<br />
              <span className="grad-text font-medium">ilaç etkileşimi</span> ne?
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-10 text-base text-[#7a7166]">
              Geçmiş yatış · kronik tanı · alerji listesi · aktif reçete · son tetkik —
              <span className="text-[#ddd8d0]"> üç dakikada toparlanması zor</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="scene s3">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">
              <span aria-hidden className="size-1.5 rounded-full bg-[#9fd8d0] animate-pulse" />
              <span>altaris · klinik karar destek</span>
              <span className="text-[#3a342d]">·</span>
              <span>HBYS köprülü</span>
            </div>
            <div className="rounded-md border border-[rgba(159,216,208,0.5)] bg-[#0d0e0f] p-6">
              <p className="text-base text-[#ddd8d0] font-mono">
                <span className="text-[#9fd8d0]">▸</span> altaris hasta-özet
                <span className="text-[#7a7166]"> --tckn=</span>
                <span className="text-[#ddd8d0]">●●●●●●●●●●●</span>
                <span className="text-[#7a7166]"> --akut</span>
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">
                <span>geçmiş 5 yıl</span>
                <span>alerji + etkileşim</span>
                <span>aktif reçete</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-6 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#9fd8d0]">/ hasta özeti · yatak 07 · alerjik reaksiyon</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">38 / K · 19:43</div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  num: "01",
                  label: "Tıbbi geçmiş",
                  metric: "3 yatış · 12 ay",
                  detail: "Astım kontrol altında · son atak 4 ay önce. Sezon polen alerjisi kayıtlı.",
                  src: ["HBYS", "Poliklinik", "ICD-10"],
                },
                {
                  num: "02",
                  label: "Alerji + etkileşim",
                  metric: "⚠ Penisilin",
                  detail: "Beta-laktam grubu kontrendike. Kayıtlı reaksiyon: anjiyoödem, 2024.",
                  src: ["Eczane", "Anamnez", "ADR raporu"],
                },
                {
                  num: "03",
                  label: "Aktif reçete",
                  metric: "Salbutamol · Setirizin",
                  detail: "Bronkodilatör ihtiyaç + antihistaminik. Yeni reçeteyle çakışma uyarısı yok.",
                  src: ["e-Reçete", "MEDULA", "İlaç DB"],
                },
              ].map((r) => (
                <div key={r.num} className="relative rounded-md border border-[rgba(159,216,208,0.45)] bg-[#0d0e0f] p-4">
                  <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-[#9fd8d0]" />
                  <div className="flex items-start justify-between">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-[#9fd8d0]">/{r.num}</div>
                    <div className="text-base font-medium text-[#9fd8d0]">{r.metric}</div>
                  </div>
                  <h4 className="mt-3 text-base font-medium text-[#ddd8d0]">{r.label}</h4>
                  <p className="mt-2 text-[12px] leading-relaxed text-[#bdb4a6]">{r.detail}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[rgba(120,80,50,0.25)] pt-2">
                    {r.src.map((s) => (
                      <span key={s} className="rounded-sm border border-[rgba(159,216,208,0.4)] bg-[#0d1414] px-2 py-0.5 text-[9px] uppercase tracking-[0.22em] text-[#9b9285]">{s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-[rgba(255,140,80,0.55)] bg-[#1a0d08] p-4">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#ffae6e]">⚠ klinik uyarı</div>
                <div className="mt-2 text-base font-medium text-[#ffae6e]">Penisilin · kontrendike</div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#ddd8d0]">Önerilen alternatif: makrolit veya sefalosporin (3. kuşak — çapraz reaksiyon riski %3-5).</p>
              </div>
              <div className="rounded-md border border-[rgba(159,216,208,0.45)] bg-[#0d0e0f] p-4">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#9fd8d0]">son tetkik</div>
                <div className="mt-2 text-2xl font-light text-[#ddd8d0]">CRP 12 · WBC 9.4</div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#bdb4a6]">2 saat önce alındı. Hafif inflamasyon, lökositoz sınırda — alerjik etyoloji ile uyumlu.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s5">
        <div className="stage">
          <div className="text-center max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ vardiya başhekiminin masasında</div>
            <h2 className="mt-8 text-[clamp(36px,5.5vw,80px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              <span className="text-[#7a7166]">Beş ekran</span> →
              <span className="grad-text font-medium"> on iki saniye</span>
            </h2>
            <p className="mt-8 text-base text-[#bdb4a6]">
              Veri kaynağı atlanmadı, alerji uyarısı kaçırılmadı.
              <br />Klinik karar — kanıta dayalı, dakikta değil saniyede.
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
            <div className="mt-3 text-[11px] uppercase tracking-[0.32em] text-[#9fd8d0]">
              + altaris health · klinik karar destek
            </div>
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">
              hasta verisi yerinde kalır · KVKK + sağlık veri güvenliği
            </div>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#9fd8d0] bg-[#9fd8d0] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ pilot</span>
              <span className="font-medium">demo · innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-12-aksam-vardiyasi" label="senaryo 12 · akşam vardiyası" />
    </SenaryoStage>
  );
}
