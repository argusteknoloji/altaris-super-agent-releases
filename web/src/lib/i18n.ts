// ──────────────────────────────────────────────────────────────────────────
// Lightweight i18n for Altaris marketing surfaces.
//
// Default locale = EN. If `altaris_locale` cookie is present we honour it,
// otherwise we look at the browser's Accept-Language header and pick TR if
// Turkish is the primary preference. No external dependency, no router
// magic — just one dict + one server-side detector + one server action.
// ──────────────────────────────────────────────────────────────────────────

import { cookies, headers } from "next/headers";

export type Locale = "en" | "tr";

export const LOCALE_COOKIE = "altaris_locale";

export async function detectLocale(): Promise<Locale> {
  const c = await cookies();
  const fromCookie = c.get(LOCALE_COOKIE)?.value;
  if (fromCookie === "tr" || fromCookie === "en") return fromCookie;

  const h = await headers();
  const al = (h.get("accept-language") ?? "").toLowerCase();
  // first preferred lang, e.g. "tr-tr,tr;q=0.9,en;q=0.8"
  const first = al.split(",")[0]?.trim() ?? "";
  if (first.startsWith("tr")) return "tr";
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
  langSwitch: { tr: string; en: string };
};

export const dict: Record<Locale, DictShape> = {
  // ─── EN ──────────────────────────────────────────────────────────────
  en: {
    nav: {
      cloud: "cloud", live: "live",
      panel: "go to panel", signIn: "sign in",
      scenes: "scenes", chapters: "xiii",
      home: "home", altaris: "altaris",
    },
    hero: {
      metaCities: "i̇stanbul · ankara · berlin",
      metaYear: "2026",
      taglinePre: "the ",
      taglineGrad: "agentic AI",
      taglinePost: " terminal for enterprise teams.",
      description:
        "A local altaris command, a single web-based control panel, on-prem or cloud deploy. GDPR-aligned audit trail, tenant-isolated data, vault-based institutional memory — one binary, one control plane, your team's shared mind.",
      cmdHint: "altaris",
    },
    surfaces: {
      head: "four surfaces",
      hint: "terminal · desktop · web · remote",
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
      head: "who it's for",
      hint: "cloud · on-prem",
      cloud: {
        title: "Cloud",
        subtitle: "Fast start, top-tier models",
        tag: "cloud",
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
        tag: "on-prem",
        points: [
          "Connects to in-house model infrastructure",
          "On-premises database and identity management",
          "Air-gapped install, sealed update packages",
          "Aligned to GDPR + ISO 27001 for public sector, defense, finance",
        ],
      },
    },
    spine: {
      head: "enterprise backbone",
      hint: "6 pillars",
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
         "Obsidian-compatible enterprise knowledge base with powerful search and shared context."],
        ["Container-only install",
         "docker compose up · 6 services · auto-start on boot. One command, one panel, zero hand-rolled configuration."],
      ],
    },
    scenes: {
      head: "scenes",
      hint: "xiii chapters · ~22 sec each",
      title1: "Thirteen moments,\nwhere decisions ",
      titleGrad: "cannot wait",
      title3: ".",
      lede:
        "Between six in the morning and two at night, between briefing and signature, between audit and regulation — Altaris is there. Hover the list: the moment plays. Click: sound and attention are yours.",
      cta: "open all scenes",
      livePreview: "live preview",
      keyboardHint: "keyboard navigable",
      seeAll: "watch all",
      chapter: "xiii chapters",
      list: [
        { num: "I",    title: "Executive Morning", line: "The coffee wasn't gone yet. The brief was — last night's everything in twelve lines.",       meta: ["06:14", "İstanbul", "briefing"],   tag: "briefing" },
        { num: "II",   title: "Night Crisis",      line: "When the system fell, the company wasn't asleep. Triggered, contained, reported.",            meta: ["02:47", "Berlin", "incident"],     tag: "incident" },
        { num: "III",  title: "Boardroom",         line: "Eleven slides. Each one defensible — every number traceable back to its source.",             meta: ["09:00", "the board", "decision"],  tag: "decision" },
        { num: "IV",   title: "First Day",         line: "The new hire found the answer before asking. Policy, process, history — in a single chat.",   meta: ["08:30", "onboarding", "HR"],       tag: "HR" },
        { num: "V",    title: "Ten Minutes Out",   line: "The last doubt before a presentation. Asked, answered in three paragraphs.",                  meta: ["13:50", "presentation", "prep"],   tag: "prep" },
        { num: "VI",   title: "Before Signing",    line: "Article forty-seven of the contract spoke quietly. The risky clause, side by side with peers.",meta: ["16:22", "legal", "contract"],      tag: "contract" },
        { num: "VII",  title: "Silent Exit",       line: "An employee left. Access closed in fourteen systems, certificates revoked — as the door shut.",meta: ["18:04", "offboarding", "security"],tag: "security" },
        { num: "VIII", title: "Q4 Target",         line: "The number didn't add up. Three reasons surfaced; two were fixable — and which ones, named.",  meta: ["Q4", "CFO", "finance"],            tag: "finance" },
        { num: "IX",   title: "Investment Call",   line: "Four scenarios, two horizons, one decision. Cashflow, contract load, churn — side by side.",  meta: ["what-if", "strategy", "sim"],      tag: "simulation" },
        { num: "X",    title: "Audit Ready",       line: "When the auditor arrived, the binder was ready. Logs, retention, RBAC — already on file.",    meta: ["audit", "ISO 27001", "compliance"],tag: "compliance" },
        { num: "XI",   title: "Green Border",      line: "The sustainability report wrote itself — figures in place, sources in the footnotes.",        meta: ["ESG", "sustainability", "report"], tag: "ESG" },
        { num: "XII",  title: "Ministry Briefing", line: "Five slides for the ministry. Every question of the past week, sourced and answered.",        meta: ["ministry", "public", "briefing"],  tag: "public" },
        { num: "XIII", title: "Regulation Switch", line: "A new regulation took effect. That morning the system was already aligned — quietly closed.", meta: ["regulation", "compliance", "transition"], tag: "regulation" },
      ],
      pageTitleA: "Thirteen moments — where decisions ",
      pageTitleGrad: "cannot wait",
      pageTitleC: ".",
      pageLede:
        "Between six in the morning and two at night, between briefing and signature, between audit and regulation — Altaris is there. Hover the list below: the moment shows up on the right. Click: sound and attention are yours.",
      sectionHead: "thirteen scenes",
      nowPlaying: "now playing",
      watch: "watch",
      playing: "▸ playing",
      fallbackPause: "play / pause",
      keyNav: "navigate",
      keyPlay: "play",
      keySound: "sound",
      keyFs: "fullscreen",
      fullscreen: "Fullscreen",
      backHome: "home",
    },
    start: {
      head: "/ get started",
      line1: "Ready to run ",
      lineGrad: "agentic AI without a single byte leaving your premises",
      cta: " — let's talk demo.",
      requestDemo: "request demo",
    },
    footer: {
      edition: "v0.1.0-alpha",
      copy: "© 2026 argus teknoloji · enterprise agentic ai",
    },
    langSwitch: { tr: "tr", en: "en" },
  },

  // ─── TR ──────────────────────────────────────────────────────────────
  tr: {
    nav: {
      cloud: "cloud", live: "live",
      panel: "panele git", signIn: "giriş yap",
      scenes: "sahneler", chapters: "xiii",
      home: "ana sayfa", altaris: "altaris",
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
         "Obsidian uyumlu kurumsal knowledge base, güçlü arama ve paylaşımlı bağlam yönetimi."],
        ["Container-only kurulum",
         "docker compose up · 6 servis · MacBook açılışında otomatik başlatma. Tek komut, tek panel, sıfır el ile yapılandırma."],
      ],
    },
    scenes: {
      head: "sahneler",
      hint: "xiii bölüm · ortalama 22 sn",
      title1: "On üç an,\nkararın ",
      titleGrad: "bekleyemediği",
      title3: " yerlerde.",
      lede:
        "Sabahın altısı ile gecenin ikisi arasında, brifing ile imza arasında, denetim ile yönerge arasında — Altaris orada. Listenin üzerine gelin: an oynar. Tıklayın: ses ve dikkat sizinle.",
      cta: "tüm sahneleri aç",
      livePreview: "canlı önizleme",
      keyboardHint: "klavye ile gezilir",
      seeAll: "tümünü izle",
      chapter: "xiii bölüm",
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
        { num: "XII",  title: "MEB Brifi",        line: "Bakanlığa beş slayt. Bir haftadır beklenen soruların hepsine, kaynaklı cevap.",                 meta: ["bakanlık", "kamu", "brifing"],      tag: "kamu" },
        { num: "XIII", title: "Yönerge Geçişi",   line: "Yeni yönerge yürürlüğe girdi. Sistem o sabah uyumluydu — fark, sessizce kapandı.",              meta: ["mevzuat", "uyum", "geçiş"],         tag: "mevzuat" },
      ],
      pageTitleA: "On üç an — kararın ",
      pageTitleGrad: "bekleyemediği",
      pageTitleC: " yerlerde.",
      pageLede:
        "Sabahın altısı ile gecenin ikisi arasında, brifing ile imza arasında, denetim ile yönerge arasında — Altaris orada. Aşağıdaki listenin üzerine gelin: an sağ panelde belirir. Tıklayın: ses ve dikkat sizinle.",
      sectionHead: "on üç sahne",
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
    langSwitch: { tr: "tr", en: "en" },
  },
};

export function t(locale: Locale): DictShape {
  return dict[locale];
}
