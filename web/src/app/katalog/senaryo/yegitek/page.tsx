"use client";

// ─────────────────────────────────────────────────────────────────
// Senaryo 18 — "YEĞİTEK İçerik Pazartesi"
// İçerik Geliştirme ve Yönetimi Daire Başkanlığı · 5 koordinatörlük
// 5 use-case · ~51 sn · methodical-official.
// Accent: soft blue → deep navy #a8c0e8 → #5a78a8 → #2a3858
// ─────────────────────────────────────────────────────────────────

import { SenaryoPlayer, type ScheduleFn } from "../_lib/SenaryoPlayer";
import { SenaryoStage } from "../_lib/SenaryoStage";
import { bell, gain, heartbeat, lfo, masterEnv, NOTES, osc, pad } from "../_lib/audio";

const TOTAL = 51;
const SCENE_TIMINGS = [
  [0, 3],   // 1 açılış
  [3, 4],   // 2 üretim ölçeği
  [7, 3],   // 3 soru
  [10, 3],  // 4 altaris reveal
  [13, 5],  // 5 senaryo üretim asistanı
  [18, 5],  // 6 video anlatım
  [23, 5],  // 7 görsel & animasyon
  [28, 5],  // 8 sesli kitap
  [33, 5],  // 9 TTKB ön-denetim
  [38, 4],  // 10 egemenlik
  [42, 4],  // 11 sayısal vurgu
  [46, 5],  // 12 CTA
] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });

  // C major institutional pad — eğitim, vakar
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.C3, NOTES.G3, NOTES.C4, NOTES.E4], [
    [0, 0],
    [2, 0.020],
    [10, 0.024],
    [13, 0.026],
    [33, 0.028],
    [38, 0.032],
    [46, 0.030],
    [50.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.16, 0.005, TOTAL, t0);

  // Institutional heartbeat — 1.7sn aralık (boardroom calm + dignified)
  const beats: number[] = [];
  for (let t = 1.7; t < 46; t += 1.7) beats.push(t);
  beats.forEach((t, i) => {
    heartbeat(ctx, master, t0 + t, i % 4 === 0 ? 0.20 : 0.10);
  });

  // Sahne 1 — açılış: gentle scholar bell
  bell(ctx, master, t0 + 0.4, NOTES.E5, 0.10, 1.5);
  bell(ctx, master, t0 + 1.4, NOTES.G4, 0.08, 1.4);

  // Sahne 2 — üretim ölçeği: ascending bells (numbers reveal)
  [3.4, 4.0, 4.6, 5.2, 5.8].forEach((t, i) => {
    const notes = [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.C5, NOTES.E5];
    bell(ctx, master, t0 + t, notes[i], 0.09, 1.0);
  });

  // Sahne 3 — soru: descending C major (concern, methodical)
  bell(ctx, master, t0 + 7.3, NOTES.G4, 0.10, 1.5);
  bell(ctx, master, t0 + 8.1, NOTES.E4, 0.10, 1.5);
  bell(ctx, master, t0 + 8.9, NOTES.C4, 0.10, 1.6);

  // Sahne 4 — altaris reveal: rising arpeggio (D anchor)
  bell(ctx, master, t0 + 10.2, NOTES.D3, 0.13, 1.8);
  [10.7, 11.2, 11.7, 12.2].forEach((t, i) => {
    const notes = [NOTES.D4, NOTES["F#4"], NOTES.A4, NOTES.D5];
    bell(ctx, master, t0 + t, notes[i], 0.11, 1.4);
  });

  // Sahne 5 — senaryo üretim: typing-like quick bells
  for (let t = 13.3; t < 17.5; t += 0.42) {
    bell(ctx, master, t0 + t, NOTES.A5 + Math.random() * 80, 0.05, 0.5);
  }
  bell(ctx, master, t0 + 17.6, NOTES.E5, 0.09, 1.2);

  // Sahne 6 — video anlatım: voice-like swell (low tones, then resolve)
  bell(ctx, master, t0 + 18.3, NOTES.C4, 0.12, 1.6);
  bell(ctx, master, t0 + 19.5, NOTES.E4, 0.11, 1.6);
  bell(ctx, master, t0 + 20.7, NOTES.G4, 0.11, 1.6);
  bell(ctx, master, t0 + 21.9, NOTES.C5, 0.10, 1.5);

  // Sahne 7 — görsel: warm chord stacking (palette reveal)
  bell(ctx, master, t0 + 23.4, NOTES.E4, 0.10, 1.5);
  bell(ctx, master, t0 + 24.4, NOTES.G4, 0.10, 1.5);
  bell(ctx, master, t0 + 25.4, NOTES.C5, 0.10, 1.5);
  bell(ctx, master, t0 + 26.7, NOTES.E5, 0.11, 1.6);

  // Sahne 8 — sesli kitap: lyrical bell sequence (storytelling)
  [28.3, 29.0, 29.7, 30.4, 31.1, 31.8, 32.5].forEach((t, i) => {
    const notes = [NOTES.G4, NOTES.E5, NOTES.C5, NOTES.G4, NOTES.E5, NOTES.C5, NOTES.G4];
    bell(ctx, master, t0 + t, notes[i], 0.07, 1.1);
  });

  // Sahne 9 — TTKB denetim: methodical chord, weight (E minor → C major)
  bell(ctx, master, t0 + 33.3, NOTES.C3, 0.15, 1.8);
  bell(ctx, master, t0 + 34.5, NOTES.G3, 0.13, 1.7);
  bell(ctx, master, t0 + 35.8, NOTES.E4, 0.12, 1.6);
  bell(ctx, master, t0 + 37.1, NOTES.C5, 0.11, 1.4);

  // Sahne 10 — egemenlik: low warm sustain
  bell(ctx, master, t0 + 38.3, NOTES.C3, 0.16, 2.0);
  bell(ctx, master, t0 + 39.6, NOTES.G3, 0.13, 1.8);
  bell(ctx, master, t0 + 40.9, NOTES.C4, 0.12, 1.7);

  // Sahne 11 — sayısal vurgu: rapid metric pings
  [42.2, 42.6, 43.0, 43.4, 43.8, 44.2, 44.6, 45.0].forEach((t, i) => {
    bell(ctx, master, t0 + t, NOTES.C5 + i * 30, 0.06, 0.5);
  });
  bell(ctx, master, t0 + 45.5, NOTES.G5, 0.10, 1.2);

  // Sahne 12 — CTA: D-major pentatonic brand motif (FORTE)
  [NOTES.D4, NOTES["F#4"], NOTES.A4, NOTES.D5].forEach((f, i) => {
    bell(ctx, master, t0 + 46.2 + i * 0.34, f, 0.14, 1.9);
  });

  // Final D drone (brand sustain)
  const finalOsc = osc(ctx, NOTES.D3, "triangle");
  const finalG = gain(ctx, 0);
  finalOsc.connect(finalG).connect(master);
  finalG.gain.setValueAtTime(0, t0 + 46);
  finalG.gain.linearRampToValueAtTime(0.052, t0 + 46.6);
  finalG.gain.linearRampToValueAtTime(0.044, t0 + 50);
  finalG.gain.exponentialRampToValueAtTime(0.0001, t0 + 51);
  finalOsc.start(t0 + 46);
  finalOsc.stop(t0 + 51.1);
};

export default function SenaryoYegitekPage() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus + altaris · senaryo 18 · yeğitek içerik geliştirme daire bşk."
      timeline={["açılış", "ölçek", "soru", "altaris", "senaryo", "video", "görsel", "ses", "denetim", "egemenlik", "kanıt", "pilot"]}
      accentColors={{ from: "#a8c0e8", via: "#5a78a8", to: "#2a3858" }}
    >
      {/* SAHNE 1 — Açılış */}
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a8aa0]">/ ankara · pazartesi · 09:00</div>
            <h1 className="mt-3 text-[clamp(34px,4.8vw,68px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
              <span className="text-[#a8c0e8]">⌘</span> YEĞİTEK<br />
              <span className="text-[#7a8aa0]">İçerik Geliştirme ve Yönetimi</span><br />
              <span className="text-[#7a8aa0]">Daire Başkanlığı</span>
            </h1>
            <div className="mt-8 grid grid-cols-3 gap-3 max-w-2xl">
              <div className="rounded-md border border-[rgba(168,192,232,0.45)] bg-[#0c1018]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8c0e8]">koordinatörlük</div>
                <div className="mt-1 text-base text-[#ddd8d0]">5</div>
              </div>
              <div className="rounded-md border border-[rgba(168,192,232,0.45)] bg-[#0c1018]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8c0e8]">platform</div>
                <div className="mt-1 text-base text-[#ddd8d0]">EBA · ÖBA · TRT EBA</div>
              </div>
              <div className="rounded-md border border-[rgba(168,192,232,0.45)] bg-[#0c1018]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8c0e8]">onay</div>
                <div className="mt-1 text-base text-[#ddd8d0]">TTKB</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 2 — Üretim ölçeği */}
      <section className="scene s2">
        <div className="stage">
          <div className="max-w-5xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a8aa0]">/ son bir yılda üretilen</div>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                ["98", "eğitsel video"],
                ["411", "öğretim materyali"],
                ["129", "z-kitap"],
                ["5", "simülasyon"],
                ["VR", "BİLSEM hücre"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-md border border-[rgba(168,192,232,0.45)] bg-[#0c1018] px-4 py-3">
                  <div className="text-base font-medium text-[#a8c0e8]">{v}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[#9b9285]">{l}</div>
                </div>
              ))}
            </div>
            <p className="mt-8 max-w-3xl text-sm leading-relaxed text-[#bdb4a6]">
              7.012 ekran · 20.163 zenginleştirilmiş içerik · 27 Velivizyon ·
              53 sanal müze turu —
              <span className="text-[#ddd8d0]"> tek bir yılda, beş koordinatörlük</span>.
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 3 — Soru */}
      <section className="scene s3">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <h2 className="text-[clamp(28px,4.4vw,60px)] font-light leading-[1.18] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">"</span>
              Bir senaryodan yayına<br />
              <span className="grad-text font-medium">kaç gün, kaç gözden geçirme</span>?
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-8 text-base text-[#7a8aa0]">
              Senaryo · üretim · birim onayı · TTKB pedagojik inceleme · yayım
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 4 — Altaris reveal */}
      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#7a8aa0]">
              <span aria-hidden className="size-1.5 rounded-full bg-[#a8c0e8] animate-pulse" />
              <span>altaris · ai içerik üretim ekosistemi</span>
              <span className="text-[#3a444d]">·</span>
              <span>on-prem · multi-tenant · TTKB-uyum</span>
            </div>
            <div className="rounded-md border border-[rgba(168,192,232,0.5)] bg-[#0c1018] p-6">
              <p className="text-base text-[#ddd8d0] font-mono">
                <span className="text-[#a8c0e8]">▸</span> altaris init
                <span className="text-[#7a8aa0]"> --tenant=yegitek</span>
                <span className="text-[#7a8aa0]"> --content-pipeline</span>
                <span className="text-[#7a8aa0]"> --ttkb-kriter</span>
              </p>
              <div className="mt-4 grid grid-cols-4 gap-2 text-[10px] uppercase tracking-[0.22em] text-[#7a8aa0]">
                <span>5 ajan</span>
                <span>kazanım eşleşme</span>
                <span>erişilebilirlik</span>
                <span>telif-temiz havuz</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 5 — Senaryo Üretim Asistanı */}
      <section className="scene s5">
        <div className="stage">
          <div className="w-full max-w-4xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#a8c0e8]">/ ajan 1 · senaryo üretim asistanı</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a8aa0]">etkileşimli içerik koordinatörlüğü</div>
            </div>
            <div className="rounded-md border border-[rgba(168,192,232,0.45)] bg-[#0c1018] p-5">
              <p className="text-[12px] uppercase tracking-[0.2em] text-[#9b9285]">istek</p>
              <p className="mt-1 text-base text-[#ddd8d0] italic">
                "8. sınıf fen — basınç kazanımı · etkileşimli simülasyon senaryosu"
              </p>
              <div className="my-4 h-px bg-[rgba(168,192,232,0.25)]" />
              <p className="text-[12px] uppercase tracking-[0.2em] text-[#a8c0e8]">altaris üretimi · 12 dk</p>
              <div className="grid grid-cols-3 gap-2 text-[11px] text-[#bdb4a6]">
                <div className="rounded-sm border border-[rgba(168,192,232,0.4)] bg-[#101820] px-2 py-2">
                  <div className="text-[9px] uppercase tracking-[0.22em] text-[#a8c0e8]">storyboard</div>
                  <div className="mt-1">9 sahne · 6 etkileşim</div>
                </div>
                <div className="rounded-sm border border-[rgba(168,192,232,0.4)] bg-[#101820] px-2 py-2">
                  <div className="text-[9px] uppercase tracking-[0.22em] text-[#a8c0e8]">kazanım</div>
                  <div className="mt-1">F.8.5.4 · F.8.5.5 eşleşti</div>
                </div>
                <div className="rounded-sm border border-[rgba(168,192,232,0.4)] bg-[#101820] px-2 py-2">
                  <div className="text-[9px] uppercase tracking-[0.22em] text-[#a8c0e8]">TTKB kriter</div>
                  <div className="mt-1">7 madde · 7 ✓</div>
                </div>
              </div>
            </div>
            <p className="mt-4 text-[11px] uppercase tracking-[0.28em] text-[#7a8aa0]">
              insan-yazar düzenlemesinden geçer · son söz e-içerik komisyonunda
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 6 — Video Anlatım Üretimi */}
      <section className="scene s6">
        <div className="stage">
          <div className="w-full max-w-4xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#a8c0e8]">/ ajan 2 · video anlatım üretimi</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a8aa0]">video koordinatörlüğü</div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-[rgba(168,192,232,0.45)] bg-[#0c1018] p-4">
                <div className="text-base font-medium text-[#a8c0e8]">14 ses</div>
                <div className="mt-1 text-base text-[#ddd8d0]">TTS karakter</div>
                <p className="mt-2 text-[12px] text-[#9b9285]">öğretmen · anlatıcı · diyalog</p>
              </div>
              <div className="rounded-md border border-[rgba(168,192,232,0.45)] bg-[#0c1018] p-4">
                <div className="text-base font-medium text-[#a8c0e8]">otomatik</div>
                <div className="mt-1 text-base text-[#ddd8d0]">altyazı</div>
                <p className="mt-2 text-[12px] text-[#9b9285]">SRT + işitme engelliler</p>
              </div>
              <div className="rounded-md border border-[rgba(168,192,232,0.45)] bg-[#0c1018] p-4">
                <div className="text-base font-medium text-[#a8c0e8]">kalite</div>
                <div className="mt-1 text-base text-[#ddd8d0]">sahne analizi</div>
                <p className="mt-2 text-[12px] text-[#9b9285]">ses seviyesi · görüntü kararması</p>
              </div>
            </div>
            <div className="mt-4 rounded-md border border-[rgba(168,192,232,0.45)] bg-[#0c1018] p-4">
              <p className="text-[13px] leading-relaxed text-[#ddd8d0]">
                <span className="text-[#a8c0e8]">98 video / yıl</span> üretim hızı — anlatım, montaj
                ve altyazı insan-yapım kalitesinde, üretim takvimi 3 katına çıkar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 7 — Görsel & Animasyon Asistanı */}
      <section className="scene s7">
        <div className="stage">
          <div className="w-full max-w-4xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#a8c0e8]">/ ajan 3 · görsel & animasyon</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a8aa0]">görsel koordinatörlüğü</div>
            </div>
            <div className="rounded-md border border-[rgba(168,192,232,0.45)] bg-[#0c1018] p-5">
              <p className="text-[12px] uppercase tracking-[0.2em] text-[#9b9285]">istek</p>
              <p className="mt-1 text-base text-[#ddd8d0] italic">
                "Hücre membranı — 2D animasyon, 4. sınıf seviyesi, telif-temiz"
              </p>
              <div className="my-4 h-px bg-[rgba(168,192,232,0.25)]" />
              <div className="grid grid-cols-4 gap-2 text-[11px] text-[#bdb4a6]">
                <div className="rounded-sm border border-[rgba(168,192,232,0.4)] bg-[#101820] px-2 py-2">
                  <div className="text-[9px] uppercase tracking-[0.22em] text-[#a8c0e8]">01 · havuz</div>
                  <div className="mt-1">YEĞİTEK görsel havuzu · 14k öğe</div>
                </div>
                <div className="rounded-sm border border-[rgba(168,192,232,0.4)] bg-[#101820] px-2 py-2">
                  <div className="text-[9px] uppercase tracking-[0.22em] text-[#a8c0e8]">02 · kontrast</div>
                  <div className="mt-1">WCAG AA ✓</div>
                </div>
                <div className="rounded-sm border border-[rgba(168,192,232,0.4)] bg-[#101820] px-2 py-2">
                  <div className="text-[9px] uppercase tracking-[0.22em] text-[#a8c0e8]">03 · alt-text</div>
                  <div className="mt-1">otomatik · TR</div>
                </div>
                <div className="rounded-sm border border-[rgba(168,192,232,0.4)] bg-[#101820] px-2 py-2">
                  <div className="text-[9px] uppercase tracking-[0.22em] text-[#a8c0e8]">04 · 2D anim</div>
                  <div className="mt-1">storyboard 12 kare</div>
                </div>
              </div>
            </div>
            <p className="mt-4 text-[11px] uppercase tracking-[0.28em] text-[#7a8aa0]">
              web scraping yok · yalnızca kurum-içi onaylı havuz
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 8 — Sesli Kitap Üretimi */}
      <section className="scene s8">
        <div className="stage">
          <div className="w-full max-w-4xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#a8c0e8]">/ ajan 4 · sesli kitap üretimi</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a8aa0]">ses koordinatörlüğü</div>
            </div>
            <div className="rounded-md border border-[rgba(168,192,232,0.45)] bg-[#0c1018] p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-[12px] uppercase tracking-[0.2em] text-[#9b9285]">kaynak</p>
                  <p className="mt-1 text-base text-[#ddd8d0]">
                    "Çocuk Klasiği · 5. sınıf · 86 sayfa"
                  </p>
                  <div className="mt-4 space-y-1 text-[11px] text-[#bdb4a6]">
                    <div>· 3 anlatıcı sesi (anne · baba · çocuk)</div>
                    <div>· hikâye temposu otomatik nüans</div>
                    <div>· arka plan müzik öneri (telif-temiz)</div>
                    <div>· seviye normalize · gürültü süzgeci</div>
                  </div>
                </div>
                <div className="rounded-sm border border-[rgba(168,192,232,0.4)] bg-[#101820] p-3">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8c0e8]">çıktı</div>
                  <div className="mt-3 grid grid-cols-3 gap-1 text-[10px] text-[#9b9285]">
                    <div>WAV · 48kHz</div>
                    <div>SRT senkron</div>
                    <div>bölüm işaretleri</div>
                  </div>
                  <div className="mt-3 text-base font-medium text-[#a8c0e8]">38 dk</div>
                  <div className="text-[10px] text-[#9b9285]">insan stüdyo: 2 gün</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 9 — TTKB Ön-Denetim Ajanı */}
      <section className="scene s9">
        <div className="stage">
          <div className="w-full max-w-4xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#a8c0e8]">/ ajan 5 · TTKB ön-denetim</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a8aa0]">içerik inceleme ve denetim koordinatörlüğü</div>
            </div>
            <div className="rounded-md border border-[rgba(168,192,232,0.45)] bg-[#0c1018] p-5">
              <p className="text-[12px] uppercase tracking-[0.2em] text-[#a8c0e8]">ön-denetim raporu — içerik #2026/847</p>
              <div className="mt-3 space-y-2 text-[12px]">
                <div className="flex items-start gap-3">
                  <span className="text-[#7fb87f]">✓</span>
                  <span className="text-[#ddd8d0]">Kazanım eşleşmesi: 4. sınıf F.4.3.2 (uyumlu)</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[#7fb87f]">✓</span>
                  <span className="text-[#ddd8d0]">Erişilebilirlik: alt-text ✓ · transcript ✓ · WCAG AA kontrast ✓</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[#e8c878]">⚠</span>
                  <span className="text-[#ddd8d0]">Süre: 18 dk · TTKB kriteri max 12 dk → bölme önerisi</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[#7fb87f]">✓</span>
                  <span className="text-[#ddd8d0]">Telif: tüm görseller YEĞİTEK havuzundan, izin var</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[#7fb87f]">✓</span>
                  <span className="text-[#ddd8d0]">Pedagojik dil seviyesi: 4. sınıf okuma yaşına uygun</span>
                </div>
              </div>
              <div className="my-4 h-px bg-[rgba(168,192,232,0.25)]" />
              <p className="text-[11px] text-[#7a8aa0]">
                Bu rapor TTKB nihai kararını <span className="text-[#ddd8d0]">temsil etmez</span> —
                uzman görüşüne ön-hazırlık niteliğindedir. Pedagojik son söz daima TTKB'dedir.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 10 — Egemenlik & uyum */}
      <section className="scene s10">
        <div className="stage">
          <div className="text-center max-w-4xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a8aa0]">/ uyum ve egemenlik</div>
            <h2 className="mt-6 text-[clamp(26px,4.2vw,56px)] font-light leading-[1.18] tracking-tight text-[#ddd8d0]">
              <span className="grad-text font-medium">Pedagojik yetki TTKB'de</span><br />
              <span className="text-[#bdb4a6]">— veri ve model yurt içinde</span>
            </h2>
            <div className="mt-8 grid grid-cols-3 gap-4 max-w-3xl mx-auto">
              <div className="rounded-md border border-[rgba(168,192,232,0.45)] bg-[#0c1018] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8c0e8]">on-premise</div>
                <div className="mt-1 text-[11px] text-[#bdb4a6]">veri merkezinde · sınır dışına çıkmaz</div>
              </div>
              <div className="rounded-md border border-[rgba(168,192,232,0.45)] bg-[#0c1018] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8c0e8]">KVKK uyumlu</div>
                <div className="mt-1 text-[11px] text-[#bdb4a6]">retention · audit · erişim kontrolü</div>
              </div>
              <div className="rounded-md border border-[rgba(168,192,232,0.45)] bg-[#0c1018] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8c0e8]">açık kaynak</div>
                <div className="mt-1 text-[11px] text-[#bdb4a6]">denetlenebilir · kilitlenmez</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 11 — Sayısal vurgu */}
      <section className="scene s11">
        <div className="stage">
          <div className="text-center max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a8aa0]">/ üretim hızı + kalite</div>
            <h2 className="mt-8 text-[clamp(34px,5vw,72px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              <span className="text-[#7a8aa0]">5 koordinatörlük</span> ·
              <span className="grad-text font-medium"> 1 platform</span>
            </h2>
            <div className="mt-8 grid grid-cols-3 gap-3 max-w-2xl mx-auto">
              <div className="rounded-md border border-[rgba(168,192,232,0.45)] bg-[#0c1018] px-3 py-2">
                <div className="text-base font-medium text-[#a8c0e8]">14 gün</div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#9b9285]">geleneksel akış</div>
              </div>
              <div className="rounded-md border border-[rgba(168,192,232,0.45)] bg-[#0c1018] px-3 py-2">
                <div className="text-base font-medium text-[#a8c0e8]">1 gün</div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#9b9285]">altaris ile</div>
              </div>
              <div className="rounded-md border border-[rgba(168,192,232,0.45)] bg-[#0c1018] px-3 py-2">
                <div className="text-base font-medium text-[#a8c0e8]">%100</div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#9b9285]">yurt içi</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 12 — CTA */}
      <section className="scene s12">
        <div className="stage">
          <div className="w-full max-w-4xl text-center">
            <pre aria-label="Altaris" className="grad-shimmer mx-auto select-none whitespace-pre font-bold leading-[1.05] tracking-[0.02em] text-[clamp(13px,1.8vw,22px)]">
{`█▀█   █    ▀█▀   █▀█   █▀▄   █   █▀▀
█▀█   █     █    █▀█   █▀▄   █   ▀▀█
▀ ▀   ▀▀▀   ▀    ▀ ▀   ▀ ▀   ▀   ▀▀▀`}
            </pre>
            <div className="mt-3 text-[11px] uppercase tracking-[0.32em] text-[#a8c0e8]">
              argus teknoloji · içerik üretim ekosistemi
            </div>
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#bdb4a6]">
              5 koordinatörlük · TTKB-uyum · on-prem
            </div>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#a8c0e8] bg-[#a8c0e8] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ pilot</span>
              <span className="font-medium">tek koordinatörlük · 30 gün · innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-18-yegitek-icerik-pazartesi" label="senaryo 18 · yeğitek içerik pazartesi" />
    </SenaryoStage>
  );
}
