"use client";

// ─────────────────────────────────────────────────────────────────
// Senaryo 19 — Altaris × İGYS Entegrasyonu (v2)
// İlk yarı: 2247 yönerge akışının her adımına Altaris ajanı.
// İkinci yarı: Daire Başkanı'nın günlük masası (son-kullanıcı senaryoları).
// 71 sn · 16 sahne · bordo+altın hibrit · methodical + decisive building
// ─────────────────────────────────────────────────────────────────

import { SenaryoPlayer, type ScheduleFn } from "../_lib/SenaryoPlayer";
import { SenaryoStage } from "../_lib/SenaryoStage";
import { bell, gain, heartbeat, lfo, masterEnv, NOTES, osc, pad } from "../_lib/audio";

const TOTAL = 71;
const SCENE_TIMINGS = [
  [0, 3],    // 1 açılış
  [3, 4],    // 2 igys bağlamı
  [7, 3],    // 3 soru
  [10, 3],   // 4 altaris reveal
  [13, 5],   // 5 adım 1: senaryo yazımı
  [18, 5],   // 6 adım 2: inceleme
  [23, 5],   // 7 adım 3: üretim
  [28, 5],   // 8 adım 4: kabul
  [33, 5],   // 9 adım 5: TTKB ön-rapor
  [38, 5],   // 10 adım 6: yayım
  [43, 5],   // 11 sabah özeti (Daire Başkanı masası)
  [48, 5],   // 12 tek tık inceleme + karar
  [53, 5],   // 13 performans + brifing dashboard
  [58, 4],   // 14 egemenlik
  [62, 4],   // 15 sayısal vurgu
  [66, 5],   // 16 CTA
] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });

  // F major scholarly pad (İGYS olgunluğu)
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.F2, NOTES.C3, NOTES.F3, NOTES.A3], [
    [0, 0],
    [2, 0.022],
    [10, 0.024],
    [13, 0.026],
    [28, 0.028],
    [43, 0.032],   // Daire Başkanı masası — yükseliş
    [53, 0.034],
    [58, 0.030],
    [66, 0.034],   // CTA forte
    [70.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.16, 0.005, TOTAL, t0);

  // Heartbeat 1.7sn (dignified)
  const beats: number[] = [];
  for (let t = 1.7; t < 66; t += 1.7) beats.push(t);
  beats.forEach((t, i) => {
    heartbeat(ctx, master, t0 + t, i % 4 === 0 ? 0.20 : 0.10);
  });

  // Sahne 1 — açılış
  bell(ctx, master, t0 + 0.4, NOTES.F4, 0.10, 1.6);
  bell(ctx, master, t0 + 1.4, NOTES.D5, 0.08, 1.4);

  // Sahne 2 — igys bağlamı: ascending F arpeggio
  [3.4, 4.2, 5.0, 5.8].forEach((t, i) => {
    const notes = [NOTES.F4, NOTES.A4, NOTES.C5, NOTES.F4 * 2];
    bell(ctx, master, t0 + t, notes[i], 0.10, 1.3);
  });

  // Sahne 3 — soru
  bell(ctx, master, t0 + 7.3, NOTES.C5, 0.10, 1.4);
  bell(ctx, master, t0 + 8.1, NOTES.A4, 0.10, 1.4);
  bell(ctx, master, t0 + 8.9, NOTES.F4, 0.10, 1.6);

  // Sahne 4 — altaris reveal
  bell(ctx, master, t0 + 10.2, NOTES.D3, 0.13, 1.7);
  [10.7, 11.2, 11.7, 12.2].forEach((t, i) => {
    const notes = [NOTES.D4, NOTES["F#4"], NOTES.A4, NOTES.D5];
    bell(ctx, master, t0 + t, notes[i], 0.11, 1.3);
  });

  // Adım 1 — senaryo (typing)
  for (let t = 13.4; t < 17.5; t += 0.4) {
    bell(ctx, master, t0 + t, NOTES.A5 + Math.random() * 70, 0.05, 0.5);
  }
  bell(ctx, master, t0 + 17.6, NOTES.F4 * 2, 0.09, 1.2);

  // Adım 2 — inceleme
  bell(ctx, master, t0 + 18.4, NOTES.F4, 0.11, 1.4);
  bell(ctx, master, t0 + 19.6, NOTES.A4, 0.10, 1.3);
  bell(ctx, master, t0 + 20.8, NOTES.C5, 0.10, 1.3);
  bell(ctx, master, t0 + 22.0, NOTES.F4 * 2, 0.10, 1.3);

  // Adım 3 — üretim (rhythmic)
  for (let t = 23.4; t < 27.5; t += 0.55) {
    bell(ctx, master, t0 + t, NOTES.F4 + Math.random() * 50, 0.06, 0.7);
  }

  // Adım 4 — kabul (weighty)
  bell(ctx, master, t0 + 28.4, NOTES.F3, 0.13, 1.7);
  bell(ctx, master, t0 + 29.7, NOTES.C4, 0.12, 1.6);
  bell(ctx, master, t0 + 31.0, NOTES.F4, 0.11, 1.5);
  bell(ctx, master, t0 + 32.3, NOTES.A4, 0.10, 1.4);

  // Adım 5 — TTKB ön-rapor (scholarly)
  bell(ctx, master, t0 + 33.4, NOTES.C3, 0.15, 2.0);
  bell(ctx, master, t0 + 34.7, NOTES.F3, 0.13, 1.7);
  bell(ctx, master, t0 + 36.0, NOTES.A3, 0.12, 1.5);
  bell(ctx, master, t0 + 37.3, NOTES.C4, 0.10, 1.4);

  // Adım 6 — yayım (spread)
  [38.3, 38.9, 39.5, 40.1, 40.7].forEach((t, i) => {
    const notes = [NOTES.F4, NOTES.A4, NOTES.C5, NOTES.E5, NOTES.F4 * 2];
    bell(ctx, master, t0 + t, notes[i], 0.09, 1.1);
  });
  bell(ctx, master, t0 + 41.6, NOTES.D5, 0.10, 1.3);

  // Sahne 11 — sabah özeti (Daire Başkanı masası): bright morning bells
  bell(ctx, master, t0 + 43.3, NOTES.C5, 0.12, 1.4);
  bell(ctx, master, t0 + 43.9, NOTES.E5, 0.11, 1.4);
  bell(ctx, master, t0 + 44.5, NOTES.G5, 0.11, 1.3);
  bell(ctx, master, t0 + 45.5, NOTES.F4 * 2, 0.10, 1.3);
  bell(ctx, master, t0 + 46.6, NOTES.D5, 0.10, 1.3);

  // Sahne 12 — tek tık karar: rapid + final resolve
  for (let t = 48.3; t < 50.5; t += 0.18) {
    bell(ctx, master, t0 + t, NOTES.A5 + Math.random() * 100, 0.04, 0.3);
  }
  bell(ctx, master, t0 + 50.8, NOTES.G5, 0.13, 1.5); // resolve
  bell(ctx, master, t0 + 52.0, NOTES.F4 * 2, 0.11, 1.4);

  // Sahne 13 — dashboard: rising chord progression (achievement)
  bell(ctx, master, t0 + 53.3, NOTES.F3, 0.13, 1.7);
  bell(ctx, master, t0 + 54.0, NOTES.C4, 0.12, 1.6);
  bell(ctx, master, t0 + 54.7, NOTES.F4, 0.11, 1.5);
  bell(ctx, master, t0 + 55.4, NOTES.A4, 0.11, 1.4);
  bell(ctx, master, t0 + 56.1, NOTES.C5, 0.10, 1.3);
  bell(ctx, master, t0 + 56.9, NOTES.F4 * 2, 0.10, 1.3);

  // Sahne 14 — egemenlik: low warm sustain
  bell(ctx, master, t0 + 58.3, NOTES.F3, 0.16, 2.0);
  bell(ctx, master, t0 + 59.7, NOTES.C4, 0.13, 1.7);
  bell(ctx, master, t0 + 61.1, NOTES.F4, 0.11, 1.4);

  // Sahne 15 — sayısal vurgu: rapid metric pings
  [62.2, 62.6, 63.0, 63.4, 63.8, 64.2, 64.6, 65.0].forEach((t, i) => {
    bell(ctx, master, t0 + t, NOTES.C5 + i * 25, 0.06, 0.5);
  });
  bell(ctx, master, t0 + 65.4, NOTES.G5, 0.10, 1.2);

  // Sahne 16 — CTA: D-major pentatonic brand motif (FORTE)
  [NOTES.D4, NOTES["F#4"], NOTES.A4, NOTES.D5].forEach((f, i) => {
    bell(ctx, master, t0 + 66.2 + i * 0.36, f, 0.15, 1.9);
  });

  // Final D drone
  const finalOsc = osc(ctx, NOTES.D3, "triangle");
  const finalG = gain(ctx, 0);
  finalOsc.connect(finalG).connect(master);
  finalG.gain.setValueAtTime(0, t0 + 66);
  finalG.gain.linearRampToValueAtTime(0.054, t0 + 66.7);
  finalG.gain.linearRampToValueAtTime(0.044, t0 + 70);
  finalG.gain.exponentialRampToValueAtTime(0.0001, t0 + 71);
  finalOsc.start(t0 + 66);
  finalOsc.stop(t0 + 71.1);
};

export default function SenaryoIgysAltarisPage() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus · senaryo 19 · igys × altaris entegrasyonu · daire başkanı masası dahil"
      timeline={["açılış", "igys", "soru", "mimari", "senaryo", "inceleme", "üretim", "kabul", "ttkb", "yayım", "sabah", "karar", "dashboard", "egemenlik", "kanıt", "pilot"]}
      accentColors={{ from: "#e8c0a0", via: "#b08858", to: "#5a3818" }}
    >
      {/* SAHNE 1 — Açılış */}
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#a89488]">/ argus teknoloji × yeğitek</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#f0e6dc]">
              <span className="text-[#e8c0a0]">⌘</span> İGYS <span className="text-[#7a6b5a] font-extralight">×</span> <span className="grad-text font-medium">Altaris</span>
            </h1>
            <div className="mt-4 text-[clamp(15px,2vw,22px)] text-[#c8b8a8] font-light">
              Akışınıza gömülü yapay zekâ — masanıza gelen iş kolaylığı
            </div>
            <div className="mt-6 text-[12px] uppercase tracking-[0.28em] text-[#b08858]">
              MEB 2247 yönergeli akış · daire başkanı masası · sistemi bozmaz
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 2 — İGYS bağlamı */}
      <section className="scene s2">
        <div className="stage">
          <div className="max-w-5xl w-full">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#a89488]">/ mevcut işleyiş · 2019'dan bugüne</div>
            <div className="mt-6 grid grid-cols-3 gap-2 md:grid-cols-6 text-center">
              {[
                "senaryo yaz",
                "incele · onayla",
                "üret",
                "kabul et",
                "TTKB pedagojik",
                "yayımla",
              ].map((step, i) => (
                <div key={step} className="relative">
                  <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10]/85 px-3 py-3">
                    <div className="text-[9px] uppercase tracking-[0.22em] text-[#b08858]">/0{i + 1}</div>
                    <div className="mt-1 text-[12px] text-[#f0e6dc]">{step}</div>
                  </div>
                  {i < 5 && (
                    <div className="hidden md:block absolute right-[-10px] top-1/2 -translate-y-1/2 text-[#7a6b5a] text-base">→</div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-8 max-w-3xl text-sm leading-relaxed text-[#c8b8a8]">
              Yıllardır işleyen, olgun bir akış — komisyonlar, TTKB, yayım kanalları.
              <span className="text-[#f0e6dc]"> Bu akışı değiştirmiyoruz</span>; her adımına bir yardımcı ajan ekliyoruz.
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 3 — Soru */}
      <section className="scene s3">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <h2 className="text-[clamp(28px,4.4vw,60px)] font-light leading-[1.18] tracking-tight text-[#f0e6dc]">
              <span className="text-[#5a534a]">"</span>
              Akışın her adımına AI<br />
              <span className="grad-text font-medium">nasıl katar — sistemi bozmadan</span>?
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-8 text-base text-[#a89488]">
              komisyon · uzman · öğretmen · TTKB · daire başkanı — son söz hep insanda
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 4 — Entegrasyon mimarisi */}
      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#a89488]">
              <span aria-hidden className="size-1.5 rounded-full bg-[#e8c0a0] animate-pulse" />
              <span>altaris · İGYS sidecar entegrasyonu</span>
              <span className="text-[#3a342d]">·</span>
              <span>API üzerinden · on-prem</span>
            </div>
            <div className="rounded-md border border-[rgba(232,192,160,0.5)] bg-[#180e10] p-6">
              <p className="text-base text-[#f0e6dc] font-mono">
                <span className="text-[#e8c0a0]">▸</span> altaris bind
                <span className="text-[#a89488]"> --igys-api</span>
                <span className="text-[#a89488]"> --tenant=yegitek</span>
                <span className="text-[#a89488]"> --mode=advisor</span>
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.22em] text-[#a89488]">
                <span>İGYS REST API</span>
                <span>RBAC sözleşmesi korunur</span>
                <span>audit · İGYS log'una yazar</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 5 — Adım 1: Senaryo Yazımı */}
      <section className="scene s5">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#e8c0a0]">/ adım 1 · senaryo yazımında ai</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#a89488]">madde 6.1 · senaryo asistanı</div>
            </div>
            <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-5">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[12px] uppercase tracking-[0.2em] text-[#a89488]">komisyon üyesi yazıyor</p>
                  <p className="mt-1 text-[13px] text-[#f0e6dc] italic">
                    "8. sınıf fen · basınç · etkileşimli senaryo"
                  </p>
                  <ul className="mt-3 space-y-1 text-[11px] text-[#c8b8a8]">
                    <li>· kazanım otomatik etiketlenir (F.8.5.4)</li>
                    <li>· storyboard taslağı (9 sahne) önerir</li>
                    <li>· TTKB kriter ön-uyum raporu</li>
                  </ul>
                </div>
                <div className="rounded-sm border border-[rgba(232,192,160,0.4)] bg-[#221518] p-3">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#e8c0a0]">İGYS form alanı</div>
                  <div className="mt-2 text-[11px] text-[#c8b8a8]">
                    Yazar her satırı kabul/red eder. Kayıt İGYS şemasında kalır.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 6 — Adım 2: İncelemede AI */}
      <section className="scene s6">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#e8c0a0]">/ adım 2 · komisyon incelemesinde ai</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#a89488]">madde 6.1 · inceleme asistanı</div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#e8c0a0]">kriter raporu</div>
                <p className="mt-2 text-[11px] text-[#c8b8a8]">TTKB 12 maddesi · uyum yüzdeleri</p>
              </div>
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#e8c0a0]">benzer senaryo kıyası</div>
                <p className="mt-2 text-[11px] text-[#c8b8a8]">arşivden 3 yakın örnek · onay süreçleri</p>
              </div>
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#e8c0a0]">öneri taslağı</div>
                <p className="mt-2 text-[11px] text-[#c8b8a8]">düzeltme/red gerekçe taslakları</p>
              </div>
            </div>
            <p className="mt-4 text-[11px] text-[#a89488]">
              komisyon üyesi okur · değerlendirir · onayı kendi imzasıyla verir
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 7 — Adım 3: Üretimde AI */}
      <section className="scene s7">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#e8c0a0]">/ adım 3 · üretimde ai</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#a89488]">madde 6.2 · üretim asistanı</div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#e8c0a0]">TTS anlatım</div>
                <p className="mt-2 text-[11px] text-[#c8b8a8]">14 ses · TR · doğal</p>
              </div>
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#e8c0a0]">görsel öneri</div>
                <p className="mt-2 text-[11px] text-[#c8b8a8]">YEĞİTEK havuzu · telif-temiz</p>
              </div>
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#e8c0a0]">2D anim taslak</div>
                <p className="mt-2 text-[11px] text-[#c8b8a8]">12 kare · uyarlanabilir</p>
              </div>
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#e8c0a0]">sahne kalite</div>
                <p className="mt-2 text-[11px] text-[#c8b8a8]">ses seviyesi · görüntü anomalisi</p>
              </div>
            </div>
            <p className="mt-4 text-[12px] text-[#c8b8a8]">
              Üretim ekibinin elinde <span className="text-[#f0e6dc]">hazır taslak</span> oluşur.
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 8 — Adım 4: Kabul Denetiminde AI */}
      <section className="scene s8">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#e8c0a0]">/ adım 4 · içerik kabulünde ai</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#a89488]">madde 6.4 · kabul denetim ajanı</div>
            </div>
            <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-5">
              <p className="text-[12px] uppercase tracking-[0.2em] text-[#e8c0a0]">otomatik ön-denetim · içerik #2026/847</p>
              <div className="mt-3 grid gap-1.5 text-[12px] md:grid-cols-2">
                <div className="flex items-start gap-2"><span className="text-[#7fb87f]">✓</span><span className="text-[#c8b8a8]">erişilebilirlik · alt-text · transkript</span></div>
                <div className="flex items-start gap-2"><span className="text-[#7fb87f]">✓</span><span className="text-[#c8b8a8]">WCAG AA renk kontrastı</span></div>
                <div className="flex items-start gap-2"><span className="text-[#7fb87f]">✓</span><span className="text-[#c8b8a8]">telif · havuzdan, izinli</span></div>
                <div className="flex items-start gap-2"><span className="text-[#e8c878]">⚠</span><span className="text-[#c8b8a8]">süre · 18 dk · TTKB max 12 dk → bölme önerisi</span></div>
                <div className="flex items-start gap-2"><span className="text-[#7fb87f]">✓</span><span className="text-[#c8b8a8]">format · çoklu çıktı · EBA + TRT EBA</span></div>
                <div className="flex items-start gap-2"><span className="text-[#7fb87f]">✓</span><span className="text-[#c8b8a8]">meta · kazanım · seviye eşleşmesi</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 9 — Adım 5: TTKB Ön-Raporunda AI */}
      <section className="scene s9">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#e8c0a0]">/ adım 5 · ttkb ön-raporunda ai</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#a89488]">madde 6.4 · ttkb ön-rapor ajanı</div>
            </div>
            <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-5">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[12px] uppercase tracking-[0.2em] text-[#e8c0a0]">uzmana sunum dosyası</p>
                  <ul className="mt-3 space-y-1.5 text-[12px] text-[#c8b8a8]">
                    <li>· kriter eşleşme matrisi</li>
                    <li>· güçlü/zayıf yön özeti</li>
                    <li>· geçmiş benzer kararlar</li>
                    <li>· erişilebilirlik teknik raporu</li>
                  </ul>
                </div>
                <div>
                  <p className="text-[12px] uppercase tracking-[0.2em] text-[#e8c0a0]">uzman ne yapar</p>
                  <ul className="mt-3 space-y-1.5 text-[12px] text-[#c8b8a8]">
                    <li>· raporu okur, dilerse atlar</li>
                    <li>· kendi pedagojik değerlendirmesini yazar</li>
                    <li>· uygunluk raporunu imzalar</li>
                    <li>· nihai söz <span className="text-[#f0e6dc]">TTKB'de</span></li>
                  </ul>
                </div>
              </div>
              <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-[#b08858]">
                ai bir görüş bildirmez · sadece veriyi düzenler
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 10 — Adım 6: Yayımda AI */}
      <section className="scene s10">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#e8c0a0]">/ adım 6 · yayımda ai</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#a89488]">madde 8 · yayım asistanı</div>
            </div>
            <div className="grid gap-3 md:grid-cols-5">
              {[
                ["EBA", "format A · alt yazı"],
                ["TRT EBA", "TV format · ses normalize"],
                ["ÖBA", "öğretmen versiyon"],
                ["BİLSEM", "ileri seviye dipnot"],
                ["Velivizyon", "veli özet versiyonu"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] px-3 py-3 text-center">
                  <div className="text-base font-medium text-[#e8c0a0]">{k}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[#a89488]">{v}</div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[12px] text-[#c8b8a8]">
              tek onay → çok kanal · format · alt yazı · meta otomatik;
              <span className="text-[#f0e6dc]"> yayım yetkisi YEĞİTEK'te</span>.
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 11 — Sabah özeti (Daire Başkanı masası) */}
      <section className="scene s11">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-3 text-[11px] uppercase tracking-[0.32em] text-[#e8c0a0]">/ daire başkanı masası · 09:00 pazartesi</div>
            <h3 className="text-[clamp(20px,2.6vw,32px)] font-light leading-[1.2] text-[#f0e6dc]">
              Tek bakışta gündeminiz
            </h3>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a89488]">onay bekleyen senaryo</div>
                <div className="mt-2 text-2xl font-light text-[#f0e6dc]">14</div>
                <div className="mt-1 text-[10px] text-[#ff9078]">4'ü kritik · 10 rutin</div>
              </div>
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a89488]">kalite kabul</div>
                <div className="mt-2 text-2xl font-light text-[#f0e6dc]">3</div>
                <div className="mt-1 text-[10px] text-[#c8b8a8]">üretim tamam · masada</div>
              </div>
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a89488]">ttkb itirazı</div>
                <div className="mt-2 text-2xl font-light text-[#f0e6dc]">2</div>
                <div className="mt-1 text-[10px] text-[#e8c878]">ön-rapor hazır</div>
              </div>
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a89488]">yayım takvimi</div>
                <div className="mt-2 text-2xl font-light text-[#f0e6dc]">1</div>
                <div className="mt-1 text-[10px] text-[#ff9078]">sapma uyarısı</div>
              </div>
            </div>
            <p className="mt-4 text-[11px] text-[#a89488]">
              Altaris geceden işliyor · sabah masanızda <span className="text-[#f0e6dc]">öncelik sırası</span> hazır
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 12 — Tek tık inceleme + karar */}
      <section className="scene s12">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-3 text-[11px] uppercase tracking-[0.32em] text-[#e8c0a0]">/ daire başkanı · senaryo #2026/847 açılır</div>
            <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[#a89488]">senaryo özeti</p>
                  <p className="mt-2 text-[12px] text-[#f0e6dc] leading-relaxed">
                    "8. sınıf fen — basınç · etkileşimli simülasyon · 9 sahne. Komisyon yazarı: Y. Öğretmen. Tahmini süre 12 dk."
                  </p>
                </div>
                <div className="rounded-sm border border-[rgba(232,192,160,0.4)] bg-[#221518] p-3">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[#e8c0a0]">ai ön-değerlendirme</p>
                  <ul className="mt-2 space-y-1 text-[11px] text-[#c8b8a8]">
                    <li><span className="text-[#7fb87f]">✓</span> kazanım eşleşmesi tam</li>
                    <li><span className="text-[#7fb87f]">✓</span> TTKB kriter 7/7</li>
                    <li><span className="text-[#7fb87f]">✓</span> 3 benzer senaryo onaylanmış</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-sm border border-[#7fb87f] bg-[#1f2a1f] px-3 py-2 text-center text-[12px] text-[#7fb87f]">onayla</div>
                <div className="rounded-sm border border-[#e8c878] bg-[#2a2418] px-3 py-2 text-center text-[12px] text-[#e8c878]">düzeltme iste</div>
                <div className="rounded-sm border border-[#a89488] bg-[#221518] px-3 py-2 text-center text-[12px] text-[#a89488]">iade et</div>
              </div>
              <p className="mt-3 text-[10px] text-[#7a6b5a] text-center">gerekçe taslağı her seçenek altında otomatik · siz düzenler, imzalarsınız</p>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 13 — Performans + brifing dashboard */}
      <section className="scene s13">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-3 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#e8c0a0]">/ daire başkanı · aylık performans</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#a89488]">brifinge hazır · pdf tek tıkla</div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a89488]">üretim</div>
                <div className="mt-2 text-xl font-light text-[#f0e6dc]">+%18</div>
                <div className="mt-1 text-[10px] text-[#7fb87f]">geçen aya göre</div>
              </div>
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a89488]">ortalama süre</div>
                <div className="mt-2 text-xl font-light text-[#f0e6dc]">4 gün</div>
                <div className="mt-1 text-[10px] text-[#c8b8a8]">geleneksel: 14</div>
              </div>
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a89488]">ttkb red oranı</div>
                <div className="mt-2 text-xl font-light text-[#f0e6dc]">%2.4</div>
                <div className="mt-1 text-[10px] text-[#7fb87f]">önceki dönem %8.1</div>
              </div>
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a89488]">en yoğun kategori</div>
                <div className="mt-2 text-xl font-light text-[#f0e6dc]">fen</div>
                <div className="mt-1 text-[10px] text-[#c8b8a8]">%38 paya sahip</div>
              </div>
            </div>
            <div className="mt-4 rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-3">
              <p className="text-[11px] text-[#c8b8a8]">
                <span className="text-[#e8c0a0]">▸</span> "Üst makama brifing özeti hazırla" → 30 saniyede 2 sayfa PDF · grafik + sayısal analiz + önümüzdeki ay öngörüsü.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 14 — Egemenlik & uyum */}
      <section className="scene s14">
        <div className="stage">
          <div className="text-center max-w-4xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#a89488]">/ uyum + egemenlik</div>
            <h2 className="mt-6 text-[clamp(26px,4vw,52px)] font-light leading-[1.18] tracking-tight text-[#f0e6dc]">
              <span className="grad-text font-medium">İGYS işleyişi bozulmaz</span><br />
              <span className="text-[#c8b8a8]">— TTKB son söz, veri yurt içinde</span>
            </h2>
            <div className="mt-8 grid grid-cols-4 gap-3 max-w-3xl mx-auto">
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#e8c0a0]">on-premise</div>
                <div className="mt-1 text-[10px] text-[#c8b8a8]">veri merkezi</div>
              </div>
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#e8c0a0]">KVKK</div>
                <div className="mt-1 text-[10px] text-[#c8b8a8]">retention · audit</div>
              </div>
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#e8c0a0]">İGYS RBAC</div>
                <div className="mt-1 text-[10px] text-[#c8b8a8]">korunur</div>
              </div>
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#e8c0a0]">TTKB</div>
                <div className="mt-1 text-[10px] text-[#c8b8a8]">son söz · sarsılmaz</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 15 — Sayısal vurgu */}
      <section className="scene s15">
        <div className="stage">
          <div className="text-center max-w-4xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#a89488]">/ akışta · masada · brifingde</div>
            <div className="mt-6 grid grid-cols-3 gap-4 max-w-3xl mx-auto">
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a89488]">akış başı süre</div>
                <div className="mt-2 text-2xl font-light text-[#e8c0a0]">14 → 4 gün</div>
                <div className="mt-1 text-[10px] text-[#7a6b5a]">aynı kalite zinciri</div>
              </div>
              <div className="rounded-md border-2 border-[#e8c0a0] bg-[#180e10] px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#e8c0a0]">karar süresi</div>
                <div className="mt-2 text-2xl font-light text-[#f0e6dc]">12 dk → 90 sn</div>
                <div className="mt-1 text-[10px] text-[#b08858]">gerekçe + kıyas yanınızda</div>
              </div>
              <div className="rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a89488]">brifing</div>
                <div className="mt-2 text-2xl font-light text-[#e8c0a0]">2 sa → 30 sn</div>
                <div className="mt-1 text-[10px] text-[#7a6b5a]">2 sayfa pdf hazır</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 16 — CTA */}
      <section className="scene s16">
        <div className="stage">
          <div className="w-full max-w-4xl text-center">
            <div className="text-[12px] uppercase tracking-[0.36em] text-[#e8c0a0] font-medium">
              İGYS × Altaris
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.32em] text-[#a89488]">
              akışınıza gömülü · masanızda yardımcı · 30 gün pilot
            </div>

            <div className="mt-8 mx-auto max-w-2xl rounded-md border border-[rgba(232,192,160,0.45)] bg-[#180e10] p-5">
              <p className="text-[13px] text-[#c8b8a8] leading-relaxed">
                Altı süreç adımından <span className="text-[#f0e6dc]">tek bir adımı</span> seçin
                — daire başkanı masasındaki sabah özeti + tek tık karar yardımcısı
                <span className="text-[#f0e6dc]"> her sahnede yanınızda</span>. Memnun kalmazsanız kapatırız.
              </p>
            </div>

            <pre aria-label="Argus" className="grad-shimmer mx-auto mt-8 select-none whitespace-pre font-bold leading-[1.05] tracking-[0.04em] text-[clamp(11px,1.4vw,17px)]">
{`█▀█   █▀▄   █▀▀   █   █   █▀▀
█▀█   █▀▄   █ █   █   █   ▀▀█
▀ ▀   ▀ ▀   ▀▀▀   ▀▀▀▀▀   ▀▀▀`}
            </pre>
            <div className="mx-auto mt-6 inline-flex items-center gap-4 rounded-md border border-[#e8c0a0] bg-[#e8c0a0] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ pilot</span>
              <span className="font-medium">innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-19-altaris-igys-entegrasyon" label="senaryo 19 · igys × altaris entegrasyon (v2)" />
    </SenaryoStage>
  );
}
