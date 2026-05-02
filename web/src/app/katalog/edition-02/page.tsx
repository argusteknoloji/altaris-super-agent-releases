import Link from "next/link";

// ──────────────────────────────────────────────────────────────────────────
// Altaris Super Agent katalog — Edition 02
//
// Customer-facing kurumsal sunum kataloğu. Edition 01'in editorial terminal
// dilini koruyor; ama içerik tarafında ürün-içi mimari detaylar (port'lar,
// container topolojisi, internal bağımlılıklar, dosya yolları, dahili refresh
// flow'u, build paket boyutu vb.) çıkarıldı. Yerine Argus Teknoloji'nin
// kurumsal kimliği — 7 yıllık geçmiş, 4 ISO sertifikası, 16 platformluk
// portföy, 20+ EU projesi, 30+ ülke ortaklık ağı — yerleştirildi. Altaris,
// bu portföyde Argus'un agentic AI yüzeyi olarak konumlandı.
//
// Edition 01 hâlâ /katalog'da yaşıyor (geliştirici-iç bakış). Edition 02
// /katalog/edition-02'de — müşteri, satın alma birimi, yatırımcı için.
// ──────────────────────────────────────────────────────────────────────────

const ALTARIS_ASCII = `█▀█   █    ▀█▀   █▀█   █▀▄   █   █▀▀
█▀█   █     █    █▀█   █▀▄   █   ▀▀█
▀ ▀   ▀▀▀   ▀    ▀ ▀   ▀ ▀   ▀   ▀▀▀`;

const TOC: Array<[string, string, string]> = [
  ["00", "Kapak",                       "Edition 02 · 2026"],
  ["01", "Argus Teknoloji",             "7+ yıl · 16 platform · 4 ISO"],
  ["02", "Altaris'in Yeri",             "portföyde agentic AI yüzeyi"],
  ["03", "Vizyon",                      "kurumsal agentic AI ne demek"],
  ["04", "Dört Yüzey",                  "terminal · masaüstü · web · paylaşılan denetim"],
  ["05", "Sağlayıcı Esnekliği",         "tek panelden çoklu LLM"],
  ["06", "Kurumsal Hafıza",             "vault — paylaşılan bilgi katmanı"],
  ["07", "Güvenlik & Uyum",             "ISO · KVKK · BDDK · ZTA"],
  ["08", "Deploy Modelleri",            "cloud · on-prem · air-gapped"],
  ["09", "Sektörel Uygulama",           "kamu · finans · savunma · sağlık"],
  ["10", "Kanıtlanmış Geçmiş",          "20+ EU projesi · 30+ ülke"],
  ["11", "Pilot Programı",              "demo'dan üretime giden yol"],
  ["12", "İletişim",                    "argusteknoloji.com"],
];

const ARGUS_FACTS: Array<{ k: string; v: string; sub?: string }> = [
  { k: "kuruluş",       v: "2019",            sub: "Ankara · 7+ yıllık operasyon" },
  { k: "merkez",        v: "Ankara University Technopolis", sub: "ek ofis: Berlin (Promise IT)" },
  { k: "personel",      v: "kurumsal kadro",  sub: "AR-GE · proje yönetimi · idari" },
  { k: "portföy",       v: "16 platform",     sub: "kurumsal yazılım, AI, siber güvenlik, EdTech" },
  { k: "EU projesi",    v: "20+",             sub: "2020'den bu yana teslim edilmiş" },
  { k: "ortak ağı",     v: "25+ kurum",       sub: "30+ ülkede aktif iş birliği" },
  { k: "sertifikasyon", v: "4 ISO",           sub: "27001 · 20000-1 · 9001 · 15504 SPICE L2" },
  { k: "kümelenme",     v: "TSGK üye firma",  sub: "Türkiye Siber Güvenlik Kümelenmesi" },
];

const ISO_MATRIX: Array<[string, string]> = [
  ["ISO 27001:2013",        "Bilgi Güvenliği Yönetim Sistemi — sertifikalı"],
  ["ISO 20000-1:2011",      "BT Hizmet Yönetimi — sertifikalı"],
  ["ISO 9001:2015",         "Kalite Yönetim Sistemi — sertifikalı"],
  ["ISO 15504 SPICE L2",    "Yazılım Süreç Olgunluğu — değerlendirilmiş"],
  ["Teknogirişim",          "Teknoloji Girişimcilik Belgesi (Türkiye)"],
  ["EQYP (2016'dan beri)",  "PRISMA Avrupa Kalite Standardı"],
];

const SURFACES: Array<{ num: string; title: string; kicker: string; body: string; bullets: string[] }> = [
  {
    num: "01",
    title: "Terminal",
    kicker: "geliştirici yüzeyi",
    body: "Geliştirici, analist, operasyon ekibi için — masaüstünde yerel olarak çalışan agentik AI komut hattı. Yerel dosya sistemine erişimle bağlamlı çalışır.",
    bullets: [
      "macOS · Linux · Windows desteği",
      "Kurumsal SSO ile tek tıkla bağlantı",
      "Sektör/rol bazlı yetki sınırları",
    ],
  },
  {
    num: "02",
    title: "Masaüstü Uygulaması",
    kicker: "native — son kullanıcı",
    body: "Terminale alışkın olmayan beyaz yaka kullanıcılar için tam yerel macOS ve Windows uygulaması. Hafif binary; air-gapped USB dağıtım için ideal.",
    bullets: [
      "Tauri tabanlı, ~10 MB binary",
      "Apple notarization + Windows code-sign",
      "Built-in auto-update mekanizması",
    ],
  },
  {
    num: "03",
    title: "Web Paneli",
    kicker: "yönetim yüzeyi",
    body: "BT yöneticisi, departman lideri ve denetim ekibi için — kullanıcılar, sağlayıcılar, vault'lar ve oturum geçmişi tek panelden yönetilir.",
    bullets: [
      "Tarayıcı tabanlı sohbet ve oturum yönetimi",
      "Tam transcript & denetim izi",
      "Rol bazlı erişim kontrolü",
    ],
  },
  {
    num: "04",
    title: "Paylaşılan Denetim",
    kicker: "i̇zleme & devralma",
    body: "Uzman ekip lideri ya da iç denetim için — bir kullanıcının çalışan oturumunu canlı izle, yetkili devralma ile müdahale et, her adım kayıt altında.",
    bullets: [
      "Canlı oturum izleme (multi-viewer)",
      "Yetkili takeover ile devralma",
      "Her etkileşim için audit kaydı",
    ],
  },
];

const PROVIDERS_PUBLIC: Array<{ name: string; type: "cloud" | "lokal"; positioning: string }> = [
  { name: "Anthropic Claude",     type: "cloud", positioning: "Üst-tier muhakeme · uzun bağlam" },
  { name: "OpenAI GPT",           type: "cloud", positioning: "Genel amaçlı · geniş ekosistem" },
  { name: "ChatGPT (Codex)",      type: "cloud", positioning: "Mevcut ChatGPT planını bağla" },
  { name: "Google Gemini",        type: "cloud", positioning: "Multimodal · görüntü + metin" },
  { name: "Mistral",              type: "cloud", positioning: "Avrupa-merkezli · açık ağırlıklar" },
  { name: "Yerli açık-ağırlık",   type: "lokal", positioning: "Llama · Qwen · DeepSeek — kurum içi GPU" },
  { name: "Özel kurum modelleri", type: "lokal", positioning: "Müşteriye özel ince-ayar (fine-tune)" },
];

const VALUE_PILLARS: Array<[string, string]> = [
  [
    "Çoklu Kiracı İzolasyonu",
    "Tek altyapı, kurum-içi tam izolasyon. Bir tenant'ın verisi başka bir tenant'tan asla görülmez — veritabanı seviyesinde mecburi politika.",
  ],
  [
    "Tam Denetim Kaydı",
    "KVKK ve iç denetim için her API çağrısı, her sağlayıcı geçişi, her takeover olayı kalıcı olarak loglanır. Auditöre tek tıkla teslim edilir.",
  ],
  [
    "Tek SSO ile Tüm Yüzeyler",
    "Kurumsal kimlik sağlayıcınızla (Active Directory, Okta, Keycloak) federasyon. Kullanıcı bir kez giriş yapar, terminal · web · denetim panellerine erişir.",
  ],
  [
    "Sağlayıcı Bağımsızlığı",
    "Tek bir LLM sağlayıcısına kilitlenme yok. Anthropic, OpenAI, yerli modeller — birinden diğerine geçiş tek panelde yapılır, ekipler kullanım alışkanlığını değiştirmez.",
  ],
  [
    "Paylaşılan Kurumsal Bilgi",
    "Vault katmanı, ekibinizin paylaştığı doküman ve kararları LLM'e bağlam olarak verir. Yeni gelen ekip üyesi, kurumun paylaşılan zihniyle çalışmaya hemen başlar.",
  ],
  [
    "Türk Mühendisliği",
    "%100 yerli AR-GE. Ankara Üniversitesi Teknopark'ta geliştirilir. Kurumsal müşteri için doğrudan kaynak destek — saat farkı yok, dil bariyeri yok.",
  ],
];

const COMPLIANCE: Array<{ tag: string; title: string; lines: string[] }> = [
  {
    tag: "kvkk",
    title: "KVKK Uyumu",
    lines: [
      "Kişisel veri sınıflandırma ve sınır politikaları yapılandırılabilir.",
      "Madde 6 hassas veri için ek erişim katmanı.",
      "Veri sahibinin başvurusuna 30 gün içinde teknik yanıt altyapısı.",
      "Yerli/on-prem deploy ile sıfır data-egress.",
    ],
  },
  {
    tag: "iso 27001",
    title: "ISO 27001 Uyumu",
    lines: [
      "Argus Teknoloji ISO 27001:2013 sertifikalı kuruluştur.",
      "Erişim kontrolü, log koruma, sürekli izleme süreçleri uygulanmıştır.",
      "Risk yönetimi ve olay müdahalesi prosedürleri yazılı.",
      "Yıllık gözetim denetimi geçilmiş.",
    ],
  },
  {
    tag: "bddk",
    title: "BDDK & Finansal Sektör",
    lines: [
      "BDDK Bilgi Sistemleri Tebliği uyumlu mimari.",
      "Sıfır data-egress on-prem mod.",
      "PII redaction katmanı (TCKN, kart no, IBAN vb.).",
      "5651 kapsamında log saklama hazır.",
    ],
  },
  {
    tag: "zta",
    title: "Sıfır Güven Mimarisi",
    lines: [
      "Hiçbir kullanıcı/oturum/istek varsayılan olarak güvenilir değildir.",
      "Her API çağrısı kimlik + rol + bağlam bazlı yetkilendirilir.",
      "Asgari yetki ilkesi — ekiplerin sadece kapsamına uygun erişim.",
      "MyD (Argus Zero Trust IAM) ile entegrasyon mümkün.",
    ],
  },
];

const DEPLOY: Array<{ tag: string; title: string; hint: string; bullets: string[] }> = [
  {
    tag: "cloud",
    title: "Bulut",
    hint: "argus yönetimli",
    bullets: [
      "Avrupa veri merkezleri",
      "Argus tarafında patch & güncelleme",
      "Üst-tier model sağlayıcılar dahil",
      "Hızlı pilot, düşük başlangıç eforu",
    ],
  },
  {
    tag: "on-prem",
    title: "On-Prem",
    hint: "müşteri datacenter",
    bullets: [
      "Müşterinin kendi sunucularında çalışır",
      "Veri kurumun firewall'ı dışına çıkmaz",
      "Yerli LLM seçeneği aktif",
      "Müşteri SLA paketine göre destek",
    ],
  },
  {
    tag: "air-gapped",
    title: "Hava Boşluklu",
    hint: "i̇nternetsiz",
    bullets: [
      "Sıfır internet bağlantısı",
      "İmzalı offline güncelleme paketleri",
      "Sadece yerli modeller",
      "Savunma, kamu, kritik altyapı için",
    ],
  },
];

const SECTORS: Array<{ tag: string; title: string; lines: string[] }> = [
  {
    tag: "kamu",
    title: "Kamu / E-Devlet",
    lines: [
      "Vatandaş verisi ülke sınırı dışına çıkmaz.",
      "Bakanlık bazlı tenant izolasyonu.",
      "Yerli LLM ile bağımsız operasyon.",
    ],
  },
  {
    tag: "finans",
    title: "Bankacılık & Finans",
    lines: [
      "BDDK uyumu için sıfır data-egress mimari.",
      "PII redaction katmanı.",
      "Trader masaları için ortak denetim.",
    ],
  },
  {
    tag: "savunma",
    title: "Savunma Sanayii",
    lines: [
      "Air-gapped LAN'da tam çalışır.",
      "Gizlilik seviyesine uygun yerli modeller.",
      "Komuta zinciri için rol-tabanlı yetki.",
    ],
  },
  {
    tag: "sağlık",
    title: "Sağlık & Hastane",
    lines: [
      "On-prem vault — KVKK Madde 6 hassas veri.",
      "Multi-disipliner konsey için paylaşılan oturum.",
      "Hastane bilgi sistemi entegrasyonu.",
    ],
  },
];

const TRACK_RECORD: Array<{ k: string; v: string; sub: string }> = [
  { k: "EU projeleri",       v: "20+",   sub: "2020'den bu yana teslim edilmiş, çok-ortaklı uluslararası araştırma & geliştirme" },
  { k: "Ortak kurum",        v: "25+",   sub: "Avrupa, MENA, Türkiye genelinde aktif iş ortaklığı ağı" },
  { k: "Ülke ağı",           v: "30+",   sub: "Ortaklık, müşteri ve teknik iş birliği yapılan ülkeler" },
  { k: "Yıl",                v: "7+",    sub: "Argus Teknoloji'nin sürekli operasyon süresi (2019'dan beri)" },
  { k: "Strateji ürün",      v: "7",     sub: "Kendi sayfası olan amiral ürünler (PROMISE, ENTERPLAN, MyD, BILGER, ViDi…)" },
  { k: "Toplam platform",    v: "16",    sub: "Argus AR-GE'sinde geliştirilen sahipli yazılım platformları" },
];

export default function KatalogEdition2Page() {
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
              <span className="text-[#ddd8d0]">edition 02</span>
              <span className="text-[#3a342d]">·</span>
              <span>2026</span>
            </div>
            <span className="hidden md:inline-flex text-[10px] uppercase tracking-[0.28em] text-[#6b6358]">⌘ + p · pdf'e bas</span>
          </div>
        </header>

        {/* 00 — KAPAK */}
        <section className="k-spread mx-auto max-w-6xl">
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">
            <span>argus teknoloji</span>
            <span aria-hidden className="h-px w-10 bg-[#3a342d]" />
            <span>ankara · berlin</span>
            <span aria-hidden className="h-px w-10 bg-[#3a342d]" />
            <span>ankara üniversitesi teknopark</span>
          </div>

          <pre
            aria-label="Altaris"
            className="k-reveal k-shimmer mt-12 select-none whitespace-pre font-bold leading-[1.05] tracking-[0.02em] text-[clamp(13px,2.0vw,24px)]"
            style={{ animationDelay: "100ms" }}
          >
{ALTARIS_ASCII}
          </pre>

          <div className="mt-16 max-w-3xl">
            <div className="text-[10px] uppercase tracking-[0.32em] text-[#3a342d]">/ kurumsal katalog · edition 02</div>
            <h1 className="mt-4 text-[clamp(28px,4vw,56px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">{"// "}</span>
              Kurumsal Agentic AI <span className="k-grad">Süper Ajan</span> Platformu
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-relaxed text-[#9b9285]">
              Argus Teknoloji'nin ileri AR-GE çıktısı. Kurum içinde paylaşılan zihne sahip,
              sağlayıcı bağımsız, denetlenebilir, on-prem deploy edilebilen kurumsal süper ajan.
              Bu katalog; karar vericiler, BT direktörleri ve teknoloji satın alma birimleri için
              hazırlanmıştır.
            </p>
          </div>

          <div className="absolute bottom-12 left-12 right-12 flex items-end justify-between text-[10px] uppercase tracking-[0.28em] text-[#6b6358] md:bottom-16 md:left-24 md:right-24">
            <div className="space-y-1">
              <div className="text-[#ddd8d0]">edition 02 · 2026</div>
              <div className="text-[#3a342d]">argusteknoloji.com</div>
            </div>
            <div className="space-y-1 text-right">
              <div className="text-[#ddd8d0]">ı̇so 27001 sertifikalı kuruluş</div>
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

        {/* 01 — ARGUS TEKNOLOJİ */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="01" tag="argus teknoloji" hint="kuruluş portresi" />
          <div className="grid gap-12 md:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="text-[clamp(20px,2.4vw,32px)] font-light leading-[1.3] text-[#ddd8d0]">
                Argus Teknoloji,{" "}
                <span className="k-grad">2019'da Ankara Üniversitesi Teknopark</span>'ta
                kurulan, Avrupa Birliği'nde 30+ ülkeyi kapsayan ortaklık ağına ve 16 sahipli yazılım
                platformuna sahip{" "}
                <span className="text-[#bdb4a6]">AR-GE odaklı bir teknoloji firmasıdır</span>.
              </p>
              <p className="mt-7 text-sm leading-relaxed text-[#9b9285]">
                Kurumsal yazılım, yapay zekâ, siber güvenlik, eğitim teknolojileri ve AB Ar-Ge
                projeleri olmak üzere beş ana hatta operasyon yürütür. Türkiye merkezinde
                geliştirilir; Berlin'deki bağlı kuruluş ile Avrupa pazarına entegre çalışır.
              </p>
              <p className="mt-5 text-sm leading-relaxed text-[#9b9285]">
                Türkiye Siber Güvenlik Kümelenmesi üyesi; ISO 27001 dahil dört adet ISO sertifikası
                aktif; PRISMA Avrupa Kalite Standardı 2016'dan bu yana sürdürülmektedir.
              </p>
            </div>
            <div className="space-y-3">
              {ARGUS_FACTS.map((f) => (
                <div key={f.k} className="border-l border-[rgba(120,80,50,0.32)] pl-4">
                  <div className="text-[10px] uppercase tracking-[0.28em] text-[#7a7166]">{f.k}</div>
                  <div className="mt-1 text-base text-[#ddd8d0]">{f.v}</div>
                  {f.sub && <div className="mt-0.5 text-xs leading-relaxed text-[#7a7166]">{f.sub}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 02 — ALTARIS'IN YERI */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="02" tag="altaris'in yeri" hint="portföydeki konum" />
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <p className="text-[clamp(20px,2.4vw,32px)] font-light leading-[1.3] text-[#ddd8d0]">
                Altaris, Argus'un 16 platformluk portföyünde{" "}
                <span className="k-grad">kurumun agentic AI yüzeyidir</span>.
              </p>
              <p className="mt-6 text-sm leading-relaxed text-[#bdb4a6]">
                Süper ajan; ekibinizin terminalinde, web panelinde ve uzak denetim
                masasında aynı anda görülür. PROMISE, ENTERPLAN ve diğer Argus platformlarıyla
                aynı kurumsal yazılım disiplini, aynı sertifikasyon zemini, aynı Türk mühendislik
                ekibinden çıkar.
              </p>
              <p className="mt-5 text-sm leading-relaxed text-[#bdb4a6]">
                Zero Trust IAM ürünümüz <em className="text-[#ddd8d0] not-italic">MyD</em> ile,
                doküman ve iş akışı ürünümüz <em className="text-[#ddd8d0] not-italic">Argus IGYS</em> ile,
                kurumsal AI motoru <em className="text-[#ddd8d0] not-italic">ORBIT ENGINE</em> ile entegre
                çalışacak şekilde tasarlandı.
              </p>
            </div>
            <div className="rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a] p-7 md:p-8">
              <div className="mb-5 flex items-baseline justify-between border-b border-[rgba(120,80,50,0.22)] pb-3">
                <span className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">[ portfolyo ]</span>
                <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">argus suite</span>
              </div>
              <ul className="space-y-3 text-[13px]">
                {[
                  ["PROMISE",       "NoCode kurumsal ekosistem (amiral)"],
                  ["ENTERPLAN",     "Kamu ERP (9 çekirdek + 14 ek modül)"],
                  ["Argus IGYS",    "Doküman & iş akışı (MEB)"],
                  ["ORBIT ENGINE",  "Kurumsal AI & otomasyon"],
                  ["MyD",           "Zero Trust IAM"],
                  ["BILGER",        "LMS"],
                  ["ViDi",          "KVKK uyumlu video konferans"],
                  ["Altaris",       "Kurumsal Agentic AI Süper Ajan"],
                ].map(([n, d], i) => {
                  const isAltaris = n === "Altaris";
                  return (
                    <li key={n} className={`grid grid-cols-[8rem_1fr] items-baseline gap-3 ${i > 0 ? "border-t border-[rgba(120,80,50,0.18)] pt-3" : ""}`}>
                      <span className={`text-[11px] uppercase tracking-[0.22em] ${isAltaris ? "text-[#ffb464]" : "text-[#f08c50]/70"}`}>
                        {isAltaris ? "★ " : ""}{n}
                      </span>
                      <span className={isAltaris ? "text-[#ddd8d0]" : "text-[#bdb4a6]"}>{d}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-5 border-t border-[rgba(120,80,50,0.22)] pt-3 text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">
                tam liste için <span className="text-[#f08c50]">argusteknoloji.com</span>
              </div>
            </div>
          </div>
        </section>

        {/* 03 — VİZYON */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="03" tag="vizyon" hint="kurumsal agentic ai" />
          <div className="space-y-10">
            <p className="text-[clamp(20px,2.4vw,32px)] font-light leading-[1.3] text-[#ddd8d0]">
              Kurumsal ekipler agentic AI'dan faydalanmak istiyor;
              <br className="hidden md:block" />
              ama mevcut çözümler ya{" "}
              <span className="text-[#7a7166]">veriyi sınır dışına çıkarıyor</span>, ya{" "}
              <span className="text-[#7a7166]">tek bir model sağlayıcısına kilitliyor</span>, ya da{" "}
              <span className="text-[#7a7166]">terminal ve web yüzeylerini birbirinden kopuk bırakıyor</span>.
            </p>
            <p className="text-[clamp(20px,2.4vw,32px)] font-light leading-[1.3] text-[#ddd8d0]">
              Altaris, <span className="k-grad">tek panel · sağlayıcı bağımsız · denetlenebilir</span>{" "}
              bir omurga ile bu üç sorunu da kapatır.
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              {VALUE_PILLARS.slice(0, 3).map(([k, v]) => (
                <ValueTile key={k} title={k} body={v} />
              ))}
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {VALUE_PILLARS.slice(3).map(([k, v]) => (
                <ValueTile key={k} title={k} body={v} />
              ))}
            </div>
          </div>
        </section>

        {/* 04 — DÖRT YÜZEY */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="04" tag="dört yüzey" hint="terminal · masaüstü · web · denetim" />
          <div className="grid gap-px overflow-hidden rounded-md border border-[rgba(120,80,50,0.28)] bg-[rgba(120,80,50,0.28)] md:grid-cols-2">
            {SURFACES.map((s) => (
              <div key={s.num} className="bg-[#0d0b0a] p-7 md:p-8">
                <div className="mb-6 flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-[0.32em] text-[#3a342d]">/{s.num}</span>
                  <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">{s.kicker}</span>
                </div>
                <h4 className="mb-4 text-xl font-medium tracking-tight text-[#ddd8d0]">{s.title}</h4>
                <p className="text-[13px] leading-relaxed text-[#9b9285]">{s.body}</p>
                <ul className="mt-6 space-y-2 border-t border-[rgba(120,80,50,0.18)] pt-5 text-xs">
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

        {/* 05 — SAĞLAYICI ESNEKLİĞİ */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="05" tag="sağlayıcı esnekliği" hint="tek panelden çoklu llm" />
          <div className="overflow-hidden rounded-md border border-[rgba(120,80,50,0.28)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[rgba(120,80,50,0.28)] bg-[#0d0b0a] text-[10px] uppercase tracking-[0.28em] text-[#7a7166]">
                  <th className="px-5 py-3 font-normal">sağlayıcı</th>
                  <th className="px-5 py-3 font-normal">tip</th>
                  <th className="px-5 py-3 font-normal">konumlama</th>
                </tr>
              </thead>
              <tbody>
                {PROVIDERS_PUBLIC.map((p, i) => (
                  <tr key={p.name} className={i % 2 === 0 ? "bg-[#0a0908]" : "bg-[#0d0b0a]"}>
                    <td className="border-t border-[rgba(120,80,50,0.18)] px-5 py-4 text-[#ddd8d0]">{p.name}</td>
                    <td className="border-t border-[rgba(120,80,50,0.18)] px-5 py-4">
                      <span className={`inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] ${p.type === "lokal" ? "text-[#9bd07e]" : "text-[#f08c50]"}`}>
                        <span aria-hidden className={`size-1.5 rounded-full ${p.type === "lokal" ? "bg-[#9bd07e]" : "bg-[#f08c50]"}`} />
                        {p.type}
                      </span>
                    </td>
                    <td className="border-t border-[rgba(120,80,50,0.18)] px-5 py-4 text-[13px] text-[#bdb4a6]">{p.positioning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 max-w-3xl text-xs leading-relaxed text-[#7a7166]">
            Tek bir LLM sağlayıcısına kilitlenmezsiniz. Yöneticiniz BT panelinden tenant bazlı
            sağlayıcı kataloğunu düzenler; kullanıcılar terminal/web içindeki sağlayıcı menüsünden
            mid-session geçiş yapar. Veri hangi sağlayıcıya gideceği kurum politikasıyla
            belirlenir — bu bilgi auditörün okuyabileceği şekilde kayıt altındadır.
          </p>
        </section>

        {/* 06 — KURUMSAL HAFIZA */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="06" tag="kurumsal hafıza" hint="vault — paylaşılan bilgi katmanı" />
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <p className="text-base leading-relaxed text-[#bdb4a6]">
                <span className="k-grad font-medium">Vault</span>, ekibinizin paylaştığı doküman,
                karar, prosedür ve bağlam bilgilerinin LLM tarafından bağlam olarak kullanılan
                kurumsal hafıza katmanıdır.
              </p>
              <p className="mt-5 text-sm leading-relaxed text-[#9b9285]">
                Üç görünürlük seviyesi destekler:{" "}
                <span className="text-[#f08c50]">private</span> (sadece kullanıcı),{" "}
                <span className="text-[#f08c50]">tenant</span> (tüm ekip),{" "}
                <span className="text-[#f08c50]">executive</span> (üst yönetim cross-vault sentez).
                Her seviye, yetki politikalarıyla yönetilir.
              </p>
              <p className="mt-5 text-sm leading-relaxed text-[#9b9285]">
                Yeni gelen ekip üyesi, ilk gününden itibaren kurumun paylaşılan zihniyle çalışmaya
                başlar. Eski iş bilgisi, alınmış kararlar, müşteri tarihçesi tek bir aramayla
                ulaşılabilir.
              </p>
            </div>
            <div className="space-y-4">
              {[
                ["Görünürlük",     "Private (kullanıcı) · Tenant (ekip) · Executive (yönetim)"],
                ["Arama",          "Tam metin + bulanık eşleşme · saniyenin altında yanıt"],
                ["Format",         "Markdown · Obsidian uyumlu · doğal dosya hiyerarşisi"],
                ["Yetkilendirme",  "RBAC · vault başına granular kontrol"],
                ["Versiyon",       "Sürüm geçmişi · değişiklik denetim izi"],
                ["Entegrasyon",    "MCP server adaptörleri · kurum içi sistemlerle köprü"],
              ].map(([k, v]) => (
                <div key={k} className="border-l border-[rgba(120,80,50,0.32)] pl-4">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-[#f08c50]/80">{k}</div>
                  <div className="mt-1 text-sm leading-relaxed text-[#bdb4a6]">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 07 — GÜVENLİK & UYUM */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="07" tag="güvenlik & uyum" hint="iso · kvkk · bddk · zta" />
          <div className="mb-8 rounded-md border border-[rgba(240,140,80,0.35)] bg-[#1a1612] p-5">
            <div className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">/ kuruluş sertifikasyonu</div>
            <p className="mt-3 text-sm leading-relaxed text-[#bdb4a6]">
              Argus Teknoloji, ISO 27001:2013 dahil dört adet uluslararası ISO standardına ve
              EQYP Avrupa Kalite Standardı'na sahiptir. Altaris, bu kurumsal güvenlik temelinin
              üzerine inşa edilmiştir.
            </p>
            <ul className="mt-4 grid gap-2 text-xs md:grid-cols-2">
              {ISO_MATRIX.map(([k, v]) => (
                <li key={k} className="flex items-start gap-3">
                  <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-[#f08c50]" />
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-[#ffb464]">{k}</div>
                    <div className="mt-0.5 text-[#9b9285]">{v}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {COMPLIANCE.map((c) => (
              <div key={c.tag} className="rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a] p-5">
                <div className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">[ {c.tag} ]</div>
                <h4 className="mt-3 text-base font-medium text-[#ddd8d0]">{c.title}</h4>
                <ul className="mt-4 space-y-2 text-[12px] leading-relaxed text-[#bdb4a6]">
                  {c.lines.map((l, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-[#f08c50]/60" />
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* 08 — DEPLOY */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="08" tag="deploy modelleri" hint="cloud · on-prem · air-gapped" />
          <div className="grid gap-6 md:grid-cols-3">
            {DEPLOY.map((d) => (
              <div key={d.tag} className="rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a]">
                <div className="flex items-baseline justify-between border-b border-[rgba(120,80,50,0.22)] px-6 py-4">
                  <span className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">[ {d.tag} ]</span>
                  <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">{d.hint}</span>
                </div>
                <div className="px-6 pb-6 pt-5">
                  <h4 className="text-[clamp(20px,2.4vw,26px)] font-light tracking-tight text-[#ddd8d0]">{d.title}</h4>
                  <ul className="mt-6 space-y-3 text-[13px] leading-relaxed text-[#bdb4a6]">
                    {d.bullets.map((p, i) => (
                      <li key={p} className={`flex items-start gap-3 ${i > 0 ? "border-t border-[rgba(120,80,50,0.18)] pt-3" : ""}`}>
                        <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-[#f08c50]/70" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-3xl text-xs leading-relaxed text-[#7a7166]">
            Müşteriniz hangi seviyede hassasiyet gerektiriyorsa, ona uygun deploy seçeneği
            sunulur. Modüller arası geçiş mümkündür — bulutta başlayıp on-prem'e taşınabilir,
            on-prem'den air-gapped'e geçilebilir.
          </p>
        </section>

        {/* 09 — SEKTÖREL */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="09" tag="sektörel uygulama" hint="kullanım senaryoları" />
          <div className="grid gap-px overflow-hidden rounded-md border border-[rgba(120,80,50,0.28)] bg-[rgba(120,80,50,0.28)] md:grid-cols-2">
            {SECTORS.map((s) => (
              <div key={s.tag} className="bg-[#0d0b0a] p-7 md:p-8">
                <div className="mb-5 flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">[ {s.tag} ]</span>
                  <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">use.case</span>
                </div>
                <h4 className="mb-5 text-xl font-medium tracking-tight text-[#ddd8d0]">{s.title}</h4>
                <ul className="space-y-3 text-[13px] leading-relaxed text-[#bdb4a6]">
                  {s.lines.map((l, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-[#f08c50]/60" />
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* 10 — TRACK RECORD */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="10" tag="kanıtlanmış geçmiş" hint="argus track record" />
          <div className="grid gap-6 md:grid-cols-3">
            {TRACK_RECORD.map((t) => (
              <div key={t.k} className="rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a] p-6">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#7a7166]">{t.k}</div>
                <div className="mt-3 text-[clamp(36px,4vw,52px)] font-light leading-none text-[#ddd8d0]">{t.v}</div>
                <div className="mt-3 text-xs leading-relaxed text-[#7a7166]">{t.sub}</div>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a] p-7 md:p-8">
            <div className="flex items-baseline justify-between border-b border-[rgba(120,80,50,0.22)] pb-3">
              <span className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">[ üyelikler & i̇ş birlikleri ]</span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">network</span>
            </div>
            <ul className="mt-5 grid gap-3 text-sm md:grid-cols-2">
              {[
                "Türkiye Siber Güvenlik Kümelenmesi (TSGK)",
                "Ankara Üniversitesi Teknopark",
                "Ankara Ticaret Odası (ATO)",
                "Türkiye İhracatçılar Meclisi (TİM)",
                "Türkiye Ulusal Ajansı (Erasmus+)",
                "Avrupa Komisyonu (PIC: 899822150)",
                "Hizmet İhracatçıları Birliği",
                "Devlet Malzeme Ofisi (DMO)",
                "PRISMA European Network",
              ].map((m) => (
                <li key={m} className="flex items-start gap-3 text-[#bdb4a6]">
                  <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-[#f08c50]/70" />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 11 — PİLOT */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="11" tag="pilot programı" hint="demo'dan üretime" />
          <div className="grid gap-12 md:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="text-[clamp(20px,2.4vw,30px)] font-light leading-[1.3] text-[#ddd8d0]">
                Kurum içi veriden bir bayt çıkarmadan{" "}
                <span className="k-grad">agentik AI çalıştırmaya</span>{" "}
                hazırsanız — pilot programıyla başlayalım.
              </p>
              <p className="mt-6 text-sm leading-relaxed text-[#9b9285]">
                Pilot süreci, Argus'un standart kurumsal yazılım entegrasyon disiplinine göre
                yürütülür. Her adım yazılı bir mutabakatla başlar, çıktısı ölçülerek tamamlanır.
              </p>
            </div>
            <div className="rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a] p-7 md:p-8">
              <ol className="space-y-6 text-sm">
                {[
                  ["01", "Keşif Görüşmesi",      "30–45 dk · NDA imzalı toplantı. Kullanım senaryosu, veri sınıflandırması, deploy beklentileri tespiti.", "1. hafta"],
                  ["02", "Pilot Kapsamı",        "Sınırlı tenant, 5–15 kullanıcı, 1–3 sektörel use case. Başarı kriterleri yazılı.",                       "1–2. hafta"],
                  ["03", "Deploy & Eğitim",      "Cloud sandbox veya müşteri datacenter. Yöneticilere panel eğitimi, kullanıcılara başlangıç kılavuzu.",     "2–4. hafta"],
                  ["04", "Üretim Geçişi",        "SLA paketi · sürekli destek · sertifika ve dokümantasyon teslimi · roll-out planı.",                       "ay 2 sonu"],
                ].map(([n, t, d, w]) => (
                  <li key={n} className="grid grid-cols-[2.5rem_1fr] items-baseline gap-4">
                    <span className="text-[11px] uppercase tracking-[0.28em] text-[#f08c50]/80">{n}</span>
                    <div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium text-[#ddd8d0]">{t}</span>
                        <span className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">{w}</span>
                      </div>
                      <div className="mt-1 text-xs leading-relaxed text-[#7a7166]">{d}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* 12 — İLETİŞİM */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="12" tag="i̇letişim" hint="back cover" />
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <h3 className="text-[clamp(22px,2.8vw,32px)] font-light tracking-tight text-[#ddd8d0]">
                Argus Teknoloji A.Ş.
              </h3>
              <p className="mt-2 text-xs uppercase tracking-[0.28em] text-[#7a7166]">
                Argus Teknoloji Bilişim Sanayi Ticaret Anonim Şirketi
              </p>
              <ul className="mt-7 space-y-3 text-sm">
                {[
                  ["adres",     "Bahçelievler Mah. 319 Cad. E Blok (Teknokent), No:35 E/Z18, 06830 Gölbaşı / Ankara"],
                  ["e-posta",   "innovahub@argusteknoloji.com.tr"],
                  ["telefon",   "+90 850 840 65 36"],
                  ["mobil",     "+90 535 466 07 21"],
                  ["web",       "argusteknoloji.com"],
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
              <div className="rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a] p-7">
                <div className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">[ kurumsal kimlik ]</div>
                <ul className="mt-4 space-y-2 text-xs">
                  {[
                    ["Kuruluş",  "Ocak 2019"],
                    ["Tip",      "SME · ARGE odaklı"],
                    ["OID",      "E10020233"],
                    ["PIC",      "899822150"],
                    ["VAT",      "0740892601"],
                    ["Kategori", "Teknoloji Geliştirme Bölgesi rezident firması"],
                  ].map(([k, v]) => (
                    <li key={k} className="grid grid-cols-[6rem_1fr] items-baseline gap-3 border-b border-[rgba(120,80,50,0.15)] py-1.5">
                      <span className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">{k}</span>
                      <span className="font-mono text-[#bdb4a6]">{v}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-md border border-[#f08c50] bg-[#f08c50] p-7 text-[#0a0908]">
                <div className="text-[10px] uppercase tracking-[0.32em]">/ pilot başvurusu</div>
                <p className="mt-3 text-base font-medium leading-snug">
                  Kurumsal demo + pilot programı için bizimle iletişime geçin. 5 iş günü içinde
                  ilk keşif görüşmemizi planlayalım.
                </p>
                <p className="mt-3 font-mono text-sm">innovahub@argusteknoloji.com.tr</p>
              </div>
            </div>
          </div>

          <div className="absolute bottom-12 left-12 right-12 flex items-end justify-between text-[10px] uppercase tracking-[0.28em] text-[#6b6358] md:bottom-16 md:left-24 md:right-24">
            <div>edition 02 · 2026</div>
            <div>© argus teknoloji · altaris süper ajan</div>
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

function ValueTile({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a] p-5">
      <div className="text-[11px] uppercase tracking-[0.28em] text-[#f08c50]/80">{title}</div>
      <p className="mt-3 text-xs leading-relaxed text-[#bdb4a6]">{body}</p>
    </div>
  );
}
