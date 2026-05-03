"use client";

// ─────────────────────────────────────────────────────────────────
// Senaryo 11 — "Yeşil Sınır"
// Üretim direktörü, CBAM (AB Karbon Sınır Düzenlemesi) yaklaşıyor.
// NEXUS Platform · Carbon-Labs ortak çözümü → Scope 1/2/3 + su
// ayak izi + green premium fırsatı.
// Mood: Organic, sustainable, E-major key, water-flow noise.
// ─────────────────────────────────────────────────────────────────

import { SenaryoPlayer, type ScheduleFn } from "../_lib/SenaryoPlayer";
import { SenaryoStage } from "../_lib/SenaryoStage";
import { bell, gain, heartbeat, lfo, masterEnv, NOTES, osc, pad, sweep } from "../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0,3],[3,3],[6,3],[9,6],[15,3],[18,4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });

  // E-major pad (E + B + G#) — warm, hopeful, nature-aligned
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.E3, NOTES.B3, NOTES.E4], [
    [0, 0], [2, 0.024], [9, 0.022], [14, 0.026], [17, 0.034], [20, 0.022], [21.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.18, 0.006, TOTAL, t0);

  // ── Su akışı: lowpass-swept filtered noise (organic background) ──
  const wbuf = ctx.createBuffer(1, ctx.sampleRate * (TOTAL + 0.3), ctx.sampleRate);
  const wd = wbuf.getChannelData(0);
  for (let i = 0; i < wd.length; i++) wd[i] = (Math.random() * 2 - 1) * 0.4;
  const wsrc = ctx.createBufferSource();
  wsrc.buffer = wbuf;
  const wf = ctx.createBiquadFilter();
  wf.type = "lowpass";
  wf.frequency.value = 600;
  wf.Q.value = 1.2;
  const wg = gain(ctx, 0);
  wsrc.connect(wf).connect(wg).connect(master);
  wg.gain.setValueAtTime(0, t0);
  wg.gain.linearRampToValueAtTime(0.022, t0 + 2);
  wg.gain.linearRampToValueAtTime(0.018, t0 + 9);
  wg.gain.linearRampToValueAtTime(0.026, t0 + 17);
  wg.gain.linearRampToValueAtTime(0, t0 + 21.5);
  wsrc.start(t0);
  wsrc.stop(t0 + TOTAL + 0.2);
  // Subtle filter sweep on the "water"
  wf.frequency.setValueAtTime(500, t0);
  wf.frequency.linearRampToValueAtTime(900, t0 + 9);
  wf.frequency.linearRampToValueAtTime(1400, t0 + 17);

  // Slow organic heartbeat
  [1.5, 4.5, 7.5, 9.0, 12.0, 15.0, 18.0, 20.5].forEach((t, i) => {
    heartbeat(ctx, master, t0 + t, [3, 6].includes(i) ? 0.30 : 0.18);
  });

  // Bells — natural, soft
  bell(ctx, master, t0 + 0.4, NOTES.E5, 0.10, 1.8);
  bell(ctx, master, t0 + 6.2, NOTES.B3, 0.10, 1.6);
  bell(ctx, master, t0 + 9.05, NOTES.E5, 0.13, 1.8);

  // Scope 1 / 2 / 3 — three pop's
  bell(ctx, master, t0 + 9.5,  NOTES.E4, 0.085, 1.2);
  bell(ctx, master, t0 + 11.0, NOTES.G4, 0.085, 1.2);  // G# minor → G major hint
  bell(ctx, master, t0 + 12.5, NOTES.B3 * 2, 0.085, 1.2);

  // Reveal — major arpej (E pentatonic)
  [NOTES.E4, NOTES["F#4"], NOTES.B3 * 2, NOTES.E5].forEach((f, i) => {
    bell(ctx, master, t0 + 15.4 + i * 0.18, f, 0.10, 1.0);
  });

  // E-major theme: E G# B E (warm resolved)
  [NOTES.E4, NOTES["F#4"] + 30, NOTES.B3 * 2, NOTES.E5].forEach((f, i) => {
    bell(ctx, master, t0 + 18.2 + i * 0.26, f, 0.13, 1.7);
  });

  // Sustain pad final note
  const finalOsc = osc(ctx, NOTES.E3, "sine");
  const finalG = gain(ctx, 0);
  finalOsc.connect(finalG).connect(master);
  finalG.gain.setValueAtTime(0, t0 + 18);
  finalG.gain.linearRampToValueAtTime(0.05, t0 + 18.4);
  finalG.gain.linearRampToValueAtTime(0.04, t0 + 21);
  finalG.gain.exponentialRampToValueAtTime(0.0001, t0 + 22);
  finalOsc.start(t0 + 18);
  finalOsc.stop(t0 + 22.1);
};

export default function Senaryo11Page() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus + carbon-labs · senaryo 11 · yeşil sınır"
      timeline={["cbam", "soru", "nexus", "scope 1·2·3", "premium", "ihracat"]}
      accentColors={{ from: "#a8d895", via: "#6fb573", to: "#3a8060" }}
    >
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ üretim direktörü · 2026 q4</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
              CBAM yürürlükte.<br />
              <span className="text-[#7a7166]">Avrupa karbon sınırı.</span>
            </h1>
            <div className="mt-12 grid grid-cols-2 gap-4 max-w-xl">
              <div className="rounded-md border border-[rgba(168,216,149,0.45)] bg-[#0d0e0a]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8d895]">avrupa pazarı</div>
                <div className="mt-1 text-sm text-[#ddd8d0]">İhracatımızın %38'i AB</div>
              </div>
              <div className="rounded-md border border-[rgba(168,216,149,0.45)] bg-[#0d0e0a]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8d895]">karbon vergisi</div>
                <div className="mt-1 text-sm text-[#ddd8d0]">Ton başına €85+ artıyor</div>
              </div>
            </div>
            <p className="mt-8 max-w-xl text-sm leading-relaxed text-[#9b9285]">
              Karbon ayak izimiz · su tüketimimiz · enerji yoğunluğumuz —
              <span className="text-[#ddd8d0]"> hepsi farklı raporlarda, hepsi geç</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="scene s2">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <h2 className="text-[clamp(32px,5vw,72px)] font-light leading-[1.15] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">"</span>
              Bu yıl ne kadar karbon ürettik?<br />
              <span className="grad-text font-medium">AB ihracatına etkisi nedir</span>?
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-10 text-base text-[#7a7166]">
              Scope 1, 2, 3 · enerji · lojistik · tedarik zinciri · su ayak izi —
              <span className="text-[#ddd8d0]"> tek tabloda görmek imkansız</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="scene s3">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">
              <span aria-hidden className="size-1.5 rounded-full bg-[#a8d895] animate-pulse" />
              <span>nexus platform · carbon-labs</span>
              <span className="text-[#3a342d]">·</span>
              <span>green data layer</span>
            </div>
            <div className="rounded-md border border-[rgba(168,216,149,0.5)] bg-[#0d0e0a] p-6">
              <p className="text-base text-[#ddd8d0]">
                <span className="text-[#a8d895]">▸</span> Tesis verisi · ERP · IoT enerji sayaçları · lojistik
                · su kullanım panosu · tedarikçi karbon raporları
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">
                <span>scope 1 — direkt</span>
                <span>scope 2 — enerji</span>
                <span>scope 3 — değer zinciri</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-6 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#a8d895]">/ karbon + su · tek tabloda</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">2026 q1-q3 birikimli</div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  num: "01",
                  label: "Scope 1 · direkt emisyon",
                  metric: "12.4 kt CO₂e",
                  detail: "Doğal gaz · proses ısıtma · saha taşıt filosu. %18 azalma kaydı (önceki yıl).",
                  src: ["IoT", "ERP", "Filo"],
                },
                {
                  num: "02",
                  label: "Scope 2 · satın alınan enerji",
                  metric: "8.7 kt CO₂e",
                  detail: "Şebeke elektriği. Yenilenebilir oranı %22. Solar PPA imkanı %14 ek azalma.",
                  src: ["EPDK", "Sayaç", "PPA"],
                },
                {
                  num: "03",
                  label: "Scope 3 · değer zinciri",
                  metric: "31.8 kt CO₂e",
                  detail: "Tedarikçi · lojistik · ürün kullanımı · son ürün bertarafı. En büyük payı tedarikçiler taşıyor.",
                  src: ["Tedarikçi", "Lojistik", "LCA"],
                },
              ].map((r) => (
                <div key={r.num} className="relative rounded-md border border-[rgba(168,216,149,0.45)] bg-[#0d0e0a] p-4">
                  <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-[#a8d895]" />
                  <div className="flex items-start justify-between">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-[#a8d895]">/{r.num}</div>
                    <div className="text-base font-medium text-[#a8d895]">{r.metric}</div>
                  </div>
                  <h4 className="mt-3 text-base font-medium text-[#ddd8d0]">{r.label}</h4>
                  <p className="mt-2 text-[12px] leading-relaxed text-[#bdb4a6]">{r.detail}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[rgba(120,80,50,0.25)] pt-2">
                    {r.src.map((s) => (
                      <span key={s} className="rounded-sm border border-[rgba(168,216,149,0.4)] bg-[#0d1209] px-2 py-0.5 text-[9px] uppercase tracking-[0.22em] text-[#9b9285]">{s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-[rgba(168,216,149,0.45)] bg-[#0d0e0a] p-4">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#a8d895]">su ayak ı̇zi</div>
                <div className="mt-2 text-2xl font-light text-[#ddd8d0]">2.34M m³</div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#bdb4a6]">Tatlı su · proses · soğutma · temizlik. Geri kazanım potansiyeli %31.</p>
              </div>
              <div className="rounded-md border border-[rgba(168,216,149,0.45)] bg-[#0d0e0a] p-4">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#a8d895]">cbam etkisi</div>
                <div className="mt-2 text-2xl font-light text-[#ddd8d0]">€2.7M / yıl</div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#bdb4a6]">Mevcut karbon verimliliğiyle AB ihracatına ek karbon vergisi.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s5">
        <div className="stage">
          <div className="text-center max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ vergi yerine prim · referans: bagfas €7.2m green premium</div>
            <h2 className="mt-8 text-[clamp(36px,5.5vw,80px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              <span className="text-[#7a7166]">Karbon yükü</span> →
              <span className="grad-text font-medium"> yeşil prim</span>
            </h2>
            <p className="mt-8 text-base text-[#bdb4a6]">
              Doğru ölçüm + sertifika = AB pazarında <span className="text-[#ddd8d0]">€/ton avantajı</span>.
              <br />Karbon datayla yönetilir, sezgiyle değil.
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
            <div className="mt-3 text-[11px] uppercase tracking-[0.32em] text-[#a8d895]">
              + nexus platform · carbon-labs ortaklığı
            </div>
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">
              karbon · su · enerji — ölçülemeyen yönetilemez
            </div>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#a8d895] bg-[#a8d895] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ green data</span>
              <span className="font-medium">demo · innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-11-yesil-sinir" label="senaryo 11 · yeşil sınır" />
    </SenaryoStage>
  );
}
