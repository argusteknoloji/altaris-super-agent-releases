import { Soundtrack } from "./Soundtrack";

// ──────────────────────────────────────────────────────────────────────────
// Altaris — 22 saniyelik senaryo demosu
//
// Düz katalog scroll'u değil — yöneticinin gerçek bir Pazartesi sabahından
// alınmış mini bir hikaye. Self-playing CSS keyframe chain. Sayfayı açan
// kullanıcı 22 sn'lik anlatımı görür ve "haa bu şuna yarıyor" der.
//
// Sahne planı (CSS animation-delay zinciri):
//   0–3s   Pazartesi 08:30 — yönetici masası, kaybolan veri
//   3–6s   Soru — "Bu hafta hangi 3 risk elimde?"
//   6–9s   Altaris UI — typing + thinking pulse
//   9–15s  Cevap — 3 risk kartı + veri kaynakları
//   15–18s Sayısal vurgu — "4 saat → 12 saniye"
//   18–22s ALTARIS + CTA
//
// Her sahne `scene-life` keyframe'i ile ekran ömrünü yönetir; sahnenin içindeki
// alt elemanlar (typing, kart sıralaması, vb) ek delay'lerle akar. Playwright
// scripti `tools/scripts/record-scenario.ts` ile MP4 → GIF dönüşümü yapar.
// ──────────────────────────────────────────────────────────────────────────

const ALTARIS_ASCII = `█▀█   █    ▀█▀   █▀█   █▀▄   █   █▀▀
█▀█   █     █    █▀█   █▀▄   █   ▀▀█
▀ ▀   ▀▀▀   ▀    ▀ ▀   ▀ ▀   ▀   ▀▀▀`;

const TYPED_QUESTION = "Bu hafta hangi 3 risk elimde?";

export default function SenaryoPage() {
  return (
    <>
      <style>{`
        @keyframes scene-life {
          0%, 100% { opacity: 0; transform: translateY(10px); }
          6%, 92%  { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: 0% 50%; }
          100% { background-position: -200% 50%; }
        }
        @keyframes drift {
          0%, 100% { transform: translate3d(0,0,0) rotate(-1.2deg); }
          50%      { transform: translate3d(8px,-12px,0) rotate(0.6deg); }
        }
        @keyframes type-cursor { 50% { opacity: 0; } }
        @keyframes type-progress {
          0%   { width: 0; }
          100% { width: 100%; }
        }
        @keyframes brain-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(240,140,80,0.55); transform: scale(1); }
          50%      { box-shadow: 0 0 0 22px rgba(240,140,80,0);   transform: scale(1.04); }
        }
        @keyframes counter-tick {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-100%); }
        }
        @keyframes stopwatch {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes risk-pop {
          0%   { opacity: 0; transform: translateX(-12px) scale(0.97); }
          15%  { opacity: 1; transform: translateX(0) scale(1.02); }
          25%, 100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes data-line {
          0%   { stroke-dashoffset: 240; opacity: 0; }
          15%  { opacity: 0.5; }
          100% { stroke-dashoffset: 0;   opacity: 0.65; }
        }
        @keyframes cta-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(240,140,80,0.5); }
          50%      { box-shadow: 0 0 0 18px rgba(240,140,80,0); }
        }

        .scene { position: absolute; inset: 0; opacity: 0; pointer-events: none; }
        .scene > .stage { width: 100%; height: 100%; display: grid; place-items: center; padding: 6vw; }

        .grad-text {
          background-image: linear-gradient(110deg,#ffb464 0%,#f08c50 35%,#d97757 60%,#c15f3c 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .grad-shimmer {
          background-image: linear-gradient(110deg,#ffb464,#f08c50,#d97757,#c15f3c,#823c32,#c15f3c,#f08c50,#ffb464);
          background-size: 200% 100%;
          -webkit-background-clip: text; background-clip: text; color: transparent;
          animation: shimmer 14s linear infinite;
        }
        .hairline { background: linear-gradient(to right, transparent, rgba(120,80,50,.55), transparent); }

        /* ──────────────────────────────────────────────────────────────
         * Tüm sahne animasyonları yalnızca <html data-play="1"> iken çalışır.
         * Soundtrack komponenti "Oynat" / "Kaydet" tıklanınca attribute'u
         * set eder; böylece kayıt sahne 0'dan baştan yakalanır.
         * ────────────────────────────────────────────────────────────── */
        html[data-play="1"] .s1 { animation: scene-life 3s   0s   ease-out forwards; }
        html[data-play="1"] .s2 { animation: scene-life 3s   3s   ease-out forwards; }
        html[data-play="1"] .s3 { animation: scene-life 3s   6s   ease-out forwards; }
        html[data-play="1"] .s4 { animation: scene-life 6s   9s   ease-out forwards; }
        html[data-play="1"] .s5 { animation: scene-life 3s   15s  ease-out forwards; }
        html[data-play="1"] .s6 { animation: scene-life 4s   18s  ease-out forwards; }
        /* play yokken sahneler base opacity:0 ile gizli — fazladan kurala
           gerek yok. (Önceki :not([data-play="1"]) seçici html dışındaki
           atalara da eşleşip kaybolma bug'ına yol açıyordu.) */

        /* Kayıt sırasında UI chrome gizli — LinkedIn vb. paylaşım için temiz
           video çıktısı. Preview'da chrome görünür kalır (kullanıcı feedback). */
        html[data-recording="1"] .ui-chrome { opacity: 0 !important; pointer-events: none !important; }

        /* ── Sahne 1: chaos kartları ──────────────────────────────────── */
        [data-play="1"] .s1-card { animation: drift 3.6s ease-in-out infinite; }
        .s1-card-a { animation-delay: 0s; }
        .s1-card-b { animation-delay: -1.2s; }
        .s1-card-c { animation-delay: -2.4s; }
        .s1-card-d { animation-delay: -0.6s; }

        /* ── Sahne 3: typing ──────────────────────────────────────────── */
        .typed-mask {
          position: relative;
          overflow: hidden;
          white-space: nowrap;
        }
        [data-play="1"] .typed-mask > .reveal {
          animation: type-progress 1.6s steps(${TYPED_QUESTION.length}, end) 6.6s forwards;
        }
        .typed-mask > .reveal {
          width: 0;
          overflow: hidden;
          display: inline-block;
        }
        [data-play="1"] .type-cursor { animation: type-cursor 0.95s steps(1) infinite; }
        [data-play="1"] .brain-pulse { animation: brain-pulse 1.4s ease-in-out 8.2s 1 forwards; }

        /* ── Sahne 4: risk kartları ───────────────────────────────────── */
        .risk { opacity: 0; }
        [data-play="1"] .risk { animation: risk-pop 1.4s ease-out forwards; }
        .risk-1 { animation-delay: 9.5s;  }
        .risk-2 { animation-delay: 11s;   }
        .risk-3 { animation-delay: 12.5s; }
        .data-line { stroke-dasharray: 240; stroke-dashoffset: 240; }
        [data-play="1"] .data-line { animation: data-line 2.2s ease-out 9.4s forwards; }

        /* ── Sahne 5: stopwatch ───────────────────────────────────────── */
        [data-play="1"] .sw-hand { transform-origin: 50% 50%; animation: stopwatch 1.2s linear 15.4s 2 forwards; }

        /* ── Sahne 6: CTA glow ────────────────────────────────────────── */
        [data-play="1"] .cta-glow { animation: cta-glow 1.6s ease-in-out 19s infinite; }
      `}</style>

      <main className="relative h-screen w-screen overflow-hidden bg-[#0a0908] font-mono text-[#ddd8d0] antialiased">
        {/* atmosphere */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(240,140,80,0.10),transparent_70%)]" />
          <div className="absolute inset-x-0 top-0 h-px hairline" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_70%,rgba(0,0,0,0.55)_100%)]" />
        </div>

        {/* fixed top tag — kayıt/preview sırasında ui-chrome ile gizli */}
        <div className="ui-chrome absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-8 py-4 text-[10px] uppercase tracking-[0.32em] text-[#6b6358] transition-opacity duration-300">
          <span>argus teknoloji · senaryo</span>
          <span>22 sn</span>
        </div>

        <Soundtrack />

        {/* fixed bottom timeline — kayıt/preview sırasında ui-chrome ile gizli */}
        <div className="ui-chrome absolute bottom-6 left-1/2 z-10 -translate-x-1/2 transition-opacity duration-300">
          <div className="flex items-center gap-3 text-[9px] uppercase tracking-[0.32em] text-[#3a342d]">
            {["pazartesi", "soru", "altaris", "cevap", "süre", "pilot"].map((s, i) => (
              <span key={s} className="flex items-center gap-3">
                {i > 0 && <span aria-hidden className="h-px w-6 bg-[#3a342d]" />}
                <span>{s}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ──────── SCENE 1: Pazartesi 08:30 ──────── */}
        <section className="scene s1">
          <div className="stage">
            <div className="relative w-full max-w-5xl">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ pazartesi · 08:30</div>
              <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
                Yönetici masası.<br />
                <span className="text-[#7a7166]">Bilgi her yerde.</span>
              </h1>

              {/* drifting cards */}
              <div className="pointer-events-none mt-12 grid grid-cols-2 gap-6 md:grid-cols-4">
                {[
                  ["47 yeni e-posta",       "outlook"],
                  ["12 dashboard güncel.",  "BI"],
                  ["3 toplantı bekliyor",   "ajanda"],
                  ["8 sözleşme imza için",  "doküman"],
                ].map(([t, src], i) => (
                  <div key={t} className={`s1-card s1-card-${["a","b","c","d"][i]} rounded-md border border-[rgba(120,80,50,0.4)] bg-[#0d0b0a]/85 px-4 py-3 backdrop-blur-sm`}>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[#f08c50]/70">{src}</div>
                    <div className="mt-1.5 text-sm text-[#ddd8d0]">{t}</div>
                  </div>
                ))}
              </div>

              <p className="mt-12 max-w-xl text-sm leading-relaxed text-[#9b9285]">
                12 farklı sistemde dağılmış. Hepsini birleştirip karar almak —{" "}
                <span className="text-[#ddd8d0]">saatlik analiz işi</span>.
              </p>
            </div>
          </div>
        </section>

        {/* ──────── SCENE 2: Soru ──────── */}
        <section className="scene s2">
          <div className="stage">
            <div className="max-w-4xl text-center">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ yöneticinin sorusu</div>
              <h2 className="mt-6 text-[clamp(36px,5.5vw,80px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
                <span className="text-[#5a534a]">"</span>
                Bu hafta hangi{" "}
                <span className="grad-text font-medium">3 risk</span>{" "}
                elimde?
                <span className="text-[#5a534a]">"</span>
              </h2>
              <p className="mt-10 text-base text-[#7a7166]">
                Cevap: <span className="text-[#ddd8d0]">12 ayrı sistemde aranıyor.</span>
              </p>
            </div>
          </div>
        </section>

        {/* ──────── SCENE 3: Altaris UI · typing ──────── */}
        <section className="scene s3">
          <div className="stage">
            <div className="w-full max-w-3xl">
              <div className="mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">
                <span aria-hidden className="size-1.5 rounded-full bg-[#f08c50]" />
                <span>altaris · web paneli</span>
                <span className="text-[#3a342d]">·</span>
                <span>tek panel</span>
              </div>

              <div className="rounded-md border border-[rgba(120,80,50,0.32)] bg-[#0d0b0a] p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.4),0_30px_60px_-30px_rgba(240,140,80,0.25)]">
                <div className="mb-3 text-[10px] uppercase tracking-[0.28em] text-[#7a7166]">/ yöneticiye sor</div>
                <div className="typed-mask flex items-center gap-2 border-b border-[rgba(120,80,50,0.32)] pb-3 text-[clamp(16px,1.8vw,22px)] text-[#ddd8d0]">
                  <span aria-hidden className="text-[#f08c50]">▸</span>
                  <span className="reveal">{TYPED_QUESTION}</span>
                  <span aria-hidden className="type-cursor inline-block h-5 w-[8px] bg-[#f08c50]" />
                </div>

                <div className="mt-6 flex items-center gap-4">
                  <span aria-hidden className="brain-pulse grid size-10 place-items-center rounded-full border border-[#f08c50]/40 bg-[#1a1612]">
                    <span className="text-base">🧠</span>
                  </span>
                  <div>
                    <div className="text-sm text-[#ddd8d0]">SuperAgent düşünüyor…</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.22em] text-[#7a7166]">
                      crm · erp · e-posta · sözleşmeler · proje · finans
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ──────── SCENE 4: Cevap — 3 risk kartı ──────── */}
        <section className="scene s4">
          <div className="stage">
            <div className="w-full max-w-5xl">
              <div className="mb-6 flex items-baseline justify-between">
                <div className="text-[11px] uppercase tracking-[0.32em] text-[#9bd07e]">/ cevap · anlık</div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">3 sonuç</div>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                {[
                  {
                    title: "Tedarikçi X gecikme",
                    metric: "%23 ↑",
                    detail: "Son 6 ayda ortalama teslim 4.2 gün geç. Q4 stok riski kritik.",
                    sources: ["ERP", "Tedarik", "E-posta"],
                  },
                  {
                    title: "Müşteri Y ödeme",
                    metric: "47 gün",
                    detail: "Vade aşımı; 1.4M TL açık. 3 farklı proje ödemesi etkileniyor.",
                    sources: ["CRM", "Muhasebe", "Sözleşme"],
                  },
                  {
                    title: "Proje Z bütçe",
                    metric: "%18 aşım",
                    detail: "Kasım sonu teslimde maliyet sapması; ekip kapasitesi de dolu.",
                    sources: ["Proje", "Finans", "İK"],
                  },
                ].map((r, i) => (
                  <div
                    key={r.title}
                    className={`risk risk-${i + 1} relative rounded-md border border-[rgba(240,140,80,0.4)] bg-[#0d0b0a] p-5`}
                  >
                    <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-[#f08c50]" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-[10px] uppercase tracking-[0.28em] text-[#f08c50]">/0{i + 1}</div>
                      <div className="text-2xl font-light leading-none text-[#ffb464]">{r.metric}</div>
                    </div>
                    <h4 className="mt-4 text-base font-medium text-[#ddd8d0]">{r.title}</h4>
                    <p className="mt-2 text-[12px] leading-relaxed text-[#bdb4a6]">{r.detail}</p>
                    <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[rgba(120,80,50,0.25)] pt-3">
                      {r.sources.map((s) => (
                        <span key={s} className="rounded-sm border border-[rgba(120,80,50,0.4)] bg-[#1a1612] px-2 py-0.5 text-[9px] uppercase tracking-[0.22em] text-[#9b9285]">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* connecting lines from data sources to a center brain */}
              <svg
                aria-hidden
                viewBox="0 0 1000 120"
                className="mt-8 hidden h-24 w-full md:block"
              >
                {[120, 280, 440, 560, 720, 880].map((x, i) => (
                  <line
                    key={x}
                    className="data-line"
                    style={{ animationDelay: `${9.4 + i * 0.08}s` }}
                    x1={x}
                    y1="10"
                    x2="500"
                    y2="110"
                    stroke="#f08c50"
                    strokeWidth="1"
                  />
                ))}
                <circle cx="500" cy="110" r="6" fill="#f08c50" />
              </svg>
            </div>
          </div>
        </section>

        {/* ──────── SCENE 5: 4h → 12s ──────── */}
        <section className="scene s5">
          <div className="stage">
            <div className="text-center">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ insan · 4 saatlik analiz</div>
              <div className="mt-6 flex items-center justify-center gap-8">
                <div className="text-[clamp(56px,8vw,128px)] font-light leading-none text-[#7a7166] line-through decoration-[#7a7166]/40">
                  4 sa
                </div>
                <div aria-hidden className="text-[#f08c50]">
                  <svg viewBox="0 0 60 60" className="size-12">
                    <circle cx="30" cy="30" r="22" fill="none" stroke="#f08c50" strokeWidth="2" opacity="0.5" />
                    <line className="sw-hand" x1="30" y1="30" x2="30" y2="14" stroke="#f08c50" strokeWidth="2" />
                  </svg>
                </div>
                <div className="text-[clamp(72px,11vw,160px)] font-light leading-none">
                  <span className="grad-text font-medium">12 sn</span>
                </div>
              </div>
              <p className="mt-8 text-base text-[#bdb4a6]">
                <span className="text-[#ddd8d0]">SuperAgent.</span>{" "}
                Aynı sorunun cevabı. Aynı kaynaklar.
              </p>
            </div>
          </div>
        </section>

        {/* ──────── SCENE 6: ALTARIS + CTA ──────── */}
        <section className="scene s6">
          <div className="stage">
            <div className="w-full max-w-4xl text-center">
              <pre
                aria-label="Altaris"
                className="grad-shimmer mx-auto select-none whitespace-pre font-bold leading-[1.05] tracking-[0.02em] text-[clamp(13px,1.8vw,22px)]"
              >
{ALTARIS_ASCII}
              </pre>
              <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">
                superagent — şirketinizin ı̇kinci beyni
              </div>

              <div className="cta-glow mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#f08c50] bg-[#f08c50] px-7 py-4 text-[#0a0908]">
                <span className="text-[10px] uppercase tracking-[0.32em]">/ pilot</span>
                <span className="font-medium">30 gün ücretsiz · kendi verinizle</span>
              </div>

              <p className="mt-6 font-mono text-sm text-[#bdb4a6]">
                innovahub@argusteknoloji.com.tr · argus teknoloji a.ş.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
