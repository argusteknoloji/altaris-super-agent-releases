// ──────────────────────────────────────────────────────────────────────────
// Lightweight i18n for Altaris marketing surfaces.
//
// Default locale = EN. If `altaris_locale` cookie is present we honour it,
// otherwise we look at the browser's Accept-Language header and pick TR if
// Turkish is the primary preference. No external dependency, no router
// magic — just one dict + one server-side detector + one server action.
// ──────────────────────────────────────────────────────────────────────────

import { cookies, headers } from "next/headers";

export type Locale = "en" | "tr" | "de";

export const LOCALE_COOKIE = "altaris_locale";

export async function detectLocale(): Promise<Locale> {
  const c = await cookies();
  const fromCookie = c.get(LOCALE_COOKIE)?.value;
  if (fromCookie === "tr" || fromCookie === "en" || fromCookie === "de") return fromCookie;

  const h = await headers();
  const al = (h.get("accept-language") ?? "").toLowerCase();
  // first preferred lang, e.g. "tr-tr,tr;q=0.9,en;q=0.8"
  const first = al.split(",")[0]?.trim() ?? "";
  if (first.startsWith("tr")) return "tr";
  if (first.startsWith("de")) return "de";
  return "en";
}

// ──────────────────────────────────────────────────────────────────────────
// Dictionary
// ──────────────────────────────────────────────────────────────────────────

type Scene = {
  num: string;
  title: string;
  line: string;
  meta: [string, string, string];
  tag: string;
};

type DictShape = {
  nav: {
    cloud: string;
    live: string;
    panel: string;
    signIn: string;
    scenes: string;
    chapters: string;
    home: string;
    altaris: string;
    manifesto: string;
  };
  hero: {
    metaCities: string;
    metaYear: string;
    taglinePre: string;
    taglineGrad: string;
    taglinePost: string;
    description: string;
    cmdHint: string;
  };
  surfaces: {
    head: string;
    hint: string;
    terminal: { title: string; body: string };
    desktop:  { title: string; body: string };
    web:      { title: string; body: string };
    remote:   { title: string; body: string };
  };
  whoFor: {
    head: string;
    hint: string;
    cloud: { title: string; subtitle: string; tag: string; points: string[] };
    onprem:{ title: string; subtitle: string; tag: string; points: string[] };
  };
  spine: {
    head: string;
    hint: string;
    items: Array<[string, string]>;
  };
  manifesto: {
    head: string;
    hint: string;
    title1: string;
    titleGrad: string;
    title3: string;
    lede: string;
    cta: string;
    tease: {
      head: string;
      them: string;
      us: string;
      rows: Array<[string, string, string]>; // [label, them, us]
    };
  };
  scenes: {
    head: string;
    hint: string;
    title1: string;
    titleGrad: string;
    title3: string;
    lede: string;
    cta: string;
    livePreview: string;
    keyboardHint: string;
    seeAll: string;
    chapter: string; // "xiii chapters" / "xiii bölüm"
    list: Scene[];
    pageTitleA: string;     // "thirteen moments —"
    pageTitleGrad: string;  // "where decisions"
    pageTitleC: string;     // "cannot wait."
    pageLede: string;
    sectionHead: string;    // "thirteen scenes" / "on üç sahne"
    nowPlaying: string;
    watch: string;
    playing: string;
    fallbackPause: string;
    keyNav: string;
    keyPlay: string;
    keySound: string;
    keyFs: string;
    fullscreen: string;
    backHome: string;
  };
  start: {
    head: string;
    line1: string;
    lineGrad: string;
    cta: string;
    requestDemo: string;
  };
  footer: {
    edition: string;
    copy: string;
  };
  langSwitch: { tr: string; en: string; de: string };
};

export const dict: Record<Locale, DictShape> = {
  // ─── EN ──────────────────────────────────────────────────────────────
  // NOTE: UI label strings (nav, head, hint, cta, meta) are written in
  //   ASCII UPPERCASE because the design uses CSS `text-transform: uppercase`
  //   and the root <html lang="tr"> would otherwise produce dotted "İ" for
  //   lowercase "i" (Turkish casing rule). Body sentences stay natural-case.
  en: {
    nav: {
      cloud: "CLOUD", live: "LIVE",
      panel: "GO TO PANEL", signIn: "SIGN IN",
      scenes: "SCENES", chapters: "XVI",
      home: "HOME", altaris: "ALTARIS",
      manifesto: "MANIFESTO",
    },
    hero: {
      metaCities: "ISTANBUL · ANKARA · BERLIN",
      metaYear: "2026",
      taglinePre: "the ",
      taglineGrad: "agentic AI",
      taglinePost: " terminal for enterprise teams.",
      description:
        "A local altaris command, a single web-based control panel, on-prem or cloud deploy. GDPR-aligned audit trail, tenant-isolated data, vault-based institutional memory — one binary, one control plane, your team's shared mind.",
      cmdHint: "ALTARIS",
    },
    surfaces: {
      head: "FOUR SURFACES",
      hint: "TERMINAL · DESKTOP · WEB · REMOTE",
      terminal: {
        title: "Terminal",
        body:
          "An agentic shell powered by the altaris command and a local LLM. One binary across macOS, Linux, Windows. Cloud and on-prem providers — all behind a single tenant setting.",
      },
      desktop: {
        title: "Desktop",
        body:
          "Native macOS and Windows app for users not at home in a terminal. Tauri-based, ~10 MB binary. Auto-update, code-signed, fit for air-gapped USB delivery.",
      },
      web: {
        title: "Web Chat",
        body:
          "Sign in from the browser, converse over your team's shared institutional memory. Vault-based context, full transcript, session history — every conversation auditable from the admin panel.",
      },
      remote: {
        title: "Remote Control",
        body:
          "Watch and take over local altaris sessions from the web. Multi-viewer oversight, authorized takeover, an audit record for every keystroke.",
      },
    },
    whoFor: {
      head: "WHO IT'S FOR",
      hint: "CLOUD · ON-PREM",
      cloud: {
        title: "Cloud",
        subtitle: "Fast start, top-tier models",
        tag: "CLOUD",
        points: [
          "Top-tier cloud model selection",
          "Tenant-isolated data at the database layer",
          "Enterprise SSO ready",
          "Bring-your-own model accounts via the browser",
        ],
      },
      onprem: {
        title: "On-Prem",
        subtitle: "Not a single byte leaves your premises",
        tag: "ON-PREM",
        points: [
          "Connects to in-house model infrastructure",
          "On-premises database and identity management",
          "Air-gapped install, sealed update packages",
          "Aligned to GDPR + ISO 27001 for public sector, defense, finance",
        ],
      },
    },
    spine: {
      head: "ENTERPRISE BACKBONE",
      hint: "6 PILLARS",
      items: [
        ["Tenant data isolation",
         "Tenant-level partitioning on a single physical database with strict access policies."],
        ["GDPR-aligned audit",
         "Every action, privileged access and model switch is centrally logged. A fully traceable enterprise trail."],
        ["Enterprise SSO",
         "CLI, web and admin panel sign in over the same enterprise identity provider."],
        ["Model abstraction layer",
         "Cloud and on-prem providers are managed under a single tenant setting; switching is controlled in-session."],
        ["Vault-based memory",
         "Vault-based enterprise knowledge base with powerful search and shared context."],
        ["Container-only install",
         "docker compose up · 6 services · auto-start on boot. One command, one panel, zero hand-rolled configuration."],
      ],
    },
    manifesto: {
      head: "MANIFESTO",
      hint: "TYPICAL VS ALTARIS",
      title1: "Typical code assistants amplify\na developer. ",
      titleGrad: "Altaris",
      title3: " is the company's shared mind.",
      lede:
        "Three sentences won't do it justice. Read the nine-dimension comparison, the data-sovereignty argument, and why this is not the same category.",
      cta: "READ THE MANIFESTO",
      tease: {
        head: "THREE OF NINE DIMENSIONS",
        them: "Typical code assistants",
        us: "Altaris",
        rows: [
          ["MEMORY", "Ephemeral · session-bound", "Persistent vault"],
          ["DEPLOY", "Cloud required", "On-prem · cloud · air-gapped"],
          ["SCOPE",  "Code only",      "Every company channel"],
        ],
      },
    },
    scenes: {
      head: "SCENES",
      hint: "XVI CHAPTERS · ~22 SEC EACH",
      title1: "Sixteen moments,\nwhere decisions ",
      titleGrad: "cannot wait",
      title3: ".",
      lede:
        "Between six in the morning and two at night, between briefing and signature, between audit and regulation — Altaris is there. Hover the list: the moment plays. Click: sound and attention are yours.",
      cta: "OPEN ALL SCENES",
      livePreview: "LIVE PREVIEW",
      keyboardHint: "KEYBOARD NAVIGABLE",
      seeAll: "WATCH ALL",
      chapter: "XVI CHAPTERS",
      list: [
        { num: "I",    title: "Executive Morning", line: "The coffee wasn't gone yet. The brief was — last night's everything in twelve lines.",       meta: ["06:14", "ISTANBUL", "BRIEFING"],   tag: "BRIEFING" },
        { num: "II",   title: "Night Crisis",      line: "When the system fell, the company wasn't asleep. Triggered, contained, reported.",            meta: ["02:47", "BERLIN", "INCIDENT"],     tag: "INCIDENT" },
        { num: "III",  title: "Boardroom",         line: "Eleven slides. Each one defensible — every number traceable back to its source.",             meta: ["09:00", "THE BOARD", "DECISION"],  tag: "DECISION" },
        { num: "IV",   title: "First Day",         line: "The new hire found the answer before asking. Policy, process, history — in a single chat.",   meta: ["08:30", "ONBOARDING", "HR"],       tag: "HR" },
        { num: "V",    title: "Ten Minutes Out",   line: "The last doubt before a presentation. Asked, answered in three paragraphs.",                  meta: ["13:50", "PRESENTATION", "PREP"],   tag: "PREP" },
        { num: "VI",   title: "Before Signing",    line: "Article forty-seven of the contract spoke quietly. The risky clause, side by side with peers.",meta: ["16:22", "LEGAL", "CONTRACT"],      tag: "CONTRACT" },
        { num: "VII",  title: "Silent Exit",       line: "An employee left. Access closed in fourteen systems, certificates revoked — as the door shut.",meta: ["18:04", "OFFBOARDING", "SECURITY"],tag: "SECURITY" },
        { num: "VIII", title: "Q4 Target",         line: "The number didn't add up. Three reasons surfaced; two were fixable — and which ones, named.",  meta: ["Q4", "CFO", "FINANCE"],            tag: "FINANCE" },
        { num: "IX",   title: "Investment Call",   line: "Four scenarios, two horizons, one decision. Cashflow, contract load, churn — side by side.",  meta: ["WHAT-IF", "STRATEGY", "SIM"],      tag: "SIMULATION" },
        { num: "X",    title: "Audit Ready",       line: "When the auditor arrived, the binder was ready. Logs, retention, RBAC — already on file.",    meta: ["AUDIT", "ISO 27001", "COMPLIANCE"],tag: "COMPLIANCE" },
        { num: "XI",   title: "Green Border",      line: "The sustainability report wrote itself — figures in place, sources in the footnotes.",        meta: ["ESG", "SUSTAINABILITY", "REPORT"], tag: "ESG" },
        { num: "XII",  title: "Evening Shift",     line: "Third patient at the ER door. History, allergies, drug interactions — at a glance.",          meta: ["19:42", "ER", "CLINICAL"],         tag: "HEALTH" },
        { num: "XIII", title: "Line Down",          line: "OEE dropped to 72%. Root cause in ninety seconds — shift, batch, temperature.",                meta: ["OEE", "FACTORY", "ROOT CAUSE"],    tag: "MANUFACTURING" },
        { num: "XIV",  title: "Twenty-Four Hours",  line: "Three thousand pages of testimony. Case law, precedent, risk — on file by morning.",            meta: ["LITIGATION", "CASE LAW", "RISK"],  tag: "LEGAL" },
        { num: "XV",   title: "Committee Morning",  line: "KYC complete, AML clean. Risk score and decision — by half past eight.",                        meta: ["KYC", "AML", "CREDIT"],            tag: "BANKING" },
        { num: "XVI",  title: "Container Delay",    line: "Cargo waiting in Hamburg. ETA recalculated, two clients notified — before the email arrived.",  meta: ["ETA", "FREIGHT", "ANOMALY"],       tag: "LOGISTICS" },
      ],
      pageTitleA: "Sixteen moments — where decisions ",
      pageTitleGrad: "cannot wait",
      pageTitleC: ".",
      pageLede:
        "Between six in the morning and two at night, between briefing and trial, between factory floor and credit committee — Altaris is there. Hover the list below: the moment shows up on the right. Click: sound and attention are yours.",
      sectionHead: "SIXTEEN SCENES",
      nowPlaying: "NOW PLAYING",
      watch: "WATCH",
      playing: "▸ PLAYING",
      fallbackPause: "PLAY / PAUSE",
      keyNav: "NAVIGATE",
      keyPlay: "PLAY",
      keySound: "SOUND",
      keyFs: "FULLSCREEN",
      fullscreen: "Fullscreen",
      backHome: "HOME",
    },
    start: {
      head: "/ GET STARTED",
      line1: "Ready to run ",
      lineGrad: "agentic AI without a single byte leaving your premises",
      cta: " — let's talk demo.",
      requestDemo: "REQUEST DEMO",
    },
    footer: {
      edition: "v0.1.0-alpha",
      copy: "© 2026 ARGUS TEKNOLOJI · ENTERPRISE AGENTIC AI",
    },
    langSwitch: { tr: "tr", en: "en", de: "de" },
  },

  // ─── TR ──────────────────────────────────────────────────────────────
  tr: {
    nav: {
      cloud: "cloud", live: "live",
      panel: "panele git", signIn: "giriş yap",
      scenes: "sahneler", chapters: "xvi",
      home: "ana sayfa", altaris: "altaris",
      manifesto: "manifesto",
    },
    hero: {
      metaCities: "i̇stanbul · ankara · berlin",
      metaYear: "2026",
      taglinePre: "Kurumsal ekiplerin ",
      taglineGrad: "agentic AI",
      taglinePost: " terminali.",
      description:
        "Lokalde çalışan altaris komutu, web üzerinden yönetilen tek panel, on-prem ya da bulut deploy. KVKK uyumlu audit trail, kurumlara özel veri izolasyonu, vault tabanlı kurumsal hafıza — tek binary, tek kontrol düzlemi, ekibinizin paylaşılan zihni.",
      cmdHint: "altaris",
    },
    surfaces: {
      head: "dört yüzey",
      hint: "terminal · masaüstü · web · remote",
      terminal: {
        title: "Terminal",
        body:
          "altaris komutu ile lokal LLM destekli agentik shell. macOS, Linux, Windows tek binary. Bulut ve kurum içi model sağlayıcıları — hepsi tek kurum ayarı'nın arkasında.",
      },
      desktop: {
        title: "Masaüstü Uygulaması",
        body:
          "Terminale alışkın olmayan kullanıcılar için native macOS ve Windows uygulaması. Tauri tabanlı, ~10 MB binary. Auto-update, code-signed, air-gapped USB dağıtıma uygun.",
      },
      web: {
        title: "Web Chat",
        body:
          "Tarayıcıdan oturum aç, ekibinizle paylaşılan kurumsal hafızada sohbet et. Vault tabanlı bağlam, tam transcript, oturum geçmişi — admin panelinde herkesin tüm konuşmaları izlenebilir.",
      },
      remote: {
        title: "Remote Control",
        body:
          "Lokalde çalışan altaris oturumlarını web'den izle ve devral. Multi-viewer denetim, takeover ile yetkili devralma, her tuş vuruşu için audit kaydı.",
      },
    },
    whoFor: {
      head: "kim için",
      hint: "bulut · on-prem",
      cloud: {
        title: "Bulut",
        subtitle: "Hızlı başla, üst-tier modeller",
        tag: "cloud",
        points: [
          "Üst seviye bulut model seçenekleri",
          "Veritabanı seviyesinde kurumlara özel veri izolasyonu",
          "Kurumsal SSO entegrasyonu hazır",
          "Tarayıcı üzerinden mevcut model hesaplarını bağlama",
        ],
      },
      onprem: {
        title: "On-Prem",
        subtitle: "Veri tek bir bayt dışarı çıkmaz",
        tag: "on-prem",
        points: [
          "Kurum içi model altyapısı bağlantısı",
          "Kurum içi veritabanı ve kimlik yönetimi",
          "Air-gapped kurulum, hava boşluklu güncelleme paketleri",
          "Kamu, savunma, finans için KVKK + ISO 27001 hizalı",
        ],
      },
    },
    spine: {
      head: "kurumsal omurga",
      hint: "6 sütun",
      items: [
        ["Kurumsal veri izolasyonu",
         "Tek fiziksel veritabanı üzerinde kurum bazlı ayrım ve katı erişim politikalarıyla izolasyon."],
        ["KVKK-uyumlu audit",
         "Her işlem, yetkili erişim ve model geçişi merkezi olarak kayıt altına alınır. Tam izlenebilir kurumsal trail."],
        ["Kurumsal SSO",
         "CLI, web ve yönetim paneli aynı kurumsal kimlik altyapısı üzerinden güvenli oturum açar."],
        ["Model soyutlama katmanı",
         "Bulut ve kurum içi model sağlayıcıları tek kurum ayarında yönetilir; oturum içinde kontrollü geçiş yapılır."],
        ["Vault tabanlı hafıza",
         "Vault tabanlı kurumsal knowledge base, güçlü arama ve paylaşımlı bağlam yönetimi."],
        ["Container-only kurulum",
         "docker compose up · 6 servis · MacBook açılışında otomatik başlatma. Tek komut, tek panel, sıfır el ile yapılandırma."],
      ],
    },
    manifesto: {
      head: "manifesto",
      hint: "tipik vs altaris",
      title1: "Tipik kod asistanları geliştiriciyi\ngüçlendirir. ",
      titleGrad: "Altaris",
      title3: " kurumun paylaşılan aklıdır.",
      lede:
        "Üç cümleyle anlatılmaz. Dokuz boyutlu karşılaştırmayı, veri egemenliği argümanını ve Altaris'in neden aynı kategoride olmadığını manifestoda okuyun.",
      cta: "manifestoyu oku",
      tease: {
        head: "dokuz boyuttan üçü",
        them: "tipik kod asistanları",
        us: "altaris",
        rows: [
          ["bellek", "geçici · oturum sınırlı",  "kalıcı vault"],
          ["deploy", "bulut zorunlu",            "on-prem · bulut · air-gapped"],
          ["kapsam", "sadece kod",               "kurumun her kanalı"],
        ],
      },
    },
    scenes: {
      head: "sahneler",
      hint: "xvi bölüm · ortalama 22 sn",
      title1: "On altı an,\nkararın ",
      titleGrad: "bekleyemediği",
      title3: " yerlerde.",
      lede:
        "Sabahın altısı ile gecenin ikisi arasında, brifing ile imza arasında, denetim ile yönerge arasında — Altaris orada. Listenin üzerine gelin: an oynar. Tıklayın: ses ve dikkat sizinle.",
      cta: "tüm sahneleri aç",
      livePreview: "canlı önizleme",
      keyboardHint: "klavye ile gezilir",
      seeAll: "tümünü izle",
      chapter: "xvi bölüm",
      list: [
        { num: "I",    title: "Yönetici Sabahı", line: "Kahve daha bitmemişti. Brifing hazırdı — gece boyunca olan biten, on iki satırda.",            meta: ["06:14", "İstanbul", "brifing"],     tag: "brifing" },
        { num: "II",   title: "Gece Krizi",       line: "Sistem düştüğünde, şirket uyumuyordu. Tetiklendi, kontrol altına alındı, raporlandı.",          meta: ["02:47", "Berlin", "incident"],      tag: "incident" },
        { num: "III",  title: "Boardroom",        line: "On bir slayt. Her biri savunulabilir — çünkü her sayı, kaynağına kadar geri sürülebilir.",      meta: ["09:00", "yönetim kurulu", "karar"], tag: "karar" },
        { num: "IV",   title: "İlk Gün",          line: "Yeni gelen, ilk soruyu sormadan cevabı buldu. Politika, süreç, tarih — tek konuşmada.",        meta: ["08:30", "onboarding", "İK"],        tag: "İK" },
        { num: "V",    title: "On Dakika Kala",   line: "Sunumdan önce son şüphe. Soru soruldu, üç paragrafta yanıtlandı.",                              meta: ["13:50", "sunum", "hazırlık"],       tag: "sunum" },
        { num: "VI",   title: "İmza Öncesi",      line: "Sözleşmenin kırk yedinci maddesi sessizce konuştu. Riskli ifade, kıyaslamayla yan yana.",       meta: ["16:22", "hukuk", "sözleşme"],       tag: "sözleşme" },
        { num: "VII",  title: "Sessiz Çıkış",     line: "Bir çalışan ayrıldı. On dört sistemde erişim kapandı, sertifikalar geri alındı.",               meta: ["18:04", "offboarding", "güvenlik"], tag: "güvenlik" },
        { num: "VIII", title: "Q4 Hedefi",        line: "Rakam tutmuyordu. Üç sebep bulundu, ikisi düzeltilebilirdi — hangisi olduğu yazıldı.",          meta: ["Q4", "CFO", "finans"],              tag: "finans" },
        { num: "IX",   title: "Yatırım Kararı",   line: "Dört senaryo, iki ufuk, bir karar. Nakit akışı, sözleşme yükü, churn — yan yana.",              meta: ["what-if", "strateji", "simülasyon"],tag: "simülasyon" },
        { num: "X",    title: "Denetim Hazır",    line: "Denetçi geldiğinde klasör hazırdı. Loglar, retansiyon, RBAC — kanıtlar zaten dosyada.",         meta: ["denetim", "ISO 27001", "uyum"],     tag: "uyum" },
        { num: "XI",   title: "Yeşil Sınır",      line: "Sürdürülebilirlik raporu kendiliğinden yazıldı — sayılar yerinde, kaynaklar dipnotta.",         meta: ["ESG", "sürdürülebilirlik", "rapor"],tag: "ESG" },
        { num: "XII",  title: "Akşam Vardiyası", line: "Acil servis kapısında üçüncü hasta. Geçmiş, alerji, ilaç etkileşimi — bir bakışta.",             meta: ["19:42", "acil servis", "klinik"],   tag: "sağlık" },
        { num: "XIII", title: "Hat Duruşu",      line: "OEE %72'ye düştü. Doksan saniyede kök neden — vardiya, parça lotu, sıcaklık.",                    meta: ["OEE", "fabrika", "kök neden"],      tag: "üretim" },
        { num: "XIV",  title: "Davaya Yirmi Dört Saat", line: "Üç bin sayfa ifade. İçtihat, emsal, risk — sabaha kadar dosyada.",                          meta: ["dava", "içtihat", "risk"],          tag: "hukuk" },
        { num: "XV",   title: "Komite Sabahı",   line: "KYC tamam, AML temiz. Risk skoru ve karar — sekiz buçukta komitede.",                              meta: ["KYC", "AML", "kredi"],              tag: "bankacılık" },
        { num: "XVI",  title: "Konteyner Gecikmesi", line: "Hamburg'da bekleyen yük. ETA yeniden hesaplandı, iki müşteri haberdar — e-posta gelmeden önce.", meta: ["ETA", "yük", "anomali"],            tag: "lojistik" },
      ],
      pageTitleA: "On altı an — kararın ",
      pageTitleGrad: "bekleyemediği",
      pageTitleC: " yerlerde.",
      pageLede:
        "Sabahın altısı ile gecenin ikisi arasında, brifing ile dava arasında, fabrika hattı ile kredi komitesi arasında — Altaris orada. Aşağıdaki listenin üzerine gelin: an sağ panelde belirir. Tıklayın: ses ve dikkat sizinle.",
      sectionHead: "on altı sahne",
      nowPlaying: "now playing",
      watch: "izle",
      playing: "▸ oynuyor",
      fallbackPause: "oynat / durdur",
      keyNav: "gez",
      keyPlay: "oynat",
      keySound: "ses",
      keyFs: "tam ekran",
      fullscreen: "Tam ekran",
      backHome: "ana sayfa",
    },
    start: {
      head: "/ başla",
      line1: "Kurum içi veriden bir bayt çıkarmadan ",
      lineGrad: "agentik AI çalıştırmaya",
      cta: " hazırsanız — demoyu konuşalım.",
      requestDemo: "demo iste",
    },
    footer: {
      edition: "v0.1.0-alpha",
      copy: "© 2026 argus teknoloji · kurumsal agentic ai",
    },
    langSwitch: { tr: "tr", en: "en", de: "de" },
  },

  // ─── DE ──────────────────────────────────────────────────────────────
  de: {
    nav: {
      cloud: "cloud", live: "live",
      panel: "zum panel", signIn: "anmelden",
      scenes: "szenen", chapters: "xvi",
      home: "startseite", altaris: "altaris",
      manifesto: "manifest",
    },
    hero: {
      metaCities: "i̇stanbul · ankara · berlin",
      metaYear: "2026",
      taglinePre: "Das ",
      taglineGrad: "agentic-AI",
      taglinePost: "-Terminal für Unternehmensteams.",
      description:
        "Ein lokaler altaris-Befehl, ein einziges web-basiertes Bedienfeld, On-Prem oder Cloud-Deployment. DSGVO-konformer Audit-Trail, mandantenisolierte Daten, vault-basiertes Unternehmensgedächtnis — eine Binary, eine Steuerebene, das gemeinsame Gedächtnis Ihres Teams.",
      cmdHint: "altaris",
    },
    surfaces: {
      head: "vier oberflächen",
      hint: "terminal · desktop · web · remote",
      terminal: {
        title: "Terminal",
        body:
          "Eine agentische Shell, angetrieben vom altaris-Befehl und einem lokalen LLM. Eine Binary für macOS, Linux und Windows. Cloud- und On-Prem-Provider — alle hinter einer einzigen Mandanteneinstellung.",
      },
      desktop: {
        title: "Desktop",
        body:
          "Native macOS- und Windows-App für Nutzer, die mit dem Terminal nicht vertraut sind. Tauri-basiert, ~10 MB Binary. Auto-Update, code-signiert, geeignet für Air-Gapped-USB-Lieferung.",
      },
      web: {
        title: "Web Chat",
        body:
          "Im Browser anmelden, über das gemeinsame Unternehmensgedächtnis Ihres Teams kommunizieren. Vault-basierter Kontext, vollständiges Transkript, Sitzungsverlauf — jede Konversation ist über das Admin-Panel auditierbar.",
      },
      remote: {
        title: "Remote Control",
        body:
          "Lokale altaris-Sitzungen vom Web aus beobachten und übernehmen. Multi-Viewer-Aufsicht, autorisierte Übernahme, ein Audit-Eintrag für jeden Tastenanschlag.",
      },
    },
    whoFor: {
      head: "für wen",
      hint: "cloud · on-prem",
      cloud: {
        title: "Cloud",
        subtitle: "Schneller Start, Top-Modelle",
        tag: "cloud",
        points: [
          "Top-Cloud-Modellauswahl",
          "Mandantenisolation auf Datenbankebene",
          "Enterprise-SSO einsatzbereit",
          "Eigene Modellkonten direkt im Browser anbinden",
        ],
      },
      onprem: {
        title: "On-Prem",
        subtitle: "Kein einziges Byte verlässt Ihr Haus",
        tag: "on-prem",
        points: [
          "Anbindung an firmeneigene Modellinfrastruktur",
          "On-Premises-Datenbank und Identitätsverwaltung",
          "Air-Gapped-Installation, versiegelte Update-Pakete",
          "Ausgerichtet auf DSGVO + ISO 27001 für Behörden, Verteidigung, Finanzen",
        ],
      },
    },
    spine: {
      head: "unternehmens-rückgrat",
      hint: "6 säulen",
      items: [
        ["Mandantendaten-Isolation",
         "Mandantenebene-Partitionierung in einer einzigen physischen Datenbank mit strengen Zugriffsrichtlinien."],
        ["DSGVO-konformes Audit",
         "Jede Aktion, jeder privilegierte Zugriff und jeder Modellwechsel wird zentral protokolliert. Ein vollständig nachverfolgbarer Unternehmens-Trail."],
        ["Enterprise SSO",
         "CLI, Web und Admin-Panel melden sich über denselben Enterprise-Identity-Provider an."],
        ["Modell-Abstraktionsschicht",
         "Cloud- und On-Prem-Provider werden unter einer einzigen Mandanteneinstellung verwaltet; das Umschalten erfolgt kontrolliert in der Sitzung."],
        ["Vault-basiertes Gedächtnis",
         "Vault-basierte Enterprise-Wissensdatenbank mit leistungsstarker Suche und gemeinsamem Kontext."],
        ["Container-only Installation",
         "docker compose up · 6 Services · Auto-Start beim Booten. Ein Befehl, ein Panel, null manuelle Konfiguration."],
      ],
    },
    manifesto: {
      head: "manifest",
      hint: "typisch vs altaris",
      title1: "Typische Code-Assistenten verstärken\neinen Entwickler. ",
      titleGrad: "Altaris",
      title3: " ist der gemeinsame Verstand des Unternehmens.",
      lede:
        "Drei Sätze reichen nicht. Lesen Sie den Neun-Dimensionen-Vergleich, die Datensouveränitäts-Argumentation und warum Altaris nicht dieselbe Kategorie ist.",
      cta: "manifest lesen",
      tease: {
        head: "drei von neun dimensionen",
        them: "typische code-assistenten",
        us: "altaris",
        rows: [
          ["gedächtnis", "flüchtig · sitzungsgebunden", "dauerhafter vault"],
          ["deployment", "cloud zwingend",              "on-prem · cloud · air-gapped"],
          ["umfang",     "nur code",                    "jeder kanal des unternehmens"],
        ],
      },
    },
    scenes: {
      head: "szenen",
      hint: "xvi kapitel · ~22 sek pro stück",
      title1: "Sechzehn Momente,\nin denen Entscheidungen ",
      titleGrad: "nicht warten können",
      title3: ".",
      lede:
        "Zwischen sechs Uhr morgens und zwei Uhr nachts, zwischen Briefing und Unterschrift, zwischen Audit und Verordnung — Altaris ist da. Liste überfahren: der Moment beginnt. Klicken: Ton und Aufmerksamkeit gehören Ihnen.",
      cta: "alle szenen öffnen",
      livePreview: "live-vorschau",
      keyboardHint: "über tastatur navigierbar",
      seeAll: "alle ansehen",
      chapter: "xvi kapitel",
      list: [
        { num: "I",    title: "Morgen der Geschäftsleitung", line: "Der Kaffee war noch nicht leer. Das Briefing schon — alles aus der letzten Nacht in zwölf Zeilen.", meta: ["06:14", "İstanbul", "briefing"],   tag: "briefing" },
        { num: "II",   title: "Nächtliche Krise",            line: "Als das System fiel, schlief das Unternehmen nicht. Ausgelöst, eingedämmt, gemeldet.",              meta: ["02:47", "Berlin", "incident"],     tag: "incident" },
        { num: "III",  title: "Boardroom",                   line: "Elf Folien. Jede einzelne haltbar — jede Zahl bis zur Quelle nachvollziehbar.",                    meta: ["09:00", "vorstand", "entscheidung"], tag: "decision" },
        { num: "IV",   title: "Erster Tag",                  line: "Die neue Kraft fand die Antwort, bevor sie fragte. Richtlinie, Prozess, Historie — in einem Chat.", meta: ["08:30", "onboarding", "HR"],       tag: "HR" },
        { num: "V",    title: "Zehn Minuten Vorher",          line: "Der letzte Zweifel vor einer Präsentation. Gefragt, in drei Absätzen beantwortet.",                meta: ["13:50", "präsentation", "vorbereitung"], tag: "prep" },
        { num: "VI",   title: "Vor der Unterschrift",         line: "Artikel siebenundvierzig sprach leise. Die riskante Klausel, Seite an Seite mit Vergleichbarem.",  meta: ["16:22", "recht", "vertrag"],       tag: "contract" },
        { num: "VII",  title: "Stiller Abgang",               line: "Eine Mitarbeiterin ging. Zugriff in vierzehn Systemen geschlossen, Zertifikate widerrufen — als die Tür zufiel.", meta: ["18:04", "offboarding", "sicherheit"], tag: "security" },
        { num: "VIII", title: "Q4-Ziel",                      line: "Die Zahl stimmte nicht. Drei Gründe wurden sichtbar; zwei waren behebbar — und welche, benannt.", meta: ["Q4", "CFO", "finanzen"],           tag: "finance" },
        { num: "IX",   title: "Investitionsentscheidung",     line: "Vier Szenarien, zwei Zeithorizonte, eine Entscheidung. Cashflow, Vertragslast, Churn — nebeneinander.", meta: ["what-if", "strategie", "sim"],     tag: "simulation" },
        { num: "X",    title: "Audit-Bereit",                 line: "Als der Prüfer kam, war der Ordner bereit. Logs, Aufbewahrung, RBAC — bereits abgelegt.",          meta: ["audit", "ISO 27001", "compliance"],tag: "compliance" },
        { num: "XI",   title: "Grüne Grenze",                 line: "Der Nachhaltigkeitsbericht schrieb sich selbst — Zahlen drin, Quellen in den Fußnoten.",          meta: ["ESG", "nachhaltigkeit", "bericht"],tag: "ESG" },
        { num: "XII",  title: "Abendschicht",                 line: "Dritter Patient an der Notaufnahme. Vorgeschichte, Allergien, Wechselwirkungen — auf einen Blick.", meta: ["19:42", "notaufnahme", "klinisch"],tag: "health" },
        { num: "XIII", title: "Linie Steht",                  line: "OEE auf 72% gefallen. Ursache in neunzig Sekunden — Schicht, Charge, Temperatur.",                meta: ["OEE", "fabrik", "ursache"],        tag: "manufacturing" },
        { num: "XIV",  title: "Vierundzwanzig Stunden",       line: "Dreitausend Seiten Aussagen. Rechtsprechung, Präzedenz, Risiko — bis zum Morgen aktenkundig.",     meta: ["prozess", "rechtsprechung", "risiko"], tag: "legal" },
        { num: "XV",   title: "Ausschuss-Morgen",             line: "KYC vollständig, AML sauber. Risikoscore und Entscheidung — bis halb neun.",                      meta: ["KYC", "AML", "kredit"],            tag: "banking" },
        { num: "XVI",  title: "Container-Verspätung",          line: "Ladung wartet in Hamburg. ETA neu berechnet, zwei Kunden informiert — bevor die E-Mail eintraf.", meta: ["ETA", "fracht", "anomalie"],       tag: "logistics" },
      ],
      pageTitleA: "Sechzehn Momente — in denen Entscheidungen ",
      pageTitleGrad: "nicht warten können",
      pageTitleC: ".",
      pageLede:
        "Zwischen sechs Uhr morgens und zwei Uhr nachts, zwischen Briefing und Verhandlung, zwischen Werkhalle und Kreditausschuss — Altaris ist da. Über die Liste fahren: der Moment erscheint rechts. Klicken: Ton und Aufmerksamkeit gehören Ihnen.",
      sectionHead: "sechzehn szenen",
      nowPlaying: "läuft jetzt",
      watch: "ansehen",
      playing: "▸ läuft",
      fallbackPause: "abspielen / pause",
      keyNav: "navigieren",
      keyPlay: "abspielen",
      keySound: "ton",
      keyFs: "vollbild",
      fullscreen: "Vollbild",
      backHome: "startseite",
    },
    start: {
      head: "/ loslegen",
      line1: "Bereit, ",
      lineGrad: "agentische KI zu betreiben, ohne dass ein einziges Byte das Haus verlässt",
      cta: " — sprechen wir über die Demo.",
      requestDemo: "demo anfragen",
    },
    footer: {
      edition: "v0.1.0-alpha",
      copy: "© 2026 argus teknoloji · enterprise agentic ai",
    },
    langSwitch: { tr: "tr", en: "en", de: "de" },
  },
};

export function t(locale: Locale): DictShape {
  return dict[locale];
}
