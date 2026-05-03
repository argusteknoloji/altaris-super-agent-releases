"use client";

// ─────────────────────────────────────────────────────────────────
// Senaryo 21 — PUSULA Çerçevesi · Kamu Sektörü Üst-Anlatısı
// 78 sn · 17 sahne · live emerald → deep navy
// Mood: live monitoring + executive insight + dignified building
// ─────────────────────────────────────────────────────────────────

import { SenaryoPlayer, type ScheduleFn } from "../_lib/SenaryoPlayer";
import { SenaryoStage } from "../_lib/SenaryoStage";
import { bell, gain, heartbeat, lfo, masterEnv, NOTES, osc, pad } from "../_lib/audio";

const TOTAL = 78;
const SCENE_TIMINGS = [
  [0, 3],     // 1 açılış
  [3, 4],     // 2 sorun
  [7, 3],     // 3 slogan
  [10, 3],    // 4 reveal · 6 yön
  [13, 4],    // 5 4 katman
  [17, 4],    // 6 3 adım
  [21, 4],    // 7 veri kaynakları
  [25, 5],    // 8 yönetici beyni
  [30, 5],    // 9 ai çalışan · 8 rol
  [35, 5],    // 10 mali senaryo
  [40, 5],    // 11 karar öncesi gör
  [45, 5],    // 12 mevzuat & hafıza
  [50, 5],    // 13 verimlilik karşılaştırma
  [55, 4],    // 14 güvenlik & yerlilik
  [59, 6],    // 15 kazanım tablosu
  [65, 6],    // 16 uygulama 3 faz
  [71, 7],    // 17 cta
] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });

  // F major executive pad — live, building
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.F2, NOTES.C3, NOTES.F3, NOTES.A3], [
    [0, 0],
    [2, 0.022],
    [10, 0.024],
    [13, 0.026],
    [25, 0.028],
    [50, 0.030],
    [59, 0.032],
    [71, 0.034],
    [77.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.15, 0.005, TOTAL, t0);

  // Heartbeat 1.6sn (executive)
  const beats: number[] = [];
  for (let t = 1.6; t < 71; t += 1.6) beats.push(t);
  beats.forEach((t, i) => {
    heartbeat(ctx, master, t0 + t, i % 4 === 0 ? 0.20 : 0.10);
  });

  // Sahne 1 — açılış (compass ping: F + brand D hint)
  bell(ctx, master, t0 + 0.4, NOTES.F4, 0.10, 1.6);
  bell(ctx, master, t0 + 1.4, NOTES.D5, 0.08, 1.4);

  // Sahne 2 — sorun: descending concern
  [3.4, 4.2, 5.0, 5.8].forEach((t, i) => {
    const notes = [NOTES.C5, NOTES.A4, NOTES.F4, NOTES.C4];
    bell(ctx, master, t0 + t, notes[i], 0.10, 1.3);
  });

  // Sahne 3 — slogan: 3-tone reflection
  bell(ctx, master, t0 + 7.3, NOTES.A4, 0.11, 1.5);
  bell(ctx, master, t0 + 8.1, NOTES.C5, 0.10, 1.5);
  bell(ctx, master, t0 + 8.9, NOTES.F4 * 2, 0.10, 1.6);

  // Sahne 4 — reveal: D-major brand motif
  bell(ctx, master, t0 + 10.2, NOTES.D3, 0.13, 1.7);
  [10.6, 11.0, 11.4, 11.8, 12.2].forEach((t, i) => {
    const notes = [NOTES.D4, NOTES["F#4"], NOTES.A4, NOTES.D5, NOTES["F#4"] * 2];
    bell(ctx, master, t0 + t, notes[i], 0.10, 1.2);
  });

  // Sahne 5 — 4 katman: 4 ascending bells (mimari)
  [13.3, 14.3, 15.3, 16.3].forEach((t, i) => {
    const notes = [NOTES.F4, NOTES.A4, NOTES.C5, NOTES.F4 * 2];
    bell(ctx, master, t0 + t, notes[i], 0.11, 1.4);
  });

  // Sahne 6 — 3 adım: 3 deliberate (read · connect · remember)
  bell(ctx, master, t0 + 17.3, NOTES.F4, 0.11, 1.4);
  bell(ctx, master, t0 + 18.6, NOTES.A4, 0.11, 1.4);
  bell(ctx, master, t0 + 19.9, NOTES.C5, 0.11, 1.5);

  // Sahne 7 — veri kaynakları: rapid integration ticks
  for (let t = 21.3; t < 24.5; t += 0.4) {
    bell(ctx, master, t0 + t, NOTES.G5 + Math.random() * 80, 0.05, 0.4);
  }

  // Sahne 8 — yönetici beyni: deep, weighty (Executive Brain)
  bell(ctx, master, t0 + 25.4, NOTES.F2, 0.16, 2.0);
  bell(ctx, master, t0 + 26.7, NOTES.C3, 0.13, 1.7);
  bell(ctx, master, t0 + 28.0, NOTES.F3, 0.12, 1.5);
  bell(ctx, master, t0 + 29.2, NOTES.A3, 0.10, 1.3);

  // Sahne 9 — AI çalışan: 8 rol — 8 quick bells (octave grid)
  [30.3, 30.7, 31.1, 31.5, 32.0, 32.4, 32.8, 33.2].forEach((t, i) => {
    const notes = [NOTES.F4, NOTES.A4, NOTES.C5, NOTES.E5, NOTES.F4 * 2, NOTES.A4 * 2, NOTES.C5 * 2 / 2, NOTES.E5];
    bell(ctx, master, t0 + t, notes[i % notes.length], 0.07, 0.9);
  });
  bell(ctx, master, t0 + 34.0, NOTES.F4 * 2, 0.10, 1.2);

  // Sahne 10 — mali senaryo: methodical analysis
  bell(ctx, master, t0 + 35.4, NOTES.F4, 0.11, 1.4);
  bell(ctx, master, t0 + 36.6, NOTES.A4, 0.10, 1.3);
  bell(ctx, master, t0 + 37.8, NOTES.C5, 0.10, 1.3);
  bell(ctx, master, t0 + 39.0, NOTES.F4 * 2, 0.10, 1.3);

  // Sahne 11 — karar öncesi gör: building anticipation
  bell(ctx, master, t0 + 40.3, NOTES.D4, 0.11, 1.4);
  bell(ctx, master, t0 + 41.3, NOTES["F#4"], 0.11, 1.4);
  bell(ctx, master, t0 + 42.3, NOTES.A4, 0.11, 1.4);
  bell(ctx, master, t0 + 43.3, NOTES.D5, 0.11, 1.4);
  bell(ctx, master, t0 + 44.3, NOTES["F#4"] * 2, 0.10, 1.3);

  // Sahne 12 — mevzuat & hafıza: ancient bell (memory)
  bell(ctx, master, t0 + 45.4, NOTES.C3, 0.15, 1.9);
  bell(ctx, master, t0 + 46.7, NOTES.F3, 0.13, 1.7);
  bell(ctx, master, t0 + 48.0, NOTES.A3, 0.12, 1.5);
  bell(ctx, master, t0 + 49.2, NOTES.C4, 0.10, 1.3);

  // Sahne 13 — verimlilik: contrast (low → high)
  bell(ctx, master, t0 + 50.3, NOTES.F3, 0.12, 1.6);
  bell(ctx, master, t0 + 51.0, NOTES.F4, 0.12, 1.5);
  bell(ctx, master, t0 + 51.7, NOTES.A4, 0.11, 1.4);
  bell(ctx, master, t0 + 52.4, NOTES.C5, 0.11, 1.4);
  bell(ctx, master, t0 + 53.2, NOTES.F4 * 2, 0.10, 1.3);
  bell(ctx, master, t0 + 54.0, NOTES.A4 * 2, 0.10, 1.2);

  // Sahne 14 — güvenlik: low warm sustain (security)
  bell(ctx, master, t0 + 55.3, NOTES.F3, 0.14, 1.8);
  bell(ctx, master, t0 + 56.5, NOTES.C4, 0.12, 1.6);
  bell(ctx, master, t0 + 57.7, NOTES.F4, 0.10, 1.4);

  // Sahne 15 — kazanım tablosu: 8 boyut · 8 ascending bells
  [59.3, 59.9, 60.5, 61.1, 61.7, 62.3, 62.9, 63.5].forEach((t, i) => {
    const notes = [NOTES.F4, NOTES.A4, NOTES.C5, NOTES.E5, NOTES.G5, NOTES.A4 * 2, NOTES.C5 * 2 / 2, NOTES.E5];
    bell(ctx, master, t0 + t, notes[i % notes.length], 0.08, 1.0);
  });
  bell(ctx, master, t0 + 64.4, NOTES.F4 * 2, 0.11, 1.4);

  // Sahne 16 — 3 faz: 3 distinct phase markers
  bell(ctx, master, t0 + 65.3, NOTES.D3, 0.13, 1.8);
  bell(ctx, master, t0 + 67.3, NOTES.F4, 0.12, 1.6);
  bell(ctx, master, t0 + 69.3, NOTES.A4, 0.11, 1.4);
  bell(ctx, master, t0 + 70.5, NOTES.D5, 0.11, 1.3);

  // Sahne 17 — CTA: D-major pentatonic brand motif (FORTE) + echo
  [NOTES.D4, NOTES["F#4"], NOTES.A4, NOTES.D5].forEach((f, i) => {
    bell(ctx, master, t0 + 71.3 + i * 0.42, f, 0.16, 2.1);
  });
  [NOTES["F#4"], NOTES.A4, NOTES.D5].forEach((f, i) => {
    bell(ctx, master, t0 + 75.0 + i * 0.36, f, 0.10, 1.5);
  });

  // Final D drone (brand sustain)
  const finalOsc = osc(ctx, NOTES.D3, "triangle");
  const finalG = gain(ctx, 0);
  finalOsc.connect(finalG).connect(master);
  finalG.gain.setValueAtTime(0, t0 + 71);
  finalG.gain.linearRampToValueAtTime(0.056, t0 + 71.8);
  finalG.gain.linearRampToValueAtTime(0.044, t0 + 76);
  finalG.gain.exponentialRampToValueAtTime(0.0001, t0 + 78);
  finalOsc.start(t0 + 71);
  finalOsc.stop(t0 + 78.1);
};

export default function SenaryoPusulaPage() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus · senaryo 21 · pusula çerçevesi · kamu için yapay zeka destekli yönetim"
      timeline={["açılış", "sorun", "slogan", "pusula", "katman", "adım", "veri", "beyin", "ai", "mali", "karar", "hafıza", "verimlilik", "güvenlik", "kazanım", "uygulama", "pilot"]}
      accentColors={{ from: "#9be8c8", via: "#3a9c78", to: "#0a3848" }}
    >
      {/* SAHNE 1 — Açılış */}
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#5a8898]">/ argus teknoloji · kamu sektörü çerçevesi</div>
            <h1 className="mt-3 text-[clamp(40px,5.5vw,80px)] font-light leading-[1.0] tracking-tight text-[#e0f0e8]">
              <span className="text-[#9be8c8]">⌖</span> <span className="grad-text font-medium">PUSULA</span>
            </h1>
            <div className="mt-3 text-[clamp(15px,2vw,22px)] text-[#9bb8b0] font-light">
              Kamu Kurumları için Yapay Zekâ Destekli Yönetim Çerçevesi
            </div>
            <div className="mt-6 text-[12px] uppercase tracking-[0.28em] text-[#3a9c78]">
              kurumsal dijital mimari · canlı, ölçen, öğrenen
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 2 — Sorun */}
      <section className="scene s2">
        <div className="stage">
          <div className="max-w-5xl w-full">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#5a8898]">/ kurumda her gün</div>
            <h2 className="mt-3 text-[clamp(20px,2.6vw,32px)] font-light leading-[1.2] text-[#e0f0e8]">
              Yöneticinin <span className="text-[#9be8c8]">%40+</span> zamanı bilgi toplamada
            </h2>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                ["🔍", "Kurumda gerçekten ne oluyor?"],
                ["⚠", "Bu riski neden önceden göremedik?"],
                ["🧠", "3 yıl önce ne kararlaştırılmıştı?"],
                ["⏱", "Bakanlığa rapor için hazırlık şart"],
              ].map(([icon, q], i) => (
                <div key={i} className="rounded-md border border-[rgba(155,232,200,0.35)] bg-[#0a1820]/85 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#9be8c8]">{icon}</div>
                  <div className="mt-1 text-[12px] text-[#e0f0e8] italic">"{q}"</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 3 — Slogan */}
      <section className="scene s3">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <h2 className="text-[clamp(28px,4.4vw,60px)] font-light leading-[1.2] tracking-tight text-[#e0f0e8]">
              <span className="text-[#3a5868]">"</span>
              Pusulası olmayan kurum,<br />
              <span className="grad-text font-medium">hangi yöne gittiğini bilemez</span>.
              <span className="text-[#3a5868]">"</span>
            </h2>
          </div>
        </div>
      </section>

      {/* SAHNE 4 — PUSULA reveal · 6 yön */}
      <section className="scene s4">
        <div className="stage">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.32em] text-[#9be8c8]">⌖ pusula · altı yön</div>
            <div className="relative mt-6 mx-auto" style={{ width: 360, height: 360 }}>
              <div className="absolute inset-0 rounded-full border border-[rgba(155,232,200,0.35)]" />
              <div className="absolute inset-12 rounded-full border border-[rgba(155,232,200,0.20)]" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <div className="text-[14px] font-medium text-[#9be8c8]">PUSULA</div>
                <div className="mt-1 text-[9px] uppercase tracking-[0.22em] text-[#5a8898]">kurumsal mimari</div>
              </div>
              {[
                ["YÖN", "0%", "10%"],
                ["SÜREÇ", "85%", "30%"],
                ["VERİ", "85%", "70%"],
                ["SİSTEM", "50%", "85%"],
                ["GÜVENLİK", "15%", "70%"],
                ["VATANDAŞ", "15%", "30%"],
              ].map(([label, x, y]) => (
                <div key={label} className="absolute" style={{ left: x, top: y, transform: "translate(-50%,-50%)" }}>
                  <div className="rounded-full border border-[#9be8c8] bg-[#0a1820] px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-[#9be8c8]">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 5 — 4 katman */}
      <section className="scene s5">
        <div className="stage">
          <div className="max-w-5xl w-full">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#9be8c8]">/ pusula · dört katman · kamu yorumu</div>
            <div className="mt-5 space-y-2">
              {[
                ["İş Mimarisi", "Süreçler", "PROMISE BPM"],
                ["Bilgi Mimarisi", "Veri", "Altaris SuperAgent"],
                ["Uygulama Mimarisi", "Sistemler", "PROMISE Orkestrasyon"],
                ["Teknoloji Mimarisi", "Altyapı", "On-Prem / Hybrid · BTK · KVKK"],
              ].map(([t, s, p]) => (
                <div key={t} className="grid grid-cols-3 gap-3 rounded-md border border-[rgba(155,232,200,0.35)] bg-[#0a1820] px-4 py-2.5">
                  <div className="text-[12px] font-medium text-[#e0f0e8]">{t}</div>
                  <div className="text-[11px] text-[#9bb8b0]">{s}</div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#9be8c8] text-right">{p}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 6 — 3 adım */}
      <section className="scene s6">
        <div className="stage">
          <div className="max-w-5xl w-full">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#9be8c8]">/ üç adımda anlayın · teknik detay gerekmez</div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                ["01", "Her Şeyi Oku", "EBYS · mali · İK · e-Devlet · EKAP · mevzuat · sözleşme · toplantı"],
                ["02", "Bağlantıları Kur", "bütçe sapması + personel yorgunluğu + proje gecikmesi → gizli ilişki"],
                ["03", "Hiçbir Şeyi Unutma", "5 yıl önceki karar · imzalanan protokol · atamalardan bağımsız"],
              ].map(([n, t, d]) => (
                <div key={n} className="relative rounded-md border border-[rgba(155,232,200,0.35)] bg-[#0a1820] p-4">
                  <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-[#3a9c78]" />
                  <div className="text-[10px] uppercase tracking-[0.28em] text-[#9be8c8]">/{n}</div>
                  <div className="mt-2 text-[13px] font-medium text-[#e0f0e8]">{t}</div>
                  <p className="mt-2 text-[11px] text-[#9bb8b0]">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 7 — Veri kaynakları */}
      <section className="scene s7">
        <div className="stage">
          <div className="max-w-5xl w-full">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#9be8c8]">/ bağlandığı kamu veri kaynakları</div>
            <div className="mt-5 grid grid-cols-4 gap-2">
              {[
                ["EBYS", "belge yönetimi"],
                ["Mali Sistem", "KBS · bütçe"],
                ["İK Sistemi", "personel"],
                ["e-Devlet", "entegrasyon"],
                ["EKAP", "ihale"],
                ["Mevzuat", "veritabanı"],
                ["Toplantı", "tutanak"],
                ["Vatandaş", "CIMER · talep"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border border-[rgba(155,232,200,0.35)] bg-[#0a1820] px-3 py-3 text-center">
                  <div className="text-[12px] font-medium text-[#9be8c8]">{k}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[#5a8898]">{v}</div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-[#9bb8b0]">
              <span className="text-[#9be8c8]">Mevcut sistemleri değiştirmiyoruz</span> — Altaris üzerine oturur, veri dışarı çıkmaz.
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 8 — Yönetici Beyni */}
      <section className="scene s8">
        <div className="stage">
          <div className="max-w-5xl w-full">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#9be8c8]">/ bileşen 1 · executive brain</div>
            <h3 className="mt-3 text-[clamp(20px,2.6vw,32px)] font-light leading-[1.2] text-[#e0f0e8]">
              Yönetici Beyni — Kurum hafızası ve içgörü motoru
            </h3>
            <div className="mt-5 rounded-md border border-[rgba(155,232,200,0.35)] bg-[#0a1820] p-5">
              <p className="text-[12px] text-[#9bb8b0] italic">
                "Bu çeyrekte hangi birimde bütçe sapması en yüksek?"
              </p>
              <div className="my-3 h-px bg-[rgba(155,232,200,0.2)]" />
              <p className="text-[12px] text-[#9be8c8]">⌖ Türkçe doğal dil sorgu → anlık ilişkisel cevap</p>
              <p className="mt-2 text-[11px] text-[#9bb8b0]">
                Mali sistem + ödeme emirleri + harcama kalemleri birleşir · birim bazlı sapma analizi · tertip kullanım · saniyeler içinde.
              </p>
            </div>
            <p className="mt-3 text-[10px] uppercase tracking-[0.28em] text-[#5a8898]">
              kurumun "düşünen beyni" · genel müdür ve yardımcılarına
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 9 — Yapay Zeka Çalışan · 8 hazır rol */}
      <section className="scene s9">
        <div className="stage">
          <div className="max-w-5xl w-full">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#9be8c8]">/ bileşen 2 · ai personnel · dijital işgücü</div>
            <h3 className="mt-2 text-[clamp(18px,2.2vw,28px)] font-light leading-[1.2] text-[#e0f0e8]">
              Sekiz hazır rol · birimlerinizin dijital üyesi
            </h3>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {[
                ["⚖", "Mevzuat Tarama"],
                ["📋", "Evrak İşleme"],
                ["📦", "İhale & EKAP"],
                ["💰", "Mali Mutabakat"],
                ["📊", "Raporlama"],
                ["👥", "İK Asistanı"],
                ["🏛", "Vatandaş Talep"],
                ["📅", "Yönetici Asistanı"],
              ].map(([icon, label]) => (
                <div key={label} className="rounded-md border border-[rgba(155,232,200,0.35)] bg-[#0a1820] px-3 py-3">
                  <div className="text-base">{icon}</div>
                  <div className="mt-1 text-[11px] font-medium text-[#e0f0e8]">{label}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-[#9bb8b0]">
              7/24 · paralel · kalıcı hafızalı — <span className="text-[#9be8c8]">personelin yerine değil yanında</span>
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 10 — Mali senaryo */}
      <section className="scene s10">
        <div className="stage">
          <div className="max-w-5xl w-full">
            <div className="mb-3 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#9be8c8]">/ senaryo · mali yönetim</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#5a8898]">anlık doğal dil sorgu</div>
            </div>
            <div className="rounded-md border border-[rgba(155,232,200,0.35)] bg-[#0a1820] p-5">
              <p className="text-[12px] uppercase tracking-[0.2em] text-[#5a8898]">soru</p>
              <p className="mt-1 text-[14px] text-[#e0f0e8] italic">
                "Bu çeyrekte hangi birimde bütçe sapması en yüksek?"
              </p>
              <div className="my-3 h-px bg-[rgba(155,232,200,0.2)]" />
              <p className="text-[12px] uppercase tracking-[0.2em] text-[#9be8c8]">cevap · 4 saniyede</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-sm border border-[rgba(155,232,200,0.35)] bg-[#142830] p-2">
                  <div className="text-[9px] uppercase tracking-[0.22em] text-[#ff9078]">en yüksek</div>
                  <div className="mt-1 text-[#e0f0e8]">İdari Hizmetler · +%24</div>
                </div>
                <div className="rounded-sm border border-[rgba(155,232,200,0.35)] bg-[#142830] p-2">
                  <div className="text-[9px] uppercase tracking-[0.22em] text-[#9be8c8]">neden</div>
                  <div className="mt-1 text-[#e0f0e8]">akaryakıt · 03 tertip</div>
                </div>
                <div className="rounded-sm border border-[rgba(155,232,200,0.35)] bg-[#142830] p-2">
                  <div className="text-[9px] uppercase tracking-[0.22em] text-[#7fb87f]">tasarruf alanı</div>
                  <div className="mt-1 text-[#e0f0e8]">Kültür birimi · -%18</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 11 — Karar Öncesi Gör */}
      <section className="scene s11">
        <div className="stage">
          <div className="max-w-5xl w-full">
            <div className="mb-3 text-[11px] uppercase tracking-[0.32em] text-[#9be8c8]">/ senaryo modu · "karar öncesi gör"</div>
            <div className="rounded-md border border-[rgba(155,232,200,0.35)] bg-[#0a1820] p-5">
              <p className="text-[12px] uppercase tracking-[0.2em] text-[#5a8898]">genel müdürün sorusu</p>
              <p className="mt-1 text-[13px] text-[#e0f0e8] italic">
                "Yeni vatandaş hizmet noktasını bu ilçeye açarsam — 6 ay sonra personel ihtiyacım, bütçe yansıması ve hizmet kapasitem ne olur?"
              </p>
              <div className="my-3 h-px bg-[rgba(155,232,200,0.2)]" />
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-sm border border-[rgba(155,232,200,0.35)] bg-[#142830] p-3">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#9be8c8]">senaryo 1 · tam kadro</div>
                  <ul className="mt-2 space-y-0.5 text-[11px] text-[#9bb8b0]">
                    <li>kapasite: 180 vatandaş/gün</li>
                    <li>personel: +6</li>
                    <li>bütçe: +2.4 mn ₺</li>
                  </ul>
                </div>
                <div className="rounded-sm border-2 border-[#9be8c8] bg-[#142830] p-3">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#9be8c8]">senaryo 2 · pilot · önerilen</div>
                  <ul className="mt-2 space-y-0.5 text-[11px] text-[#9bb8b0]">
                    <li>kapasite: 110 vatandaş/gün</li>
                    <li>personel: +3 (rotasyon)</li>
                    <li>bütçe: +1.1 mn ₺</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 12 — Mevzuat & Hafıza */}
      <section className="scene s12">
        <div className="stage">
          <div className="max-w-5xl w-full">
            <div className="mb-3 text-[11px] uppercase tracking-[0.32em] text-[#9be8c8]">/ senaryo · kurumsal hafıza</div>
            <div className="rounded-md border border-[rgba(155,232,200,0.35)] bg-[#0a1820] p-5">
              <p className="text-[12px] uppercase tracking-[0.2em] text-[#5a8898]">soru</p>
              <p className="mt-1 text-[13px] text-[#e0f0e8] italic">
                "2022'de bu konuda hangi karar alınmıştı, neden?"
              </p>
              <div className="my-3 h-px bg-[rgba(155,232,200,0.2)]" />
              <p className="text-[12px] uppercase tracking-[0.2em] text-[#9be8c8]">altaris yanıtı</p>
              <ul className="mt-2 space-y-1 text-[11px] text-[#9bb8b0]">
                <li>· 14 Mart 2022 yönetim kurulu kararı #2022/47</li>
                <li>· O dönem makamlar arası yazışma · 3 ek belge</li>
                <li>· Toplantı tutanağı + gerekçe</li>
                <li>· O dönemki yönetici görevden ayrılmış · bilgi sistemde</li>
              </ul>
            </div>
            <p className="mt-3 text-[10px] uppercase tracking-[0.28em] text-[#5a8898]">
              kurumsal hafıza atamalardan bağımsız · kalıcı, sorgulanabilir
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 13 — Verimlilik karşılaştırması */}
      <section className="scene s13">
        <div className="stage">
          <div className="max-w-5xl w-full">
            <div className="mb-3 text-[11px] uppercase tracking-[0.32em] text-[#9be8c8]">/ verimlilik · geleneksel ↔ ai destekli</div>
            <div className="rounded-md border border-[rgba(155,232,200,0.35)] bg-[#0a1820] overflow-hidden">
              <div className="grid grid-cols-3 text-[10px] uppercase tracking-[0.22em] bg-[#142830] px-3 py-2 text-[#5a8898]">
                <div>kriter</div><div>geleneksel</div><div>yapay zekâ destekli</div>
              </div>
              {[
                ["çalışma süresi", "mesai saatleri", "7/24 kesintisiz"],
                ["eş zamanlılık", "1 kişi = 1 görev", "yüzlerce paralel"],
                ["kurumsal hafıza", "atamada kaybolur", "kalıcı"],
                ["hata oranı", "insan dikkati", "standart, denetlenebilir"],
                ["kapsam", "sınırlı belge", "sınırsız çoklu kaynak"],
              ].map(([k, l, r]) => (
                <div key={k} className="grid grid-cols-3 px-3 py-1.5 text-[11px] border-t border-[rgba(155,232,200,0.15)]">
                  <div className="text-[#9bb8b0]">{k}</div>
                  <div className="text-[#5a8898]">{l}</div>
                  <div className="text-[#e0f0e8]">{r}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 14 — Güvenlik & yerlilik */}
      <section className="scene s14">
        <div className="stage">
          <div className="text-center max-w-4xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#5a8898]">/ veriniz kurumunuzdan çıkmaz</div>
            <h2 className="mt-4 text-[clamp(22px,3.4vw,42px)] font-light leading-[1.18] tracking-tight text-[#e0f0e8]">
              <span className="grad-text font-medium">Sistem yerli · yazılım Türkçe</span>
            </h2>
            <div className="mt-6 grid grid-cols-4 gap-3 max-w-3xl mx-auto">
              <div className="rounded-md border border-[rgba(155,232,200,0.35)] bg-[#0a1820] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#9be8c8]">yerli</div>
                <div className="mt-1 text-[10px] text-[#9bb8b0]">argus a.ş.</div>
              </div>
              <div className="rounded-md border border-[rgba(155,232,200,0.35)] bg-[#0a1820] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#9be8c8]">KVKK</div>
                <div className="mt-1 text-[10px] text-[#9bb8b0]">6698 uyumlu</div>
              </div>
              <div className="rounded-md border border-[rgba(155,232,200,0.35)] bg-[#0a1820] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#9be8c8]">on-prem</div>
                <div className="mt-1 text-[10px] text-[#9bb8b0]">veri çıkışı yok</div>
              </div>
              <div className="rounded-md border border-[rgba(155,232,200,0.35)] bg-[#0a1820] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#9be8c8]">ISO 27001</div>
                <div className="mt-1 text-[10px] text-[#9bb8b0]">sayıştay-uyum</div>
              </div>
            </div>
            <p className="mt-4 text-[10px] uppercase tracking-[0.22em] text-[#5a8898]">
              BTK bulut bilişim · cumhurbaşkanlığı DDO rehberleri · sayıştay denetimi
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 15 — Kazanım tablosu */}
      <section className="scene s15">
        <div className="stage">
          <div className="max-w-5xl w-full">
            <div className="mb-3 text-[11px] uppercase tracking-[0.32em] text-[#9be8c8]">/ pusula kurumunuza ne kazandırır · 8 boyut</div>
            <div className="rounded-md border border-[rgba(155,232,200,0.35)] bg-[#0a1820] overflow-hidden">
              <div className="grid grid-cols-3 text-[10px] uppercase tracking-[0.22em] bg-[#142830] px-3 py-1.5 text-[#5a8898]">
                <div>boyut</div><div>bugün</div><div>pusula ile</div>
              </div>
              {[
                ["karar süresi", "haftalar", "saatler"],
                ["kurumsal hafıza", "sıfırlanır", "kalıcı"],
                ["bakanlık raporu", "elle toplama", "otomatik · anlık"],
                ["risk yönetimi", "sorun büyüyünce", "erken uyarı"],
                ["vatandaş hizmeti", "sistemler arası kayıp", "uçtan uca"],
                ["personel verimi", "%40+ raporlama", "katma değerli iş"],
                ["mevzuat uyumu", "geç fark", "anlık etki analizi"],
                ["denetim hazırlığı", "sayıştay öncesi yoğun", "her an hazır"],
              ].map(([k, l, r]) => (
                <div key={k} className="grid grid-cols-3 px-3 py-1 text-[10px] border-t border-[rgba(155,232,200,0.15)]">
                  <div className="text-[#9bb8b0]">{k}</div>
                  <div className="text-[#5a8898]">{l}</div>
                  <div className="text-[#e0f0e8]">{r}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SAHNE 16 — Uygulama 3 faz */}
      <section className="scene s16">
        <div className="stage">
          <div className="max-w-5xl w-full">
            <div className="mb-3 text-[11px] uppercase tracking-[0.32em] text-[#9be8c8]">/ uygulama yaklaşımı · 6-10 hafta</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border border-[rgba(155,232,200,0.35)] bg-[#0a1820] p-4">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#9be8c8]">faz 1</div>
                <div className="mt-2 text-[14px] font-medium text-[#e0f0e8]">Kapsam & Hedef</div>
                <p className="mt-2 text-[11px] text-[#9bb8b0]">Öncelikli birim · veri kaynakları · KPI'lar · genel müdür beklentilerine göre öncelik haritası</p>
              </div>
              <div className="rounded-md border border-[rgba(155,232,200,0.35)] bg-[#0a1820] p-4">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#9be8c8]">faz 2</div>
                <div className="mt-2 text-[14px] font-medium text-[#e0f0e8]">Devreye Alma</div>
                <p className="mt-2 text-[11px] text-[#9bb8b0]">On-premise kurulum · güvenli entegrasyon · KVKK + yetki · ilk yapay zekâ çalışanlar</p>
              </div>
              <div className="rounded-md border border-[rgba(155,232,200,0.35)] bg-[#0a1820] p-4">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#9be8c8]">faz 3</div>
                <div className="mt-2 text-[14px] font-medium text-[#e0f0e8]">Değer & Yaygınlaştırma</div>
                <p className="mt-2 text-[11px] text-[#9bb8b0]">Yönetici eğitimi · Türkçe sorgu · kazanım raporu · diğer birimlere yol haritası</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-[#9bb8b0]">
              <span className="text-[#9be8c8]">Kademeli yaklaşım</span> — her kurum farklı; süreç ve takvim büyüklüğe göre birlikte tasarlanır
            </p>
          </div>
        </div>
      </section>

      {/* SAHNE 17 — CTA */}
      <section className="scene s17">
        <div className="stage">
          <div className="w-full max-w-4xl text-center">
            <div className="text-[12px] uppercase tracking-[0.36em] text-[#9be8c8] font-medium">
              ⌖ PUSULA
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.32em] text-[#5a8898]">
              kurumsal dijital mimari · canlı, ölçen, öğrenen
            </div>

            <div className="mt-8 mx-auto max-w-2xl rounded-md border border-[rgba(155,232,200,0.35)] bg-[#0a1820] p-5">
              <p className="text-[13px] text-[#9bb8b0] leading-relaxed">
                <span className="text-[#e0f0e8]">Pusulanızı kurun</span> — tek birim, tek hedef, 6-10 hafta · sıfır maliyetli on-prem pilot. Memnun kalmazsanız kapatırız.
              </p>
            </div>

            <div className="mt-6 flex justify-center gap-2 text-[9px] uppercase tracking-[0.22em] text-[#5a8898]">
              <span>Diyanet</span><span>·</span><span>YEĞİTEK</span><span>·</span><span>DMO</span><span>·</span><span>kurumunuz?</span>
            </div>

            <pre aria-label="Argus" className="grad-shimmer mx-auto mt-6 select-none whitespace-pre font-bold leading-[1.05] tracking-[0.04em] text-[clamp(11px,1.4vw,17px)]">
{`█▀█   █▀▄   █▀▀   █   █   █▀▀
█▀█   █▀▄   █ █   █   █   ▀▀█
▀ ▀   ▀ ▀   ▀▀▀   ▀▀▀▀▀   ▀▀▀`}
            </pre>
            <div className="mx-auto mt-6 inline-flex items-center gap-4 rounded-md border border-[#9be8c8] bg-[#9be8c8] px-7 py-4 text-[#0a1820]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ pilot</span>
              <span className="font-medium">innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-21-pusula-cerceve" label="senaryo 21 · pusula çerçevesi" />
    </SenaryoStage>
  );
}
