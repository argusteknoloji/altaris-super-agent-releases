"use client";

// ─────────────────────────────────────────────────────────────────
// Senaryo 20 — Altaris × DMO Entegrasyonu
// Genel Müdür Şinasi CANDAN için tam-versiyon tanıtım.
// 6 süreç ajan + 3 GM masası senaryosu = 16 sahne · 72 sn
// Accent: DMO logo paleti turuncu→navy #f4a866 → #cc6628 → #1e2a4a
// Mood: precise institutional + dynamic dijitalleşme
// ─────────────────────────────────────────────────────────────────

import { SenaryoPlayer, type ScheduleFn } from "../_lib/SenaryoPlayer";
import { SenaryoStage } from "../_lib/SenaryoStage";
import { bell, gain, heartbeat, lfo, masterEnv, NOTES, osc, pad } from "../_lib/audio";

const TOTAL = 72;
const SCENE_TIMINGS = [
  [0, 3],     // 1 açılış
  [3, 4],     // 2 ölçek
  [7, 3],     // 3 stratejik kapı (H 3.3 + H 4.4)
  [10, 3],    // 4 altaris reveal
  [13, 5],    // 5 ajan 1: fiyat
  [18, 5],    // 6 ajan 2: tedarikçi
  [23, 5],    // 7 ajan 3: talep kümeleme
  [28, 5],    // 8 ajan 4: şartname
  [33, 5],    // 9 ajan 5: kalite kontrol
  [38, 5],    // 10 ajan 6: müşteri/tedarikçi hizmet
  [43, 5],    // 11 GM masası — sabah özeti
  [48, 5],    // 12 GM masası — karar
  [53, 5],    // 13 GM masası — performans/brifing
  [58, 4],    // 14 egemenlik
  [62, 4],    // 15 sayısal
  [66, 6],    // 16 CTA
] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });

  // F major institutional pad (procurement gravity)
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.F2, NOTES.C3, NOTES.F3, NOTES.A3], [
    [0, 0],
    [2, 0.022],
    [10, 0.024],
    [13, 0.026],
    [33, 0.028],
    [43, 0.032],
    [58, 0.030],
    [66, 0.034],
    [71.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.16, 0.005, TOTAL, t0);

  // Procurement cadence heartbeat — 1.6sn
  const beats: number[] = [];
  for (let t = 1.6; t < 66; t += 1.6) beats.push(t);
  beats.forEach((t, i) => {
    heartbeat(ctx, master, t0 + t, i % 4 === 0 ? 0.20 : 0.10);
  });

  // Sahne 1 — açılış
  bell(ctx, master, t0 + 0.4, NOTES.F4, 0.10, 1.6);
  bell(ctx, master, t0 + 1.4, NOTES.A4, 0.08, 1.4);

  // Sahne 2 — ölçek (ascending)
  [3.4, 4.2, 5.0, 5.8].forEach((t, i) => {
    const notes = [NOTES.F4, NOTES.A4, NOTES.C5, NOTES.F4 * 2];
    bell(ctx, master, t0 + t, notes[i], 0.10, 1.3);
  });

  // Sahne 3 — stratejik kapı
  bell(ctx, master, t0 + 7.3, NOTES.C5, 0.10, 1.5);
  bell(ctx, master, t0 + 8.2, NOTES.A4, 0.10, 1.5);
  bell(ctx, master, t0 + 9.0, NOTES.F4, 0.10, 1.5);

  // Sahne 4 — altaris reveal (D-major motif)
  bell(ctx, master, t0 + 10.2, NOTES.D3, 0.13, 1.7);
  [10.7, 11.2, 11.7, 12.2].forEach((t, i) => {
    const notes = [NOTES.D4, NOTES["F#4"], NOTES.A4, NOTES.D5];
    bell(ctx, master, t0 + t, notes[i], 0.11, 1.3);
  });

  // Ajan 1 — fiyat (rapid scan ticks)
  for (let t = 13.4; t < 17.5; t += 0.32) {
    bell(ctx, master, t0 + t, NOTES.A5 + Math.random() * 100, 0.05, 0.4);
  }
  bell(ctx, master, t0 + 17.6, NOTES.G5, 0.10, 1.3);

  // Ajan 2 — tedarikçi (methodical evaluation)
  bell(ctx, master, t0 + 18.4, NOTES.F4, 0.11, 1.4);
  bell(ctx, master, t0 + 19.6, NOTES.A4, 0.10, 1.3);
  bell(ctx, master, t0 + 20.8, NOTES.C5, 0.10, 1.3);
  bell(ctx, master, t0 + 22.0, NOTES.F4 * 2, 0.10, 1.3);

  // Ajan 3 — talep kümeleme (rhythmic aggregation)
  for (let t = 23.4; t < 27.5; t += 0.45) {
    bell(ctx, master, t0 + t, NOTES.F4 + Math.random() * 80, 0.06, 0.6);
  }

  // Ajan 4 — şartname (weighty)
  bell(ctx, master, t0 + 28.4, NOTES.F3, 0.13, 1.6);
  bell(ctx, master, t0 + 29.7, NOTES.C4, 0.12, 1.5);
  bell(ctx, master, t0 + 31.0, NOTES.F4, 0.11, 1.4);
  bell(ctx, master, t0 + 32.3, NOTES.A4, 0.10, 1.3);

  // Ajan 5 — kalite (precise check pings)
  [33.4, 34.0, 34.6, 35.2, 35.8, 36.4, 37.0].forEach((t, i) => {
    const notes = [NOTES.G4, NOTES.C5, NOTES.E5, NOTES.G4, NOTES.C5, NOTES.G4, NOTES.E5];
    bell(ctx, master, t0 + t, notes[i], 0.07, 1.0);
  });

  // Ajan 6 — müşteri/tedarikçi (spread + flow)
  [38.3, 38.9, 39.5, 40.1, 40.7, 41.5].forEach((t, i) => {
    const notes = [NOTES.F4, NOTES.A4, NOTES.C5, NOTES.E5, NOTES.F4 * 2, NOTES.D5];
    bell(ctx, master, t0 + t, notes[i], 0.09, 1.1);
  });

  // GM masası — sabah özeti (bright morning)
  bell(ctx, master, t0 + 43.3, NOTES.C5, 0.12, 1.4);
  bell(ctx, master, t0 + 43.9, NOTES.E5, 0.11, 1.4);
  bell(ctx, master, t0 + 44.5, NOTES.G5, 0.11, 1.3);
  bell(ctx, master, t0 + 45.5, NOTES.F4 * 2, 0.10, 1.3);
  bell(ctx, master, t0 + 46.6, NOTES.D5, 0.10, 1.3);

  // GM — karar (rapid + resolve)
  for (let t = 48.3; t < 50.5; t += 0.18) {
    bell(ctx, master, t0 + t, NOTES.A5 + Math.random() * 100, 0.04, 0.3);
  }
  bell(ctx, master, t0 + 50.8, NOTES.G5, 0.13, 1.5);
  bell(ctx, master, t0 + 52.0, NOTES.F4 * 2, 0.11, 1.4);

  // GM — dashboard (rising chord)
  bell(ctx, master, t0 + 53.3, NOTES.F3, 0.13, 1.7);
  bell(ctx, master, t0 + 54.0, NOTES.C4, 0.12, 1.6);
  bell(ctx, master, t0 + 54.7, NOTES.F4, 0.11, 1.5);
  bell(ctx, master, t0 + 55.4, NOTES.A4, 0.11, 1.4);
  bell(ctx, master, t0 + 56.1, NOTES.C5, 0.10, 1.3);
  bell(ctx, master, t0 + 56.9, NOTES.F4 * 2, 0.10, 1.3);

  // Egemenlik — sustain
  bell(ctx, master, t0 + 58.3, NOTES.F3, 0.16, 2.0);
  bell(ctx, master, t0 + 59.7, NOTES.C4, 0.13, 1.7);
  bell(ctx, master, t0 + 61.1, NOTES.F4, 0.11, 1.4);

  // Sayısal vurgu — rapid
  [62.2, 62.6, 63.0, 63.4, 63.8, 64.2, 64.6, 65.0].forEach((t, i) => {
    bell(ctx, master, t0 + t, NOTES.C5 + i * 25, 0.06, 0.5);
  });
  bell(ctx, master, t0 + 65.4, NOTES.G5, 0.10, 1.2);

  // CTA — D-major brand motif
  [NOTES.D4, NOTES["F#4"], NOTES.A4, NOTES.D5].forEach((f, i) => {
    bell(ctx, master, t0 + 66.2 + i * 0.4, f, 0.15, 2.0);
  });
  [NOTES["F#4"], NOTES.A4, NOTES.D5].forEach((f, i) => {
    bell(ctx, master, t0 + 70.0 + i * 0.32, f, 0.10, 1.4);
  });

  // Final D drone
  const finalOsc = osc(ctx, NOTES.D3, "triangle");
  const finalG = gain(ctx, 0);
  finalOsc.connect(finalG).connect(master);
  finalG.gain.setValueAtTime(0, t0 + 66);
  finalG.gain.linearRampToValueAtTime(0.054, t0 + 66.8);
  finalG.gain.linearRampToValueAtTime(0.044, t0 + 70.5);
  finalG.gain.exponentialRampToValueAtTime(0.0001, t0 + 72);
  finalOsc.start(t0 + 66);
  finalOsc.stop(t0 + 72.1);
};

export default function SenaryoDmoPage() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus · senaryo 20 · altaris × dmo entegrasyonu · genel müdür için"
      timeline={["açılış", "ölçek", "h3.3+h4.4", "altaris", "fiyat", "tedarikçi", "talep", "şartname", "kalite", "hizmet", "sabah", "karar", "brifing", "egemenlik", "kanıt", "pilot"]}
      accentColors={{ from: "#f4a866", via: "#cc6628", to: "#1e2a4a" }}
    >
      {/* SAHNE 1 — Açılış */}
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a8aa8]">/ 1926'dan bugüne · merkezi satınalma</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#f0e6dc]">
              <span className="text-[#f4a866]">e</span><span className="text-[#a8b8d0]">DMO</span> <span className="text-[#5a6a8a] font-extralight">×</span> <span className="grad-text font-medium">Altaris</span>
            </h1>
            <div className="mt-4 text-[clamp(15px,2vw,22px)] text-[#a8b8d0] font-light">
              Tasarruf · şeffaflık · hız — yapay zekâ ile
            </div>
            <div className="mt-6 text-[12px] uppercase tracking-[0.28em] text-[#cc6628]">
              2025-2029 stratejik plan · h 3.3 + h 4.4 · yerli AI ile
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 2 — Ölçek */}
      <section className="scene s2">
        <div className="stage">
          <div className="max-w-5xl w-full">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a8aa8]">/ 2024 · sayılarla DMO</div>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                ["108 mlr ₺", "yıllık satış"],
                ["%32", "kamu mal alım payı"],
                ["39.000", "ürün çeşidi"],
                ["7+4", "bölge + irtibat"],
                ["12 kat", "5 yılda büyüme"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220]/85 px-4 py-3">
                  <div className="text-base font-medium text-[#f4a866]">{v}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[#a8b8d0]">{l}</div>
                </div>
              ))}
            </div>
            <p className="mt-8 max-w-3xl text-sm leading-relaxed text-[#c8c8d0]">
              Sağlık Market · merkezi akaryakıt · TOGG yerli elektrikli · Tekno Katalog ·
              <span className="text-[#f0e6dc]"> büyüyen ölçek, yenilikçi politika</span>.
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 3 — Stratejik kapı */}
      <section className="scene s3">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a8aa8]">/ 2025-2029 stratejik plan</div>
            <h2 className="mt-4 text-[clamp(24px,3.8vw,52px)] font-light leading-[1.18] tracking-tight text-[#f0e6dc]">
              <span className="text-[#f4a866] font-medium">H 3.3</span> · yapay zekâ destekli fiyat analizi<br />
              <span className="text-[#f4a866] font-medium">H 4.4</span> · iş zekâsı · veri yönetişim sistemi
            </h2>
            <p className="mt-6 text-base text-[#a8b8d0]">
              "Belgenizdeki hedef · bizim çözümümüz"
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 4 — Altaris reveal */}
      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#a8b8d0]">
              <span aria-hidden className="size-1.5 rounded-full bg-[#f4a866] animate-pulse" />
              <span>altaris · DMO altyapısına gömülü</span>
              <span className="text-[#3a4868]">·</span>
              <span>on-prem · multi-tenant · RLS</span>
            </div>
            <div className="rounded-md border border-[rgba(244,168,102,0.5)] bg-[#0e1220] p-6">
              <p className="text-base text-[#f0e6dc] font-mono">
                <span className="text-[#f4a866]">▸</span> altaris bind
                <span className="text-[#a8b8d0]"> --tenant=dmo</span>
                <span className="text-[#a8b8d0]"> --esatis-api</span>
                <span className="text-[#a8b8d0]"> --firma-portali</span>
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.22em] text-[#a8b8d0]">
                <span>e-Satış · Firma Portalı API</span>
                <span>tedarikçi sırrı · RLS izole</span>
                <span>audit · şeffaflık · XAI</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 5 — Ajan 1: Fiyat Araştırma & Analiz */}
      <section className="scene s5">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#f4a866]">/ ajan 1 · fiyat araştırma & analiz</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8b8d0]">H 3.3 birebir · 5 satınalma DB</div>
            </div>
            <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-5">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[12px] uppercase tracking-[0.2em] text-[#a8b8d0]">çoklu kaynak tarama</p>
                  <ul className="mt-3 space-y-1 text-[11px] text-[#c8c8d0]">
                    <li>· piyasa fiyatları + EKAP geçmiş ihale</li>
                    <li>· DMO arşivinde benzer alımlar</li>
                    <li>· uluslararası referans karşılaştırma</li>
                    <li>· enflasyon nötrleme</li>
                  </ul>
                </div>
                <div className="rounded-sm border border-[rgba(244,168,102,0.4)] bg-[#1a2030] p-3">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[#f4a866]">çıktı</p>
                  <ul className="mt-2 space-y-1 text-[11px] text-[#c8c8d0]">
                    <li>· tahmini en uygun fiyat aralığı</li>
                    <li>· anomali / suistimal işareti</li>
                    <li>· pazarlık taban-tavan önerisi</li>
                  </ul>
                  <div className="mt-3 text-[10px] text-[#7fb87f]">tasarruf öngörüsü %8-14</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 6 — Ajan 2: Tedarikçi Performans */}
      <section className="scene s6">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#f4a866]">/ ajan 2 · tedarikçi performans</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8b8d0]">tedarikçi & müşteri ilişkileri DB</div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#f4a866]">teslim performansı</div>
                <p className="mt-2 text-[11px] text-[#c8c8d0]">zamanında teslim oranı · gecikme nedenleri</p>
              </div>
              <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#f4a866]">kalite skoru</div>
                <p className="mt-2 text-[11px] text-[#c8c8d0]">kalite kontrol red · numune uyum</p>
              </div>
              <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#f4a866]">finansal sağlık</div>
                <p className="mt-2 text-[11px] text-[#c8c8d0]">açık veri sinyalleri · risk tahmini</p>
              </div>
              <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#f4a866]">sözleşme uyumu</div>
                <p className="mt-2 text-[11px] text-[#c8c8d0]">geçmiş sapma · ceza şartı tetikleme</p>
              </div>
            </div>
            <p className="mt-4 text-[12px] text-[#c8c8d0]">
              ihale öncesi <span className="text-[#f0e6dc]">erken uyarı</span> · görevli memur kararı verir.
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 7 — Ajan 3: Talep Toplama & Kümeleme */}
      <section className="scene s7">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#f4a866]">/ ajan 3 · talep toplama & kümeleme</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8b8d0]">operasyonel süreçler DB · H 1.1</div>
            </div>
            <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-5">
              <p className="text-[12px] uppercase tracking-[0.2em] text-[#a8b8d0]">örnek</p>
              <p className="mt-1 text-[13px] text-[#f0e6dc]">
                Geçen ayın 84 farklı kurumdan gelen "yazıcı toner" talebi → tek bir merkezi alım fırsatı
              </p>
              <div className="my-3 h-px bg-[rgba(244,168,102,0.25)]" />
              <div className="grid grid-cols-3 gap-2 text-[11px] text-[#c8c8d0]">
                <div className="rounded-sm border border-[rgba(244,168,102,0.4)] bg-[#1a2030] px-2 py-2">
                  <div className="text-[9px] uppercase tracking-[0.22em] text-[#f4a866]">otomatik küme</div>
                  <div className="mt-1">kategori · spec · miktar · zaman</div>
                </div>
                <div className="rounded-sm border border-[rgba(244,168,102,0.4)] bg-[#1a2030] px-2 py-2">
                  <div className="text-[9px] uppercase tracking-[0.22em] text-[#f4a866]">mevsimsellik</div>
                  <div className="mt-1">2 yıllık veri · döngü öngörüsü</div>
                </div>
                <div className="rounded-sm border border-[rgba(244,168,102,0.4)] bg-[#1a2030] px-2 py-2">
                  <div className="text-[9px] uppercase tracking-[0.22em] text-[#f4a866]">stok pozisyonu</div>
                  <div className="mt-1">depo + sipariş · optimum eşik</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 8 — Ajan 4: Şartname & Teknik Doküman */}
      <section className="scene s8">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#f4a866]">/ ajan 4 · şartname & teknik doküman</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8b8d0]">5 satınalma DB + kalite kontrol</div>
            </div>
            <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-5">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[12px] uppercase tracking-[0.2em] text-[#a8b8d0]">39.000 ürün emsal bankası</p>
                  <ul className="mt-3 space-y-1 text-[11px] text-[#c8c8d0]">
                    <li>· geçmiş şartnamelerden emsal getir</li>
                    <li>· mevzuat uyumlu taslak üret</li>
                    <li>· spec normalleştirme · standart tutarlılığı</li>
                    <li>· Kalite Kontrol kriterleriyle bağ</li>
                  </ul>
                </div>
                <div>
                  <p className="text-[12px] uppercase tracking-[0.2em] text-[#a8b8d0]">örnek</p>
                  <p className="mt-2 text-[12px] text-[#f0e6dc] italic">
                    "A4 fotokopi kâğıdı · 80g · ISO standardı · yerli üretim öncelikli"
                  </p>
                  <p className="mt-2 text-[10px] text-[#7fb87f]">→ taslak 2 dakikada · uzman düzenler, imzalar</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 9 — Ajan 5: Kalite Kontrol Ön-Denetim */}
      <section className="scene s9">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#f4a866]">/ ajan 5 · kalite kontrol ön-denetim</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8b8d0]">kalite kontrol DB</div>
            </div>
            <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-5">
              <p className="text-[12px] uppercase tracking-[0.2em] text-[#f4a866]">numune ön-değerlendirme · sevkıyat #2026/12847</p>
              <div className="mt-3 grid gap-1.5 text-[12px] md:grid-cols-2">
                <div className="flex items-start gap-2"><span className="text-[#7fb87f]">✓</span><span className="text-[#c8c8d0]">görsel uyum · spec ile %94 eşleşme</span></div>
                <div className="flex items-start gap-2"><span className="text-[#7fb87f]">✓</span><span className="text-[#c8c8d0]">etiket bilgileri tam · standartlara uygun</span></div>
                <div className="flex items-start gap-2"><span className="text-[#e8c878]">⚠</span><span className="text-[#c8c8d0]">ambalaj farkı · görüntü kümesinde flag</span></div>
                <div className="flex items-start gap-2"><span className="text-[#7fb87f]">✓</span><span className="text-[#c8c8d0]">test sonuçları normal aralıkta</span></div>
              </div>
              <div className="my-3 h-px bg-[rgba(244,168,102,0.25)]" />
              <p className="text-[11px] text-[#a8b8d0]">
                rapor uzmana sunulur · <span className="text-[#f0e6dc]">kabul/red kararı uzmanın</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 10 — Ajan 6: Müşteri & Tedarikçi Hizmetleri */}
      <section className="scene s10">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#f4a866]">/ ajan 6 · müşteri & tedarikçi hizmetleri</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8b8d0]">e-Satış + firma portalı içine · 7/24</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#f4a866]">müşteri kuruma</div>
                <p className="mt-2 text-[12px] text-[#f0e6dc]">"Hastanem için tıbbi sarf paketi"</p>
                <ul className="mt-2 space-y-1 text-[11px] text-[#c8c8d0]">
                  <li>· kategori-bazlı satın alma rehberi</li>
                  <li>· sağlık market önerileri</li>
                  <li>· bütçe sınırı uyumlu liste</li>
                </ul>
              </div>
              <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#f4a866]">tedarikçiye</div>
                <p className="mt-2 text-[12px] text-[#f0e6dc]">"katalog başvuru süreci"</p>
                <ul className="mt-2 space-y-1 text-[11px] text-[#c8c8d0]">
                  <li>· adım adım rehber · dosya şablonu</li>
                  <li>· eksik belge uyarısı</li>
                  <li>· otomatik talep sınıflandırma</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 11 — GM masası: sabah özeti */}
      <section className="scene s11">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-3 text-[11px] uppercase tracking-[0.32em] text-[#f4a866]">/ genel müdür masası · 09:00 pazartesi</div>
            <h3 className="text-[clamp(20px,2.6vw,32px)] font-light leading-[1.2] text-[#f0e6dc]">
              Tek bakışta DMO gündemi
            </h3>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8b8d0]">açık ihale</div>
                <div className="mt-2 text-2xl font-light text-[#f0e6dc]">42</div>
                <div className="mt-1 text-[10px] text-[#cc6628]">7'si yüksek tutarlı</div>
              </div>
              <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8b8d0]">tedarikçi risk</div>
                <div className="mt-2 text-2xl font-light text-[#f0e6dc]">3</div>
                <div className="mt-1 text-[10px] text-[#e8c878]">erken uyarı</div>
              </div>
              <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8b8d0]">fiyat anomali</div>
                <div className="mt-2 text-2xl font-light text-[#f0e6dc]">2</div>
                <div className="mt-1 text-[10px] text-[#ff9078]">incelenecek</div>
              </div>
              <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8b8d0]">tasarruf fırsatı</div>
                <div className="mt-2 text-2xl font-light text-[#f0e6dc]">₺ 18 mn</div>
                <div className="mt-1 text-[10px] text-[#7fb87f]">toplu alım önerisi</div>
              </div>
            </div>
            <p className="mt-4 text-[11px] text-[#a8b8d0]">
              gece veriler işlendi · sabah masanızda <span className="text-[#f0e6dc]">öncelik sırası</span> hazır
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 12 — GM masası: karar */}
      <section className="scene s12">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-3 text-[11px] uppercase tracking-[0.32em] text-[#f4a866]">/ ihale dosyası #2026/IH-1284 açılır</div>
            <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[#a8b8d0]">dosya özeti</p>
                  <p className="mt-2 text-[12px] text-[#f0e6dc] leading-relaxed">
                    "Bilişim ürünü merkezi alım · 14 müşteri kurum · tahmini ₺ 86 mn · 6 tedarikçi başvurdu"
                  </p>
                </div>
                <div className="rounded-sm border border-[rgba(244,168,102,0.4)] bg-[#1a2030] p-3">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[#f4a866]">ai ön-değerlendirme</p>
                  <ul className="mt-2 space-y-1 text-[11px] text-[#c8c8d0]">
                    <li><span className="text-[#7fb87f]">✓</span> fiyat aralığı uygun (H 3.3)</li>
                    <li><span className="text-[#7fb87f]">✓</span> tedarikçilerin geçmiş skoru iyi</li>
                    <li><span className="text-[#e8c878]">⚠</span> 1 tedarikçi finansal risk işareti</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-sm border border-[#7fb87f] bg-[#1a2820] px-3 py-2 text-center text-[12px] text-[#7fb87f]">onayla</div>
                <div className="rounded-sm border border-[#e8c878] bg-[#2a2418] px-3 py-2 text-center text-[12px] text-[#e8c878]">ek bilgi iste</div>
                <div className="rounded-sm border border-[#a8b8d0] bg-[#1a2030] px-3 py-2 text-center text-[12px] text-[#a8b8d0]">birime iade</div>
              </div>
              <p className="mt-3 text-[10px] text-[#5a6a8a] text-center">gerekçe + emsal kararlar her seçenek altında · siz düzenler, imzalarsınız</p>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 13 — GM masası: performans / brifing */}
      <section className="scene s13">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-3 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#f4a866]">/ aylık performans · brifinge hazır</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8b8d0]">bakanlık brifing pdf · tek tıkla</div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8b8d0]">tasarruf</div>
                <div className="mt-2 text-xl font-light text-[#f0e6dc]">₺ 142 mn</div>
                <div className="mt-1 text-[10px] text-[#7fb87f]">geçen aya göre +%23</div>
              </div>
              <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8b8d0]">ortalama tedarik</div>
                <div className="mt-2 text-xl font-light text-[#f0e6dc]">11 gün</div>
                <div className="mt-1 text-[10px] text-[#c8c8d0]">önceki dönem 23</div>
              </div>
              <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8b8d0]">en yoğun kategori</div>
                <div className="mt-2 text-xl font-light text-[#f0e6dc]">sağlık</div>
                <div className="mt-1 text-[10px] text-[#c8c8d0]">%41 paya sahip</div>
              </div>
              <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8b8d0]">yerlilik oranı</div>
                <div className="mt-2 text-xl font-light text-[#f0e6dc]">%34</div>
                <div className="mt-1 text-[10px] text-[#7fb87f]">H 2.4 hedefe doğru</div>
              </div>
            </div>
            <div className="mt-4 rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-3">
              <p className="text-[11px] text-[#c8c8d0]">
                <span className="text-[#f4a866]">▸</span> "Sayın bakana brifing özeti hazırla" → 30 saniyede 2 sayfa PDF · grafik + sayısal analiz + 4 stratejik amaç ilerleme.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 14 — Egemenlik */}
      <section className="scene s14">
        <div className="stage">
          <div className="text-center max-w-4xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#a8b8d0]">/ uyum + egemenlik + şeffaflık</div>
            <h2 className="mt-6 text-[clamp(26px,4vw,52px)] font-light leading-[1.18] tracking-tight text-[#f0e6dc]">
              <span className="grad-text font-medium">Karar memurda · veri DMO'da</span><br />
              <span className="text-[#c8c8d0]">— her öneri audit kayıtlı, açıklanabilir</span>
            </h2>
            <div className="mt-8 grid grid-cols-4 gap-3 max-w-3xl mx-auto">
              <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#f4a866]">on-premise</div>
                <div className="mt-1 text-[10px] text-[#c8c8d0]">veri yurt içinde</div>
              </div>
              <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#f4a866]">RLS izole</div>
                <div className="mt-1 text-[10px] text-[#c8c8d0]">tedarikçi sırrı</div>
              </div>
              <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#f4a866]">XAI</div>
                <div className="mt-1 text-[10px] text-[#c8c8d0]">açıklanabilir</div>
              </div>
              <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#f4a866]">audit</div>
                <div className="mt-1 text-[10px] text-[#c8c8d0]">sayıştay-uyum</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 15 — Sayısal vurgu */}
      <section className="scene s15">
        <div className="stage">
          <div className="text-center max-w-4xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#a8b8d0]">/ DMO temel değerlerle uyum</div>
            <div className="mt-6 grid grid-cols-3 gap-4 max-w-3xl mx-auto">
              <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8b8d0]">tasarruf</div>
                <div className="mt-2 text-2xl font-light text-[#f4a866]">%8-14</div>
                <div className="mt-1 text-[10px] text-[#5a6a8a]">fiyat analizi tahmini</div>
              </div>
              <div className="rounded-md border-2 border-[#f4a866] bg-[#0e1220] px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#f4a866]">hız</div>
                <div className="mt-2 text-2xl font-light text-[#f0e6dc]">23 → 11 gün</div>
                <div className="mt-1 text-[10px] text-[#cc6628]">tedarik döngüsü</div>
              </div>
              <div className="rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8b8d0]">şeffaflık</div>
                <div className="mt-2 text-2xl font-light text-[#f4a866]">%100</div>
                <div className="mt-1 text-[10px] text-[#5a6a8a]">audit + XAI</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 16 — CTA */}
      <section className="scene s16">
        <div className="stage">
          <div className="w-full max-w-4xl text-center">
            <div className="text-[12px] uppercase tracking-[0.36em] text-[#f4a866] font-medium">
              eDMO × Altaris
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.32em] text-[#a8b8d0]">
              gelenekten geleceğe yenilikçi dönüşüm
            </div>

            <div className="mt-8 mx-auto max-w-2xl rounded-md border border-[rgba(244,168,102,0.45)] bg-[#0e1220] p-5">
              <p className="text-[13px] text-[#c8c8d0] leading-relaxed">
                <span className="text-[#f0e6dc]">Tek bir ajanla başlayın</span> — önerimiz <span className="text-[#f4a866]">Fiyat Araştırma & Analiz</span> (H 3.3 birebir).
                30 gün on-prem pilot · sıfır maliyet · memnun kalmazsanız kapatırız.
              </p>
            </div>

            <pre aria-label="Argus" className="grad-shimmer mx-auto mt-8 select-none whitespace-pre font-bold leading-[1.05] tracking-[0.04em] text-[clamp(11px,1.4vw,17px)]">
{`█▀█   █▀▄   █▀▀   █   █   █▀▀
█▀█   █▀▄   █ █   █   █   ▀▀█
▀ ▀   ▀ ▀   ▀▀▀   ▀▀▀▀▀   ▀▀▀`}
            </pre>
            <div className="mx-auto mt-6 inline-flex items-center gap-4 rounded-md border border-[#f4a866] bg-[#f4a866] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ pilot</span>
              <span className="font-medium">innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-20-altaris-dmo-entegrasyon" label="senaryo 20 · altaris × dmo entegrasyon" />
    </SenaryoStage>
  );
}
