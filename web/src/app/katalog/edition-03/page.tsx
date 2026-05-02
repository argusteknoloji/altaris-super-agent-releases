import Link from "next/link";

// ──────────────────────────────────────────────────────────────────────────
// Altaris SuperAgent katalog — Edition 03 (Sales)
//
// Üretken yönetici karar vericiye konuşan, satış odaklı katalog. PDF v2'deki
// "Secondary Brain" framing'i, sorun hook'ları, AI Çalışan rolleri ve hizmet
// paketleri esas alınmıştır — fakat:
//   - Fiyat etiketleri ve maaş karşılaştırma tabloları kaldırıldı.
//   - 4 ürün yüzeyi (CLI · Desktop · Web · Remote Control) öne çıkarıldı.
//   - Teknik detay (port, container, schema) yok; iş değeri var.
// Aynı editorial terminal dili (mono-first, sunset gradient, hairline rules)
// ile editions 01/02 ile sürekli marka.
// ──────────────────────────────────────────────────────────────────────────

const ALTARIS_ASCII = `█▀█   █    ▀█▀   █▀█   █▀▄   █   █▀▀
█▀█   █     █    █▀█   █▀▄   █   ▀▀█
▀ ▀   ▀▀▀   ▀    ▀ ▀   ▀ ▀   ▀   ▀▀▀`;

const TOC: Array<[string, string, string]> = [
  ["00", "Kapak",                       "Edition 03 · 2026 · Satış"],
  ["01", "Sorun",                       "her gün kaybolan veri"],
  ["02", "Çözüm",                       "şirketinizin ikinci beyni"],
  ["03", "İki Bileşen",                 "Executive Brain + AI Çalışan"],
  ["04", "Nasıl Çalışır?",              "3 adımda anlayın"],
  ["05", "Veri Kaynakları",             "ERP · CRM · e-posta · belgeler"],
  ["06", "Sorgu & Simülasyon",          "anlık cevap · senaryo analizi"],
  ["07", "AI Çalışan Rolleri",          "8 hazır dijital ekip üyesi"],
  ["08", "Dört Yüzey",                  "CLI · Desktop · Web · Remote"],
  ["09", "Hizmet Paketleri",            "Starter · Growth · Enterprise"],
  ["10", "Pilot Programı",              "30 gün risksiz başlangıç"],
  ["11", "İletişim",                    "argusteknoloji.com.tr"],
];

const HOOKS: Array<{ icon: string; q: string; a: string }> = [
  {
    icon: "?",
    q: "“Ne oluyor şirketimde, gerçekten?”",
    a: "12 farklı sistemde veri var; ERP ayrı, CRM ayrı, muhasebe ayrı. Bunları birleştirip anlam çıkarmak saatlerce toplantı gerektiriyor.",
  },
  {
    icon: "!",
    q: "“Bu riski neden önceden göremedim?”",
    a: "Müşteri şikayeti + tedarikçi gecikmesi + proje sorunu aynı anda oluşuyor; ama farklı sistemlerde olduğu için bağlantı kurulamıyor.",
  },
  {
    icon: "↻",
    q: "“2 yıl önce ne kararlaştırmıştık?”",
    a: "Kurumsal hafıza insanlarda. O kişi ayrıldığında her şey sıfırlanıyor. Yeni yönetici aynı hataları tekrar yapıyor.",
  },
  {
    icon: "⏱",
    q: "“Karar almak için hep hazırlık lazım.”",
    a: "Her strateji toplantısı öncesinde analistler haftalarca rapor hazırlıyor. Sonunda veriler eski oluyor, karar gecikiyor.",
  },
];

const SOURCES: Array<{ tag: string; name: string }> = [
  { tag: "01", name: "ERP Sistemi (Logo, SAP)" },
  { tag: "02", name: "CRM (Müşteri Takip)" },
  { tag: "03", name: "E-posta ve Takvim" },
  { tag: "04", name: "Finansal Raporlar" },
  { tag: "05", name: "Toplantı Notları" },
  { tag: "06", name: "Sözleşmeler ve Belgeler" },
  { tag: "07", name: "İK & Bordro Sistemi" },
  { tag: "08", name: "Tedarik Zinciri" },
];

const QUERIES: Array<{ tag: string; q: string; a: string }> = [
  {
    tag: "finansal",
    q: "“Bu çeyrekte hangi müşteriden en çok zarar ettik?”",
    a: "CRM, muhasebe ve proje verileri birleştirilerek müşteri bazlı kâr/zarar analizi saniyeler içinde sunulur.",
  },
  {
    tag: "operasyonel",
    q: "“Kasım teslimatlarında gecikme riski var mı?”",
    a: "Proje durumları, tedarikçi gecikmesi ve ekip kapasitesi çapraz analiz edilerek somut risk skoru üretilir.",
  },
  {
    tag: "kurumsal hafıza",
    q: "“2023'te tedarikçi X ile neden sorun yaşadık?”",
    a: "O döneme ait e-postalar, toplantı notları ve ödeme gecikmeleri bulunur. O kişi şirkette olmasa bile bilgiye ulaşılır.",
  },
  {
    tag: "i̇nsan kaynakları",
    q: "“Hangi ekiplerde çıkış riski yüksek?”",
    a: "Performans verisi, izin sıklığı, proje yükü ve iletişim kalıpları analiz edilerek riskli profiller önceden tespit edilir.",
  },
];

const ROLES: Array<{ icon: string; title: string; lines: string[] }> = [
  { icon: "01", title: "Muhasebe Asistanı",   lines: ["Fatura işleme", "Mutabakat", "Anomali tespiti", "Raporlama"] },
  { icon: "02", title: "Müşteri Temsilcisi",  lines: ["7/24 destek", "Bilet yönetimi", "Şikayet sınıflandırma"] },
  { icon: "03", title: "Satış Destek Uzmanı", lines: ["Lead skorlama", "Teklif hazırlama", "CRM güncelleme"] },
  { icon: "04", title: "İK Asistanı",         lines: ["CV tarama", "Ön mülakat", "Onboarding", "İzin yönetimi"] },
  { icon: "05", title: "Hukuki Asistan",      lines: ["Sözleşme inceleme", "Risk işaretleme", "Mevzuat tarama"] },
  { icon: "06", title: "Proje Koordinatörü",  lines: ["Görev takibi", "Deadline uyarısı", "Raporlama"] },
  { icon: "07", title: "Yönetici Asistanı",   lines: ["Ajanda yönetimi", "Toplantı özeti", "Önceliklendirme"] },
  { icon: "08", title: "İdari İşler Asistanı",lines: ["Evrak takibi", "Tedarikçi iletişimi", "Ofis operasyonları"] },
];

const SURFACES: Array<{
  num: string;
  title: string;
  audience: string;
  body: string;
  bullets: string[];
  badge: string;
}> = [
  {
    num: "01",
    title: "Altaris CLI",
    audience: "geliştirici · analist · operasyon",
    body: "Terminalde çalışan agentik komut hattı. macOS, Linux, Windows. Yerel dosya sistemine erişimle bağlam içinde çalışır; teknik ekipler için en hızlı yol.",
    bullets: [
      "Tek komutla erişim",
      "Yerel dosya bağlamı",
      "Sağlayıcı geçişi mid-session",
    ],
    badge: "developer",
  },
  {
    num: "02",
    title: "Altaris Desktop",
    audience: "yönetici · beyaz yaka kullanıcı",
    body: "Terminale alışkın olmayan ekip için native macOS ve Windows uygulaması. Tek tıkla SSO girişi, sürükle-bırak doküman ekleme, anında soru-cevap.",
    bullets: [
      "Native macOS + Windows",
      "Hafif kurulum, kurumsal SSO",
      "Air-gapped USB ile dağıtılabilir",
    ],
    badge: "everyone",
  },
  {
    num: "03",
    title: "Altaris Web",
    audience: "yönetim · BT · denetim ekibi",
    body: "Tarayıcıdan ulaşılan tek panel. Kullanıcılar, sağlayıcılar, vault'lar, oturum geçmişi tek yerden yönetilir. Üst yönetim için executive dashboard.",
    bullets: [
      "Tek panelden tam yönetim",
      "Executive dashboard",
      "Tam transcript & oturum arşivi",
    ],
    badge: "admin",
  },
  {
    num: "04",
    title: "Remote Control",
    audience: "ekip lideri · iç denetim",
    body: "Bir kullanıcının çalışan oturumunu canlı izle, ihtiyaç olursa yetkili devralma ile müdahale et. Her tuş vuruşu kayıt altında — denetim hazır.",
    bullets: [
      "Multi-viewer canlı izleme",
      "Yetkili takeover",
      "Tam audit kaydı",
    ],
    badge: "audit",
  },
];

const PACKAGES: Array<{
  tag: string;
  name: string;
  positioning: string;
  hint: string;
  perks: string[];
  recommended?: boolean;
}> = [
  {
    tag: "starter",
    name: "Starter",
    positioning: "Executive Brain'e giriş",
    hint: "tek departman · ilk pilot",
    perks: [
      "3 veri kaynağı entegrasyonu",
      "CEO / GM dashboard",
      "Doğal dilde sorgulama",
      "Haftalık otomatik briefing",
      "1 AI Çalışan (rol seçimi)",
      "Aylık performans raporu",
    ],
  },
  {
    tag: "growth",
    name: "Growth",
    positioning: "Tüm yetenekler · gerçek zamanlı",
    hint: "büyüyen orta ölçek · KPI sahibi yöneticiler",
    perks: [
      "8 veri kaynağı entegrasyonu",
      "Gerçek zamanlı risk uyarıları",
      "Simülasyon & senaryo analizi",
      "Proaktif sabah briefing'i",
      "3 AI Çalışan (rol seçimi)",
      "7/24 destek · 5 kullanıcı",
    ],
    recommended: true,
  },
  {
    tag: "enterprise",
    name: "Enterprise",
    positioning: "Kuruma özel · sınırsız",
    hint: "kamu · finans · büyük ölçek",
    perks: [
      "Sınırsız veri kaynağı",
      "On-premise kurulum",
      "Özel AI model eğitimi",
      "Sınırsız AI Çalışan",
      "Dedicated müşteri yöneticisi",
      "%99.9 uptime SLA",
    ],
  },
];

const STEPS: Array<[string, string, string]> = [
  ["01", "Veri Toplama — “Herşeyi Oku”",
   "Sistem şirketinizdeki tüm veri kaynaklarına bağlanır: ERP, CRM, e-posta, toplantı notları, finansal raporlar, sözleşmeler. Düzenli aralıklarla okur. Siz hiçbir şey yapmak zorunda değilsiniz — sistem arka planda sessizce çalışır."],
  ["02", "Anlama ve İlişkilendirme — “Bağlantıları Kur”",
   "Okuduğu her bilgiyi anlamlandırır ve diğer verilerle ilişkilendirir. “Müşteri X'in gecikmeli ödemesi” ile “Proje Y'nin maliyet aşımı” ile “Ekip Z'nin yorgunluğu” arasındaki gizli bağlantıyı kurar. Bir insan bunu haftalar içinde görebilir; SuperAgent anlık görür."],
  ["03", "Hafıza Oluşturma — “Hiçbir Şeyi Unutma”",
   "İşlediği her bilgi kurumsal hafızaya işlenir. 3 yıl önce alınan bir karar, geçen ay yapılan toplantı, imzalanan sözleşmenin bir maddesi — hepsi sorgulanabilir ve birbiriyle ilişkilendirilebilir halde kalıcı olarak durur."],
];

export default function KatalogEdition3Page() {
  return (
    <>
      <style>{`
        @keyframes katalog_fade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .k-reveal   { opacity: 0; animation: katalog_fade 700ms cubic-bezier(.2,.7,.2,1) forwards; }
        .k-grad     {
          background-image: linear-gradient(110deg, #ffb464 0%, #f08c50 35%, #d97757 60%, #c15f3c 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .k-shimmer  {
          background-image: linear-gradient(110deg, #ffb464 0%, #f08c50 18%, #d97757 36%, #c15f3c 54%, #823c32 72%, #c15f3c 90%, #f08c50 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .k-spread {
          min-height: calc(100vh - 60px);
          padding: clamp(48px, 6vw, 96px) clamp(32px, 6vw, 96px);
          position: relative;
          break-after: page;
        }
        .k-rule { background-image: linear-gradient(to right, transparent, rgba(120,80,50,.5), transparent); }

        @media print {
          @page { size: A4; margin: 14mm; }
          html, body { background: #0a0908 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .k-no-print { display: none !important; }
          .k-spread { min-height: 0; padding: 24mm 0 12mm; page-break-inside: avoid; break-inside: avoid; }
          .k-spread:not(:last-child) { break-after: page; }
          a { color: inherit !important; text-decoration: none !important; }
        }
      `}</style>

      <main className="relative min-h-screen overflow-x-hidden bg-[#0a0908] font-mono text-[#ddd8d0] antialiased">
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(240,140,80,0.10),transparent_70%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_70%,rgba(0,0,0,0.5)_100%)]" />
        </div>

        <header className="k-no-print sticky top-0 z-20 border-b border-[rgba(120,80,50,0.3)] bg-[rgba(10,9,8,0.85)] backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-[#6b6358]">
              <Link href="/" className="text-[#ddd8d0] transition-colors hover:text-[#ffb464]">altaris</Link>
              <span className="text-[#3a342d]">/</span>
              <Link href="/katalog" className="transition-colors hover:text-[#ffb464]">katalog</Link>
              <span className="text-[#3a342d]">/</span>
              <span className="text-[#ddd8d0]">edition 03</span>
              <span className="text-[#3a342d]">·</span>
              <span>satış</span>
            </div>
            <span className="hidden md:inline-flex text-[10px] uppercase tracking-[0.28em] text-[#6b6358]">⌘ + p · pdf'e bas</span>
          </div>
        </header>

        {/* 00 — KAPAK */}
        <section className="k-spread mx-auto max-w-6xl">
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">
            <span>argus teknoloji</span>
            <span aria-hidden className="h-px w-10 bg-[#3a342d]" />
            <span>ürün kataloğu</span>
            <span aria-hidden className="h-px w-10 bg-[#3a342d]" />
            <span>2026</span>
          </div>

          <pre
            aria-label="Altaris"
            className="k-reveal k-shimmer mt-12 select-none whitespace-pre font-bold leading-[1.05] tracking-[0.02em] text-[clamp(13px,2.0vw,24px)]"
            style={{ animationDelay: "100ms" }}
          >
{ALTARIS_ASCII}
          </pre>

          <div className="mt-14 max-w-3xl">
            <div className="text-[10px] uppercase tracking-[0.32em] text-[#3a342d]">/ yapay zeka danışmanlık platformu</div>
            <h1 className="mt-4 text-[clamp(30px,4.4vw,64px)] font-light leading-[1.04] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">{"// "}</span>
              Altaris{" "}
              <span className="k-grad font-medium">SuperAgent</span>
            </h1>
            <p className="mt-3 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">— secondary brain</p>
            <p className="mt-7 max-w-2xl text-base leading-relaxed text-[#bdb4a6]">
              Tüm verilerinizi düşünen, birbirine bağlayan, anlayan ve size doğru kararı gösteren
              kurumsal yapay zeka platformu.
            </p>
          </div>

          <div className="absolute bottom-12 left-12 right-12 flex items-end justify-between text-[10px] uppercase tracking-[0.28em] text-[#6b6358] md:bottom-16 md:left-24 md:right-24">
            <div className="space-y-1">
              <div className="text-[#ddd8d0]">edition 03 · 2026</div>
              <div className="text-[#3a342d]">satış sürümü · fiyatlar saklı</div>
            </div>
            <div className="space-y-1 text-right">
              <div className="text-[#ddd8d0]">platform: promise + orbit engine</div>
              <div className="text-[#3a342d]">© argus teknoloji</div>
            </div>
          </div>
        </section>

        {/* TOC */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="—" tag="i̇çindekiler" hint="contents" />
          <ol className="mt-2 space-y-3">
            {TOC.map(([n, t, s]) => (
              <li key={n} className="grid grid-cols-[3rem_1fr_auto] items-baseline gap-4 border-b border-dashed border-[rgba(120,80,50,0.3)] py-3">
                <span className="text-[11px] uppercase tracking-[0.32em] text-[#f08c50]/70">{n}</span>
                <span className="text-base text-[#ddd8d0]">{t}</span>
                <span className="text-xs text-[#7a7166]">{s}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* 01 — SORUN */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="01" tag="sorun" hint="her gün kaybolan veri" />
          <div className="mb-10 max-w-3xl">
            <h2 className="text-[clamp(26px,3.6vw,46px)] font-light leading-[1.15] tracking-tight text-[#ddd8d0]">
              Şirketinizde her gün{" "}
              <span className="k-grad font-medium">ne kadar veri</span>{" "}
              kaybolup gidiyor?
            </h2>
            <p className="mt-6 text-sm leading-relaxed text-[#9b9285]">
              Her gün şirketinizde yüzlerce karar alınıyor, binlerce e-posta yazılıyor, onlarca
              toplantı yapılıyor. Bu bilgilerin büyük çoğunluğu hiçbir yerde birbirine bağlanmıyor —
              kaybolup gidiyor. Oysa bu veriler arasında gizlenmiş fırsatlar ve riskler var.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {HOOKS.map((h) => (
              <div key={h.q} className="relative rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a] p-6">
                <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-[#f08c50]" />
                <div className="mb-3 flex items-center gap-3">
                  <span aria-hidden className="grid size-7 place-items-center rounded-full border border-[#f08c50]/40 text-sm font-medium text-[#f08c50]">{h.icon}</span>
                  <span className="text-[10px] uppercase tracking-[0.28em] text-[#7a7166]">soru</span>
                </div>
                <p className="text-base font-medium leading-snug text-[#ddd8d0]">{h.q}</p>
                <p className="mt-3 text-[13px] leading-relaxed text-[#9b9285]">{h.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-md border border-[#f08c50] bg-gradient-to-br from-[#1a1612] to-[#0d0b0a] p-6 md:p-8">
            <p className="text-base leading-relaxed text-[#bdb4a6]">
              Araştırmalar, üst düzey yöneticilerin zamanlarının{" "}
              <span className="font-medium text-[#ffb464]">%40'ını</span>{" "}
              doğru bilgiye ulaşmaya, verileri birleştirmeye ve raporları anlamaya harcadığını
              gösteriyor. Bu, stratejik düşünmeye ayrılması gereken zamandır.{" "}
              <span className="text-[#ddd8d0]">Altaris SuperAgent bu zamanı size geri verir.</span>
            </p>
          </div>
        </section>

        {/* 02 — ÇÖZÜM */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="02" tag="çözüm" hint="şirketinizin ikinci beyni" />
          <div className="grid gap-12 md:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="text-[clamp(26px,3.6vw,46px)] font-light leading-[1.18] tracking-tight text-[#ddd8d0]">
                Altaris SuperAgent sizi{" "}
                <span className="text-[#7a7166] italic">değiştirmiyor</span> —
                <br className="hidden md:block" />
                sizi <span className="k-grad font-medium">güçlendiriyor</span>.
              </h2>
              <p className="mt-7 text-base leading-relaxed text-[#bdb4a6]">
                Tıpkı kendi beyninizdeki bilgileri kaydetmek için bir not defteri kullandığınız
                gibi, SuperAgent şirketinizin tüm bilgilerini dışarıda tutan, anlayan ve size sunan{" "}
                <span className="text-[#ffb464]">ikinci bir beyin</span>{" "}
                gibi çalışır. Siz kararı verirsiniz; o size ham gerçeği getirir.
              </p>
              <p className="mt-5 text-sm leading-relaxed text-[#9b9285]">
                Mevcut BI araçları size geçmişi gösterir. SuperAgent size{" "}
                <em className="not-italic text-[#ddd8d0]">şu an ne olduğunu, yakında ne olabileceğini ve ne yapmanız gerektiğini</em>{" "}
                söyler — tüm verilerinizi birleştirerek.
              </p>
            </div>

            <div className="rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a] p-6 md:p-7">
              <div className="mb-4 flex items-baseline justify-between border-b border-[rgba(120,80,50,0.22)] pb-3">
                <span className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">[ farkı ]</span>
                <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">positioning</span>
              </div>
              <ul className="space-y-4 text-[13px]">
                {[
                  ["BI / Tablo araçları",      "Geçmişi gösterir, tek sistem üzerinden",          false],
                  ["Genel amaçlı LLM",         "Genel bilgi · şirketinizin verisini bilmez",      false],
                  ["Manuel danışmanlık",       "Aylık retainer · belirli saatler içinde erişim", false],
                  ["Altaris SuperAgent",       "Şirketinizin tüm verisi · 7/24 · doğal dil",      true],
                ].map(([k, v, isStar]) => (
                  <li key={k as string} className="border-l-2 border-[rgba(120,80,50,0.32)] pl-4" style={isStar ? { borderColor: "#f08c50" } : undefined}>
                    <div className={`text-[11px] uppercase tracking-[0.22em] ${isStar ? "text-[#ffb464]" : "text-[#7a7166]"}`}>
                      {isStar ? "★ " : ""}{k}
                    </div>
                    <div className={`mt-1 text-[13px] leading-relaxed ${isStar ? "text-[#ddd8d0]" : "text-[#9b9285]"}`}>{v}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 03 — İKİ BİLEŞEN */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="03" tag="i̇ki bileşen" hint="executive brain + ai çalışan" />
          <p className="mb-10 max-w-3xl text-base leading-relaxed text-[#bdb4a6]">
            Altaris SuperAgent iki temel bileşenden oluşur. Biri olmadan diğeri eksik — birlikte
            şirketiniz hem <span className="text-[#ddd8d0]">daha verimli çalışır</span> hem de{" "}
            <span className="text-[#ddd8d0]">daha akıllı kararlar alır</span>.
          </p>

          <div className="grid gap-px overflow-hidden rounded-md border border-[rgba(120,80,50,0.28)] bg-[rgba(120,80,50,0.28)] md:grid-cols-2">
            <div className="bg-[#0d0b0a] p-7 md:p-9">
              <div className="mb-5 flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">[ executive brain ]</span>
                <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">secondary brain</span>
              </div>
              <h3 className="text-[clamp(22px,2.6vw,30px)] font-light tracking-tight text-[#ddd8d0]">Yöneticinin Zekası</h3>
              <p className="mt-5 text-[13px] leading-relaxed text-[#bdb4a6]">
                Şirketinizin tüm verilerini (ERP, CRM, e-posta, toplantı notları, sözleşmeler,
                finansallar) tek bir zeka merkezinde birleştirir. Yöneticiler Türkçe olarak soru
                sorar ve anlık, ilişkisel, bütünleşik cevaplar alır.
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-[#9b9285]">
                Şirketinizin <em className="not-italic text-[#ddd8d0]">“düşünen beyni”</em>.
              </p>
            </div>

            <div className="bg-[#0d0b0a] p-7 md:p-9">
              <div className="mb-5 flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">[ ai çalışan ]</span>
                <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">dijital i̇şgücü</span>
              </div>
              <h3 className="text-[clamp(22px,2.6vw,30px)] font-light tracking-tight text-[#ddd8d0]">Ekibinizin Dijital Üyesi</h3>
              <p className="mt-5 text-[13px] leading-relaxed text-[#bdb4a6]">
                Muhasebe asistanından müşteri temsilcisine, satış destek uzmanından proje
                koordinatörüne kadar belirli görevleri otonom yürüten yapay zeka çalışanlar.
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-[#9b9285]">
                7/24 çalışır, ölçeklenir, mevcut sisteminize entegre olur.
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a] p-6 md:p-7">
            <div className="mb-3 text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">/ flywheel etkisi</div>
            <p className="text-[13px] leading-relaxed text-[#bdb4a6]">
              AI Çalışanlar veri üretir →{" "}
              <span className="text-[#ddd8d0]">Executive Brain bu veriyi anlamlandırır</span>{" "}
              → CEO daha fazla değer görür → Yeni AI Çalışan eklenir.{" "}
              <span className="text-[#ffb464]">Sistem büyüdükçe daha akıllı hale gelir.</span>
            </p>
          </div>
        </section>

        {/* 04 — NASIL ÇALIŞIR */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="04" tag="nasıl çalışır?" hint="3 adımda anlayın" />
          <p className="mb-10 max-w-3xl text-sm leading-relaxed text-[#9b9285]">
            Teknik bilgi gerekmez. Tıpkı deneyimli bir asistanın tüm dosyaları okuyup sindirip
            size özet sunması gibi — sadece bu asistan saniyede milyonlarca belge okuyabiliyor.
          </p>
          <ol className="space-y-6">
            {STEPS.map(([n, t, d]) => (
              <li key={n} className="grid grid-cols-[3.5rem_1fr] gap-6 border-l border-[rgba(120,80,50,0.32)] pl-6">
                <span className="text-[clamp(28px,3vw,40px)] font-light leading-none text-[#f08c50]">{n}</span>
                <div>
                  <h4 className="text-lg font-medium text-[#ddd8d0]">{t}</h4>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#bdb4a6]">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* 05 — VERİ KAYNAKLARI */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="05" tag="veri kaynakları" hint="bağlanılabilen sistemler" />
          <p className="mb-10 max-w-3xl text-base leading-relaxed text-[#bdb4a6]">
            Mevcut sisteminizi <span className="text-[#ddd8d0]">değiştirmiyorsunuz</span>.
            SuperAgent, var olan ERP'niz, CRM'iniz ve e-posta sisteminizin üzerine oturur.
            Ortalama kurulum süresi <span className="text-[#ffb464]">4–6 hafta</span>.
          </p>
          <div className="grid gap-px overflow-hidden rounded-md border border-[rgba(120,80,50,0.28)] bg-[rgba(120,80,50,0.28)] md:grid-cols-2 lg:grid-cols-4">
            {SOURCES.map((s) => (
              <div key={s.tag} className="bg-[#0d0b0a] p-6">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#f08c50]/70">/{s.tag}</div>
                <div className="mt-4 text-sm font-medium leading-tight text-[#ddd8d0]">{s.name}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 06 — SORGU & SİMÜLASYON */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="06" tag="sorgu & simülasyon" hint="anlık cevap · senaryo" />
          <h2 className="mb-3 text-[clamp(24px,3.2vw,38px)] font-light leading-[1.2] tracking-tight text-[#ddd8d0]">
            Sorun — anlık <span className="k-grad">cevap alın</span>.
          </h2>
          <h2 className="mb-12 text-[clamp(24px,3.2vw,38px)] font-light leading-[1.2] tracking-tight text-[#ddd8d0]">
            Karar alın — önce <span className="k-grad">simüle edin</span>.
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            {QUERIES.map((q) => (
              <div key={q.tag} className="relative rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a] p-6">
                <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-[#f08c50]" />
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#f08c50]/80">{q.tag}</div>
                <p className="mt-3 text-base font-medium italic leading-snug text-[#ddd8d0]">{q.q}</p>
                <p className="mt-3 text-[13px] leading-relaxed text-[#9b9285]">{q.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-md border border-[rgba(120,80,50,0.32)] bg-gradient-to-br from-[#14110f] to-[#0a0908] p-7 md:p-8">
            <div className="mb-5 text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">/ simülasyon örneği — “kararından önce gör”</div>
            <ol className="space-y-5 text-[13px]">
              <li>
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#7a7166]">yöneticinin sorusu</div>
                <p className="mt-1.5 text-[#ddd8d0]">“Eğer Tedarikçi A'yı Tedarikçi B ile değiştirirsem, 6 aylık maliyet ve teslimat sürelerime ne olur?”</p>
              </li>
              <li>
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#7a7166]">sistem analizi</div>
                <p className="mt-1.5 leading-relaxed text-[#bdb4a6]">Tedarikçi B'nin 18 aylık geçmiş performansı, fiyat karşılaştırması, mevcut sipariş takvimi ve lojistik maliyetler hesaplanıyor…</p>
              </li>
              <li>
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#9bd07e]">simülasyon sonucu</div>
                <ul className="mt-2 space-y-1.5 leading-relaxed text-[#bdb4a6]">
                  <li><span className="text-[#ffb464]">Senaryo 1 (Hemen geçiş):</span> Maliyet %12 azalır, ilk 3 ayda ortalama 4 gün gecikme riski.</li>
                  <li><span className="text-[#ffb464]">Senaryo 2 (Kademeli):</span> Maliyet %8 azalır, gecikme riski %2'ye düşer.</li>
                  <li className="text-[#9bd07e]">→ Önerilen: Senaryo 2</li>
                </ul>
              </li>
            </ol>
          </div>
        </section>

        {/* 07 — AI ÇALIŞAN ROLLERİ */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="07" tag="ai çalışan rolleri" hint="hazır dijital ekip üyeleri" />
          <p className="mb-10 max-w-3xl text-base leading-relaxed text-[#bdb4a6]">
            Sekiz hazır rol — kuruma özel rol tanımları siparişle eklenebilir. Her AI Çalışan
            mevcut sisteminize entegre olur, kurumsal kimlik politikalarınıza tabidir, tüm
            etkileşimleri kayıt altındadır.
          </p>

          <div className="grid gap-px overflow-hidden rounded-md border border-[rgba(120,80,50,0.28)] bg-[rgba(120,80,50,0.28)] md:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => (
              <div key={r.title} className="bg-[#0d0b0a] p-6">
                <div className="mb-4 flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-[0.28em] text-[#f08c50]/70">/{r.icon}</span>
                  <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">role</span>
                </div>
                <h4 className="mb-3 text-base font-medium tracking-tight text-[#ddd8d0]">{r.title}</h4>
                <ul className="space-y-1.5 text-[12px] leading-relaxed text-[#9b9285]">
                  {r.lines.map((l, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-[#f08c50]/60" />
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-md border border-[rgba(120,80,50,0.32)] bg-[#0d0b0a] p-6 md:p-7">
            <div className="mb-3 text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">/ farkını sezin</div>
            <p className="text-[13px] leading-relaxed text-[#bdb4a6]">
              İnsan çalışan günde belirli saat çalışır, belirli tempo tutar, ayrılınca kurumsal
              hafıza kaybolur. AI Çalışan{" "}
              <span className="text-[#ddd8d0]">7/24 kesintisiz</span>,{" "}
              <span className="text-[#ddd8d0]">aynı anda yüzlerce paralel görev</span>,{" "}
              <span className="text-[#ddd8d0]">kurumsal hafıza kalıcı</span>. İkisi yer değiştirmez —
              insan stratejik düşünür, AI Çalışan tekrarlanan işi yürütür.
            </p>
          </div>
        </section>

        {/* 08 — DÖRT YÜZEY */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="08" tag="dört yüzey" hint="cli · desktop · web · remote" />
          <p className="mb-10 max-w-3xl text-base leading-relaxed text-[#bdb4a6]">
            SuperAgent'a dört farklı kanaldan ulaşılır. Her ekip üyesi kendi alışkanlığına en
            uygun yüzeyi seçer — hepsi aynı kurumsal beyne, aynı kullanıcıya, aynı denetim izine
            bağlı çalışır.
          </p>

          <div className="grid gap-px overflow-hidden rounded-md border border-[rgba(120,80,50,0.28)] bg-[rgba(120,80,50,0.28)] md:grid-cols-2">
            {SURFACES.map((s) => (
              <div key={s.num} className="bg-[#0d0b0a] p-7 md:p-8">
                <div className="mb-5 flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">[ {s.badge} ]</span>
                  <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">/{s.num}</span>
                </div>
                <h4 className="text-xl font-medium tracking-tight text-[#ddd8d0]">{s.title}</h4>
                <div className="mt-1.5 text-[11px] uppercase tracking-[0.22em] text-[#7a7166]">{s.audience}</div>
                <p className="mt-5 text-[13px] leading-relaxed text-[#bdb4a6]">{s.body}</p>
                <ul className="mt-5 space-y-2 border-t border-[rgba(120,80,50,0.18)] pt-4 text-xs">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-[#f08c50]/70" />
                      <span className="text-[#bdb4a6]">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* 09 — HİZMET PAKETLERİ (FİYATSIZ) */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="09" tag="hizmet paketleri" hint="i̇htiyacınıza göre" />
          <p className="mb-10 max-w-3xl text-base leading-relaxed text-[#bdb4a6]">
            Üç paket, üç farklı kurumsal ölçek. Her paket kurulum, entegrasyon ve eğitim desteği
            içerir. Mevcut sisteminizi değiştirmenize gerek yoktur. Detaylı fiyatlandırma için{" "}
            <span className="text-[#ddd8d0]">teklif çağrısı</span> yapın — kurum büyüklüğü, veri
            kaynağı sayısı ve deploy tercihinize göre belirlenir.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            {PACKAGES.map((p) => (
              <div
                key={p.tag}
                className={`relative rounded-md border bg-[#0d0b0a] ${
                  p.recommended
                    ? "border-[#f08c50] shadow-[0_0_0_1px_rgba(240,140,80,0.2),0_30px_60px_-30px_rgba(240,140,80,0.4)]"
                    : "border-[rgba(120,80,50,0.28)]"
                }`}
              >
                {p.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-[#f08c50] bg-[#0a0908] px-4 py-1 text-[10px] uppercase tracking-[0.28em] text-[#ffb464]">
                    en çok tercih edilen
                  </div>
                )}
                <div className="border-b border-[rgba(120,80,50,0.22)] px-6 py-5">
                  <div className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">[ {p.tag} ]</div>
                  <h4 className="mt-3 text-[clamp(22px,2.6vw,30px)] font-light tracking-tight text-[#ddd8d0]">{p.name}</h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#9b9285]">{p.positioning}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">{p.hint}</p>
                </div>
                <ul className="space-y-3 px-6 py-5 text-[13px]">
                  {p.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-3">
                      <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-[#f08c50]/70" />
                      <span className="text-[#bdb4a6]">{perk}</span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-[rgba(120,80,50,0.22)] px-6 py-4">
                  <span className="text-[10px] uppercase tracking-[0.32em] text-[#ffb464]">teklif al →</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-md border border-[rgba(120,80,50,0.32)] bg-[#0d0b0a] p-6 md:p-7">
            <div className="mb-3 text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">/ referans noktası</div>
            <p className="text-[13px] leading-relaxed text-[#bdb4a6]">
              Bir strateji danışmanlık firmasının genel müdürünüze aylık retainer fiyatı ile bu
              kataloğun sunduğu sürekli, 7/24 kurumsal beyni karşılaştırın. SuperAgent
              danışmanlığınızı <span className="text-[#ddd8d0]">besler</span>; her ay orada durur —
              üstelik tüm şirket verinizi bilerek.
            </p>
          </div>
        </section>

        {/* 10 — PİLOT */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="10" tag="pilot programı" hint="30 gün risksiz başlangıç" />
          <div className="grid gap-12 md:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className="text-[clamp(24px,3vw,38px)] font-light leading-[1.18] tracking-tight text-[#ddd8d0]">
                Şirketinizin{" "}
                <span className="k-grad">i̇kinci beynini</span>{" "}
                bugün çalıştırın.
              </h2>
              <p className="mt-7 text-sm leading-relaxed text-[#bdb4a6]">
                Pilot program ile risksiz başlayın. İlk 30 gün boyunca gerçek verilerinizle
                sistemi deneyin, değeri görün — sonra karar verin.
              </p>
            </div>

            <div className="rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a] p-7 md:p-8">
              <ol className="space-y-6 text-sm">
                {[
                  ["01", "Keşif Toplantısı",  "30 dakika · NDA imzalı görüşme. Süreçlerinizi dinleriz, kullanım senaryosu çıkarırız.", "1. hafta"],
                  ["02", "Ücretsiz Demo",     "Kendi verinizden bir alt küme ile canlı gösterim — mevcut sisteminizden veri kullanarak.", "1–2. hafta"],
                  ["03", "30 Gün Pilot",      "Sınırlı tenant, 5–15 kullanıcı. Başarı kriterleri yazılı. Kapsam: 1–3 sektörel use case.", "ay 1"],
                  ["04", "Üretim Geçişi",     "Paket seçimi (Starter / Growth / Enterprise) · SLA paketi · sürekli destek · roll-out planı.", "ay 2 +"],
                ].map(([n, t, d, w]) => (
                  <li key={n} className="grid grid-cols-[2.5rem_1fr] items-baseline gap-4">
                    <span className="text-[11px] uppercase tracking-[0.28em] text-[#f08c50]/80">{n}</span>
                    <div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium text-[#ddd8d0]">{t}</span>
                        <span className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">{w}</span>
                      </div>
                      <div className="mt-1 text-xs leading-relaxed text-[#9b9285]">{d}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* 11 — İLETİŞİM */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="11" tag="i̇letişim" hint="back cover" />
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <h3 className="text-[clamp(22px,2.8vw,32px)] font-light tracking-tight text-[#ddd8d0]">
                Argus Teknoloji A.Ş.
              </h3>
              <p className="mt-2 text-xs uppercase tracking-[0.28em] text-[#7a7166]">
                ARGUS Teknoloji Bilişim Sanayi Ticaret A.Ş.
              </p>
              <ul className="mt-7 space-y-3 text-sm">
                {[
                  ["adres",      "Bahçelievler Mah. 319 Cad. E Blok (Teknokent) No:35 E/Z18, 06830 Gölbaşı / Ankara"],
                  ["e-posta",    "innovahub@argusteknoloji.com.tr"],
                  ["telefon",    "+90 850 840 65 36"],
                  ["mobil",      "+90 535 466 07 21"],
                  ["web",        "argusteknoloji.com.tr"],
                  ["bağlı kuruluş", "Promise Information Technologies — Berlin"],
                ].map(([k, v]) => (
                  <li key={k} className="grid grid-cols-[6rem_1fr] items-baseline gap-4 border-b border-[rgba(120,80,50,0.18)] pb-3">
                    <span className="text-[11px] uppercase tracking-[0.28em] text-[#f08c50]/70">{k}</span>
                    <span className="text-[#ddd8d0]">{v}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-6">
              <div className="rounded-md border border-[#f08c50] bg-[#f08c50] p-7 text-[#0a0908]">
                <div className="text-[10px] uppercase tracking-[0.32em]">/ pilot başvurusu</div>
                <p className="mt-3 text-base font-medium leading-snug">
                  Şirketinize özel demo + pilot program için bizimle iletişime geçin.
                  5 iş günü içinde keşif toplantımızı planlayalım.
                </p>
                <p className="mt-3 font-mono text-sm">innovahub@argusteknoloji.com.tr</p>
              </div>

              <div className="rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a] p-6">
                <div className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">[ kuruluş referansları ]</div>
                <ul className="mt-4 grid gap-2 text-xs text-[#bdb4a6]">
                  {[
                    "ISO 27001:2013 sertifikalı kuruluş",
                    "20+ tamamlanmış EU projesi (2020–2026)",
                    "30+ ülkeye yayılan ortaklık ağı",
                    "Türkiye Siber Güvenlik Kümelenmesi üyesi",
                    "Ankara Üniversitesi Teknopark resident firma",
                  ].map((m) => (
                    <li key={m} className="flex items-start gap-2">
                      <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-[#f08c50]" />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="absolute bottom-12 left-12 right-12 flex items-end justify-between text-[10px] uppercase tracking-[0.28em] text-[#6b6358] md:bottom-16 md:left-24 md:right-24">
            <div>edition 03 · 2026 · sales</div>
            <div>© argus teknoloji · altaris superagent</div>
          </div>
        </section>

        <div aria-hidden className="k-rule h-px" />
        <div className="k-no-print mx-auto max-w-6xl px-6 py-6 text-[10px] uppercase tracking-[0.28em] text-[#6b6358]">
          Yazdırmak için <span className="text-[#ddd8d0]">⌘/Ctrl + P</span>. A4 · arka plan renkleri yazdırma çıktısında korunur.
        </div>
      </main>
    </>
  );
}

function SpreadHead({ idx, tag, hint }: { idx: string; tag: string; hint: string }) {
  return (
    <div className="mb-12 flex items-baseline justify-between border-b border-[rgba(120,80,50,0.28)] pb-4">
      <div className="flex items-baseline gap-4">
        <span className="text-[11px] uppercase tracking-[0.32em] text-[#3a342d]">/ {idx}</span>
        <h2 className="text-[11px] uppercase tracking-[0.32em] text-[#ddd8d0]">{tag}</h2>
      </div>
      <span className="text-[10px] uppercase tracking-[0.28em] text-[#3a342d]">{hint}</span>
    </div>
  );
}
