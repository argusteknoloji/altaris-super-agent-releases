import Link from "next/link";

// ──────────────────────────────────────────────────────────────────────────
// Altaris — Executive One-Pager
//
// SSB Başkanı / üst düzey karar verici / yatırımcı için 30 saniyelik brief.
// Tek A4 sayfasında: 3 saniyede "ne", 10 saniyede "neden güvenli", 10 saniyede
// "ne kanıtlar", 5 saniyede "ne yapayım". Mono editorial dil korunur; ama
// içerik kuyruğu yok — tarama/okuma için optimize.
// ──────────────────────────────────────────────────────────────────────────

const ALTARIS_ASCII = `█▀█   █    ▀█▀   █▀█   █▀▄   █   █▀▀
█▀█   █     █    █▀█   █▀▄   █   ▀▀█
▀ ▀   ▀▀▀   ▀    ▀ ▀   ▀ ▀   ▀   ▀▀▀`;

export default function ExecutiveOnePager() {
  return (
    <>
      <style>{`
        @keyframes exec_shimmer { 0% { background-position: 0% 50%; } 100% { background-position: -200% 50%; } }
        .x-shimmer  {
          background-image: linear-gradient(110deg, #ffb464 0%, #f08c50 18%, #d97757 36%, #c15f3c 54%, #823c32 72%, #c15f3c 90%, #f08c50 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: exec_shimmer 14s linear infinite;
        }
        .x-grad     {
          background-image: linear-gradient(110deg, #ffb464 0%, #f08c50 35%, #d97757 60%, #c15f3c 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .x-rule { background-image: linear-gradient(to right, transparent, rgba(120,80,50,.5), transparent); }

        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          html, body { background: #0a0908 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .x-no-print { display: none !important; }
          .x-page { min-height: 0 !important; padding: 0 !important; break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <main className="relative min-h-screen bg-[#0a0908] font-mono text-[#ddd8d0] antialiased">
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(240,140,80,0.12),transparent_70%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_60%,rgba(0,0,0,0.55)_100%)]" />
        </div>

        {/* nav (print'te gizli) */}
        <header className="x-no-print sticky top-0 z-20 border-b border-[rgba(120,80,50,0.3)] bg-[rgba(10,9,8,0.85)] backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-[#6b6358]">
              <Link href="/" className="text-[#ddd8d0] transition-colors hover:text-[#ffb464]">altaris</Link>
              <span className="text-[#3a342d]">/</span>
              <Link href="/katalog" className="transition-colors hover:text-[#ffb464]">katalog</Link>
              <span className="text-[#3a342d]">/</span>
              <span className="text-[#ddd8d0]">executive</span>
            </div>
            <span className="text-[10px] uppercase tracking-[0.28em] text-[#6b6358]">⌘ + p · A4 tek sayfa</span>
          </div>
        </header>

        {/* TEK SAYFA — A4 portrait */}
        <article className="x-page mx-auto flex max-w-5xl flex-col gap-6 px-8 py-8 md:py-10">
          {/* TOP META */}
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">
            <span>argus teknoloji · executive brief</span>
            <span>2026 · 30s · gizli</span>
          </div>

          {/* HERO */}
          <section className="border-y border-[rgba(120,80,50,0.32)] py-6">
            <div className="grid items-end gap-6 md:grid-cols-[1.1fr_1fr]">
              <div>
                <pre
                  aria-label="Altaris"
                  className="x-shimmer select-none whitespace-pre font-bold leading-[1.05] tracking-[0.02em] text-[clamp(11px,1.5vw,15px)]"
                >
{ALTARIS_ASCII}
                </pre>
                <div className="mt-3 text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">
                  superagent — secondary brain
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.32em] text-[#3a342d]">/ tek cümle</div>
                <p className="mt-1 text-[clamp(14px,1.8vw,20px)] font-light leading-[1.3] text-[#ddd8d0]">
                  Kurum verinizden{" "}
                  <span className="x-grad font-medium">bir bayt dışarı çıkmadan</span>,
                  yöneticilerinize 7/24 anlık cevap veren ikinci beyin.
                </p>
              </div>
            </div>
          </section>

          {/* 3 KISA CÜMLE: NE · GÜVEN · AKSİYON */}
          <section className="grid gap-4 md:grid-cols-3">
            <Quad
              tag="ne"
              title="Şirketin İkinci Beyni"
              body="Tüm kurumsal verileri (ERP, CRM, e-posta, sözleşme, toplantı) birleştirir; doğal Türkçe sorulara anlık cevap verir; karar öncesi simülasyon yapar."
            />
            <Quad
              tag="güven"
              title="Veri Sınır Dışına Çıkmaz"
              body="On-prem ve hava-boşluklu (air-gapped) deploy. Lokal LLM ile tam izole çalışma. %100 Türk mühendisliği. Argus ISO 27001 sertifikalı kuruluş."
              accent
            />
            <Quad
              tag="aksiyon"
              title="30 Gün Risksiz Pilot"
              body="Kendi veriniz · sınırlı tenant · yazılı başarı kriteri. 1. hafta keşif · 2. hafta demo · ay sonu üretim kararı. Sözleşme sonra."
            />
          </section>

          {/* 4 YÜZEY STRIP */}
          <section className="rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a]">
            <div className="flex items-baseline justify-between border-b border-[rgba(120,80,50,0.22)] px-5 py-3">
              <span className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">/ dört yüzey · tek beyin</span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">surfaces</span>
            </div>
            <div className="grid divide-y divide-[rgba(120,80,50,0.18)] md:grid-cols-4 md:divide-x md:divide-y-0">
              {[
                ["CLI",     "geliştirici",       "Terminalde agentik komut"],
                ["Desktop", "beyaz yaka",        "Native macOS + Windows"],
                ["Web",     "BT yöneticisi",     "Tek panel · executive board"],
                ["Remote",  "denetim",           "Canlı izle · devral · audit"],
              ].map(([t, a, d]) => (
                <div key={t} className="px-5 py-4">
                  <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#ffb464]">{t}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">{a}</div>
                  <div className="mt-2 text-xs leading-snug text-[#bdb4a6]">{d}</div>
                </div>
              ))}
            </div>
          </section>

          {/* SAYISAL KANITLAR */}
          <section className="grid gap-4 md:grid-cols-4">
            {[
              ["7+",   "yıl operasyon",     "argus · ankara teknopark"],
              ["16",   "platform",          "kanıtlanmış kurumsal yazılım portföyü"],
              ["20+",  "eu projesi",        "30+ ülkede ortaklık ağı · 25+ kurum"],
              ["4",    "ı̇so sertifikası",   "27001 · 20000-1 · 9001 · 15504 spice l2"],
            ].map(([v, l, s]) => (
              <div key={l} className="border-l-2 border-[rgba(120,80,50,0.4)] pl-3">
                <div className="text-[clamp(28px,3.4vw,42px)] font-light leading-none text-[#ddd8d0]">{v}</div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-[#f08c50]">{l}</div>
                <div className="mt-1 text-[10px] leading-snug text-[#7a7166]">{s}</div>
              </div>
            ))}
          </section>

          {/* SEKTÖREL KANIT (KAMU/SAVUNMA İÇİN) */}
          <section className="rounded-md border border-[rgba(240,140,80,0.4)] bg-gradient-to-br from-[#1a1612] to-[#0a0908] p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-[0.32em] text-[#ffb464]">/ kamu · savunma · finans için</span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">sovereign-ready</span>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-[#bdb4a6]">
              Vatandaş verisi sınır dışına çıkmaz · Bakanlık/birlik bazlı tenant izolasyonu ·
              Air-gapped LAN'da çalışır · İmzalı offline güncelleme paketi · TS/SCI gizlilik
              seviyesine uygun lokal LLM çalışması · Tam audit izi (KVKK + 5651).
              {" "}<span className="text-[#ddd8d0]">Argus Teknoloji, Türkiye Siber Güvenlik Kümelenmesi üyesidir.</span>
            </p>
          </section>

          {/* CTA + İLETİŞİM */}
          <section className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
            <div className="rounded-md border border-[#f08c50] bg-[#f08c50] px-6 py-5 text-[#0a0908]">
              <div className="text-[10px] uppercase tracking-[0.32em]">/ pilot başvurusu</div>
              <p className="mt-2 text-[clamp(15px,1.6vw,18px)] font-medium leading-snug">
                30 saniye yetti — şimdi kendi verinizle 30 gün test edin.
              </p>
              <p className="mt-2 font-mono text-sm">innovahub@argusteknoloji.com.tr · +90 850 840 65 36</p>
            </div>
            <div className="rounded-md border border-[rgba(120,80,50,0.32)] bg-[#0d0b0a] px-5 py-4 text-[11px] leading-relaxed text-[#9b9285]">
              <div className="text-[10px] uppercase tracking-[0.28em] text-[#f08c50]">argus teknoloji a.ş.</div>
              <div className="mt-2">Ankara Üniversitesi Teknopark · E Blok Z18, Gölbaşı / Ankara</div>
              <div className="mt-1 text-[#7a7166]">Berlin · Promise Information Technologies (bağlı kuruluş)</div>
            </div>
          </section>

          {/* FOOTER RULE */}
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.28em] text-[#6b6358]">
            <span>argusteknoloji.com.tr</span>
            <span aria-hidden className="x-rule h-px flex-1 mx-4" />
            <span>© 2026 · executive one-pager</span>
          </div>
        </article>

        <div className="x-no-print mx-auto max-w-5xl px-8 pb-8 text-[10px] uppercase tracking-[0.28em] text-[#6b6358]">
          Yazdırmak için <span className="text-[#ddd8d0]">⌘/Ctrl + P</span> · A4 portrait · arka plan korunur.
        </div>
      </main>
    </>
  );
}

function Quad({
  tag,
  title,
  body,
  accent = false,
}: {
  tag: string;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`relative rounded-md border bg-[#0d0b0a] p-5 ${
        accent
          ? "border-[#f08c50] shadow-[0_0_0_1px_rgba(240,140,80,0.18),0_24px_48px_-24px_rgba(240,140,80,0.35)]"
          : "border-[rgba(120,80,50,0.28)]"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className={`text-[10px] uppercase tracking-[0.32em] ${accent ? "text-[#ffb464]" : "text-[#f08c50]"}`}>
          [ {tag} ]
        </span>
        {accent && <span className="text-[9px] uppercase tracking-[0.22em] text-[#ffb464]/70">★ kritik mesaj</span>}
      </div>
      <h3 className="mt-3 text-base font-medium leading-snug tracking-tight text-[#ddd8d0]">{title}</h3>
      <p className="mt-3 text-[12px] leading-relaxed text-[#bdb4a6]">{body}</p>
    </div>
  );
}
