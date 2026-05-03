"use client";

// ─────────────────────────────────────────────────────────────────
// SHOWCASE — Altaris SuperAgent platform yeteneklerinin özet videosu.
// Senaryo formatı korundu (6 sahne · 22 sn · müzik), ama belirli bir
// hikaye değil — "ne yapar / nasıl yapar / nereye girer / nasıl güvenir"
// 4 katmanlı tanıtım. Cinematic premium reveal · D major heroic.
// ─────────────────────────────────────────────────────────────────

import { SenaryoPlayer, type ScheduleFn } from "../_lib/SenaryoPlayer";
import { SenaryoStage } from "../_lib/SenaryoStage";
import { bell, gain, heartbeat, lfo, masterEnv, NOTES, osc, pad, sweep } from "../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0,3],[3,3],[6,3],[9,6],[15,3],[18,4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.55, totalDur: TOTAL });

  // D major pad — cinematic, premium, heroic
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.D3, NOTES.A3, NOTES.D4], [
    [0, 0], [2, 0.026], [9, 0.024], [13, 0.030], [17, 0.038], [20, 0.024], [21.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.15, 0.006, TOTAL, t0);

  // Heartbeat — building cinematic
  const hb: Array<[number, number]> = [
    [0.6, 0.20], [2.4, 0.22],
    [3.6, 0.24], [5.4, 0.24],
    [6.6, 0.26], [8.0, 0.28],
    [9.0, 0.34],
    [10.5, 0.22], [11.7, 0.22], [12.9, 0.22], [14.1, 0.22],
    [15.2, 0.30], [16.6, 0.24],
    [17.8, 0.40], [20.5, 0.20],
  ];
  hb.forEach(([t, p]) => heartbeat(ctx, master, t0 + t, p));

  // Cinematic sweeps
  sweep(ctx, master, t0 + 6.5, 2.6, 200, 1800, 0.10, 4);

  // Bell hits — heroic
  bell(ctx, master, t0 + 0.3, NOTES.D5, 0.12, 1.8);
  bell(ctx, master, t0 + 6.2, NOTES.A4, 0.13, 1.8);
  bell(ctx, master, t0 + 9.05, NOTES.D5, 0.16, 2.0);
  bell(ctx, master, t0 + 9.05, NOTES.A4, 0.10, 2.0);

  // 4 surface bell hits (cli · desktop · web · remote)
  [9.5, 11.0, 12.5, 14.0].forEach((t, i) => bell(ctx, master, t0 + t, [NOTES.D4, NOTES["F#4"], NOTES.A4, NOTES.D5][i], 0.10, 1.2));

  // Reveal — D major triumphal arpej
  [NOTES.D4, NOTES["F#4"], NOTES.A4, NOTES.D5].forEach((f, i) => bell(ctx, master, t0 + 15.4 + i*0.18, f, 0.11, 1.0));

  // ALTARIS theme motif — full forte
  [NOTES.D4, NOTES["F#4"], NOTES.A4, NOTES.D5].forEach((f, i) => bell(ctx, master, t0 + 18.2 + i*0.26, f, 0.16, 1.7));

  // Final D3 sustain
  const finalOsc = osc(ctx, NOTES.D3, "sine");
  const finalG = gain(ctx, 0);
  finalOsc.connect(finalG).connect(master);
  finalG.gain.setValueAtTime(0, t0 + 18);
  finalG.gain.linearRampToValueAtTime(0.05, t0 + 18.4);
  finalG.gain.exponentialRampToValueAtTime(0.0001, t0 + 22);
  finalOsc.start(t0 + 18);
  finalOsc.stop(t0 + 22.1);
};

export default function ShowcasePage() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="altaris superagent · platform showcase"
      timeline={["altaris", "ne yapar", "nasıl çalışır", "4 yüzey", "güven", "pilot"]}
    >
      {/* SCENE 1 — Hero / Açılış */}
      <section className="scene s1">
        <div className="stage">
          <div className="text-center max-w-4xl">
            <pre aria-label="Altaris" className="grad-shimmer mx-auto select-none whitespace-pre font-bold leading-[1.05] tracking-[0.02em] text-[clamp(14px,2vw,24px)]">
{`█▀█   █    ▀█▀   █▀█   █▀▄   █   █▀▀
█▀█   █     █    █▀█   █▀▄   █   ▀▀█
▀ ▀   ▀▀▀   ▀    ▀ ▀   ▀ ▀   ▀   ▀▀▀`}
            </pre>
            <div className="mt-6 text-[12px] uppercase tracking-[0.32em] text-[#f08c50]">
              superagent
            </div>
            <h1 className="mt-8 text-[clamp(28px,4vw,56px)] font-light leading-[1.2] tracking-tight text-[#ddd8d0]">
              Şirketinizin <span className="grad-text font-medium">İkinci Beyni</span>
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-base leading-relaxed text-[#9b9285]">
              Tüm verilerinizi düşünen, birbirine bağlayan, anlayan ve size doğru kararı gösteren
              kurumsal yapay zeka platformu.
            </p>
          </div>
        </div>
      </section>

      {/* SCENE 2 — NE YAPAR (kullanım vaatleri) */}
      <section className="scene s2">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-8 text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ ne yapar</div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { title: "Sorar · Cevap Alır", body: "Doğal Türkçe sorularına anlık, ilişkisel cevap. ERP, CRM, e-posta, sözleşmeler — hepsi tek bir kaynaktan." },
                { title: "Simüle Eder", body: "“Tedarikçi A'yı B ile değiştirsem ne olur?” gibi soruları 6 ay öngörü ile yanıtlar." },
                { title: "Hatırlar", body: "Kurumsal hafıza insanlarda kaybolmaz. 3 yıl önceki karar, dün imzalanan sözleşme — hepsi sorgulanabilir." },
              ].map((c) => (
                <div key={c.title} className="rounded-md border border-[rgba(120,80,50,0.4)] bg-[#0d0b0a] p-5">
                  <h4 className="text-base font-medium text-[#ffb464]">{c.title}</h4>
                  <p className="mt-3 text-[12px] leading-relaxed text-[#bdb4a6]">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SCENE 3 — NASIL ÇALIŞIR (executive brain + ai çalışan) */}
      <section className="scene s3">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-8 text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ nasıl çalışır · iki bileşen</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-[rgba(240,140,80,0.45)] bg-[#0d0b0a] p-6">
                <div className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">[ executive brain ]</div>
                <h3 className="mt-3 text-xl font-medium text-[#ddd8d0]">Yöneticinin Zekası</h3>
                <p className="mt-3 text-[12px] leading-relaxed text-[#bdb4a6]">
                  Tüm kurumsal veriyi tek zeka merkezinde birleştirir. Şirketinizin "düşünen beyni".
                </p>
              </div>
              <div className="rounded-md border border-[rgba(240,140,80,0.45)] bg-[#0d0b0a] p-6">
                <div className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">[ ai çalışan ]</div>
                <h3 className="mt-3 text-xl font-medium text-[#ddd8d0]">Dijital İşgücü</h3>
                <p className="mt-3 text-[12px] leading-relaxed text-[#bdb4a6]">
                  Muhasebe, müşteri temsilcisi, satış, İK, hukuk, proje — 8 hazır rol. 7/24 çalışır.
                </p>
              </div>
            </div>
            <p className="mt-6 text-center text-[13px] text-[#9b9285]">
              <span className="text-[#ddd8d0]">Flywheel:</span> AI Çalışanlar veri üretir →
              Executive Brain anlamlandırır → daha akıllı kararlar.
            </p>
          </div>
        </div>
      </section>

      {/* SCENE 4 — DÖRT YÜZEY */}
      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-6xl">
            <div className="mb-6 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#9bd07e]">/ dört yüzey · tek beyin</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">surfaces</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  num: "01",
                  badge: "developer",
                  title: "Altaris CLI",
                  body: "Terminalde agentik komut. macOS · Linux · Windows.",
                },
                {
                  num: "02",
                  badge: "everyone",
                  title: "Desktop App",
                  body: "Native macOS + Windows. Air-gapped USB dağıtım.",
                },
                {
                  num: "03",
                  badge: "admin",
                  title: "Web Paneli",
                  body: "Tek panelden yönetim. Executive dashboard.",
                },
                {
                  num: "04",
                  badge: "audit",
                  title: "Remote Control",
                  body: "Multi-viewer canlı izleme · takeover · audit.",
                },
              ].map((s) => (
                <div key={s.num} className="rounded-md border border-[rgba(120,80,50,0.4)] bg-[#0d0b0a] p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">[ {s.badge} ]</span>
                    <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">/{s.num}</span>
                  </div>
                  <h4 className="mt-3 text-base font-medium text-[#ddd8d0]">{s.title}</h4>
                  <p className="mt-2 text-[11px] leading-relaxed text-[#bdb4a6]">{s.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3 text-[11px]">
              {[
                ["sağlayıcı esnekliği", "Anthropic · OpenAI · ChatGPT · Gemini · Mistral · Lokal LLM"],
                ["kurumsal hafıza", "Vault · ekibinizin paylaşılan zihni · saniyede arama"],
                ["entegrasyon", "ERP · CRM · e-posta · sözleşme · İK · tedarik · 8 kaynak"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border border-[rgba(120,80,50,0.32)] bg-[#0d0b0a] px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#f08c50]/80">{k}</div>
                  <div className="mt-1.5 text-[#bdb4a6]">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SCENE 5 — GÜVEN (compliance + on-prem) */}
      <section className="scene s5">
        <div className="stage">
          <div className="w-full max-w-5xl text-center">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ güven katmanı</div>
            <h2 className="mt-6 text-[clamp(28px,4vw,52px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              Veri sınır <span className="grad-text font-medium">dışına çıkmaz</span>.
            </h2>
            <div className="mt-10 flex flex-wrap justify-center gap-3 text-[10px] uppercase tracking-[0.28em]">
              {[
                "iso 27001",
                "kvkk uyumu",
                "bddk hazır",
                "on-prem deploy",
                "air-gapped opsiyon",
                "lokal llm",
                "tam audit trail",
                "rol bazlı erişim",
              ].map((t) => (
                <span key={t} className="rounded-full border border-[rgba(240,140,80,0.5)] bg-[#1a1612] px-4 py-2 text-[#ffb464]">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SCENE 6 — CTA */}
      <section className="scene s6">
        <div className="stage">
          <div className="w-full max-w-4xl text-center">
            <pre aria-label="Altaris" className="grad-shimmer mx-auto select-none whitespace-pre font-bold leading-[1.05] tracking-[0.02em] text-[clamp(13px,1.8vw,22px)]">
{`█▀█   █    ▀█▀   █▀█   █▀▄   █   █▀▀
█▀█   █     █    █▀█   █▀▄   █   ▀▀█
▀ ▀   ▀▀▀   ▀    ▀ ▀   ▀ ▀   ▀   ▀▀▀`}
            </pre>
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">
              superagent — şirketinizin ı̇kinci beyni
            </div>
            <p className="mt-8 text-[clamp(16px,1.8vw,22px)] font-light leading-[1.4] text-[#bdb4a6]">
              30 gün ücretsiz pilot · kendi verinizle başla.
            </p>
            <div className="mx-auto mt-8 inline-flex items-center gap-4 rounded-md border border-[#f08c50] bg-[#f08c50] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ pilot</span>
              <span className="font-medium">innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="altaris-showcase" label="altaris superagent · showcase" />
    </SenaryoStage>
  );
}
