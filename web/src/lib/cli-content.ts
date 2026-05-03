// ──────────────────────────────────────────────────────────────────────────
// /cli page content — kept out of i18n.ts because the scripts are long
// (4 cinematic terminal scenes × 3 locales) and would drown the rest of the
// dict. Imported directly by cli/page.tsx.
// ──────────────────────────────────────────────────────────────────────────

import type { Locale } from "./i18n";

export type CliLineKind =
  | "cmd"      // user-typed prompt — typewriter
  | "out"      // plain stdout line
  | "tool"     // agentic tool call (ember tinted)
  | "wait"     // spinner placeholder (auto-replaced after delay)
  | "answer"   // phosphor-green answer body
  | "head"     // dim header / comment line
  | "blank";   // empty line

export type CliLine = { k: CliLineKind; t: string };

export type CliScene = {
  num: string;        // I, II, III, IV
  slug: string;       // login, vault, install, push
  title: string;
  meta: string;
  lines: CliLine[];
};

export type InstallTarget = {
  os: string;
  arch: string;
  cmd: string;
  size: string;
};

export type CliDict = {
  nav: { back: string; chapters: string; auto: string; pause: string; restart: string };
  hero: {
    eyebrow: string;
    titleA: string;
    titleGrad: string;
    titleB: string;
    lede: string;
    badgeLocal: string;
    badgeMulti: string;
    badgeAirgap: string;
  };
  scenesHead: string;
  scenesHint: string;
  scenes: CliScene[];
  commands: {
    head: string;
    hint: string;
    col: { cmd: string; what: string };
    rows: Array<[cmd: string, what: string]>;
  };
  providers: {
    head: string;
    hint: string;
    col: { name: string; mode: string; example: string };
    rows: Array<{ name: string; mode: string; example: string; tag?: string }>;
    note: string;
  };
  install: {
    head: string;
    hint: string;
    targets: { mac: InstallTarget; linux: InstallTarget; win: InstallTarget };
    oneliner: { label: string; cmd: string };
    copy: string;
    copied: string;
    sigNote: string;
  };
  cta: {
    eyebrow: string;
    titleA: string;
    titleGrad: string;
    titleB: string;
    primary: string;
    secondary: string;
  };
  footer: { copy: string };
};

// ──────────────────────────────────────────────────────────────────────────
// TR
// ──────────────────────────────────────────────────────────────────────────
const TR: CliDict = {
  nav: { back: "ana sayfa", chapters: "iv sahne", auto: "oto-oynat", pause: "duraklat", restart: "baştan" },
  hero: {
    eyebrow: "argus teknoloji · altaris cli · v0.1.0-α",
    titleA: "Tek binary, ",
    titleGrad: "tek satır komut",
    titleB: ", paylaşılan zihin.",
    lede:
      "Lokalde çalışır. İnternet ister, istemez. Lokal LLM ile konuşur, bulutla aynı dili konuşur. Vault'unuza, ekibinize, denetiminize bağlanır — kapalı kapı arkasında.",
    badgeLocal:  "lokal-öncelikli",
    badgeMulti:  "multi-provider",
    badgeAirgap: "air-gapped",
  },
  scenesHead: "iv sahne · canlı simülasyon",
  scenesHint: "auto-play · tıkla seç",
  scenes: [
    {
      num: "I", slug: "login",
      title: "Giriş — Cihaz Akışı",
      meta: "altaris login · keycloak device flow · macOS keychain",
      lines: [
        { k: "cmd",  t: "altaris login" },
        { k: "out",  t: "▸ Cihaz akışı açılıyor… https://keycloak.altaris.local/d/ALTR-7K3E" },
        { k: "out",  t: "✓ Yetkilendirildi: burak@argusteknoloji.com.tr" },
        { k: "out",  t: "  tenant: argus · role: platform_admin" },
        { k: "out",  t: "✓ Token macOS Keychain'e yazıldı." },
        { k: "blank",t: "" },
        { k: "cmd",  t: "altaris whoami" },
        { k: "out",  t: "  user      burak@argusteknoloji.com.tr" },
        { k: "out",  t: "  tenant    argus · MMVI ekipleri" },
        { k: "out",  t: "  role      platform_admin" },
        { k: "out",  t: "  provider  altaris llm studio · local" },
      ],
    },
    {
      num: "II", slug: "vault",
      title: "Agentic Soru — Q3 geç ödeme",
      meta: "vault.search · db.query · chart.render",
      lines: [
        { k: "cmd",   t: "altaris" },
        { k: "out",   t: "🜂 altaris · agentic shell · v0.1.0-α" },
        { k: "cmd",   t: "> Q3 sözleşmelerinde geç ödeme oranı? Risk listesi çıkar." },
        { k: "wait",  t: "düşünüyor…" },
        { k: "tool",  t: 'vault.search "vade aşımı OR geç ödeme"  →  47 sonuç' },
        { k: "tool",  t: "db.query  finance.invoices WHERE due_date < paid_at  →  312 satır" },
        { k: "tool",  t: "chart.render  risk-distribution.svg" },
        { k: "blank", t: "" },
        { k: "answer",t: "▸ Q3'te 312 fatura içinde 47 vade aşımı. Toplam risk: 1.42M ₺." },
        { k: "answer",t: "" },
        { k: "answer",t: "  Üç müşteri toplamın %68'ini taşıyor:" },
        { k: "answer",t: "    1. Müşteri X — 540K ₺ — 47 gün ortalama" },
        { k: "answer",t: "    2. Müşteri Y — 380K ₺ — 31 gün" },
        { k: "answer",t: "    3. Müşteri Z — 220K ₺ — 24 gün" },
        { k: "answer",t: "" },
        { k: "out",   t: "  Kaynaklar: 4 sözleşme, 12 e-posta, 3 muhasebe kaydı." },
        { k: "out",   t: "  Tam liste: ./altaris/answers/2026-05-03-q3-gec-odeme.md" },
      ],
    },
    {
      num: "III", slug: "install",
      title: "Air-gapped Kurulum",
      meta: "curl one-liner · USB transfer · imza doğrulama",
      lines: [
        { k: "head",  t: "# macOS / Linux — tek satır" },
        { k: "cmd",   t: "curl -fsSL https://altaris.run/install | sh" },
        { k: "out",   t: "  ✓ İmza doğrulandı (Argus Teknoloji A.Ş. · Apple Notarized)" },
        { k: "out",   t: "  ✓ /usr/local/bin/altaris yüklendi" },
        { k: "out",   t: "  ✓ altaris v0.1.0-α hazır." },
        { k: "blank", t: "" },
        { k: "head",  t: "# Air-gapped — USB ile" },
        { k: "cmd",   t: "tar xz altaris-darwin-arm64.tar.gz && ./altaris install --offline" },
        { k: "out",   t: "  ✓ Çekirdek + manifest + SBOM doğrulandı" },
        { k: "out",   t: "  ✓ İnternet sıfır. Bayt sıfır." },
      ],
    },
    {
      num: "IV", slug: "push",
      title: "Web'e Devret",
      meta: "altaris session push · audit trail",
      lines: [
        { k: "cmd",  t: "altaris session list" },
        { k: "out",  t: "  ID           BAŞLANGIÇ           MESAJ   PROVIDER" },
        { k: "out",  t: "  s_2lk93j     2026-05-03 09:14    23      ollama" },
        { k: "out",  t: "  s_2lk7x1     2026-05-02 18:02     8      anthropic" },
        { k: "blank",t: "" },
        { k: "cmd",  t: "altaris session push s_2lk93j" },
        { k: "wait", t: "uzak senkronizasyon…" },
        { k: "out",  t: "  ✓ 23 mesaj https://altaris.local/sessions/s_2lk93j adresine gönderildi" },
        { k: "out",  t: "  ✓ Görünür: tenant argus · audit: enabled" },
        { k: "answer",t: "▸ Web panel: ekibiniz şimdi devam edebilir." },
      ],
    },
  ],
  commands: {
    head: "komutlar",
    hint: "argus genişletmeleri · src/argus altında",
    col: { cmd: "komut", what: "ne yapar" },
    rows: [
      ["altaris login",                "Keycloak device-flow ile oturum aç, token'ı OS keychain'e yaz."],
      ["altaris logout",               "Keychain token'ı sil, Keycloak session'ı sonlandır."],
      ["altaris whoami",               "Aktif kullanıcı, tenant ve aktif provider."],
      ["altaris session list",         "API'den geçmiş oturumları çek."],
      ["altaris session push <id>",    "Lokal session'ı API'ye gönder; web panelde görünsün."],
      ["altaris vaults sync",          "Vault'unu indeksle ve agentic shell'e bağla."],
      ["altaris remote attach <id>",   "Web tarafındaki bir oturumu lokalden gözlemle ya da devral."],
      ["altaris update --channel beta","Tek komutla imzalı binary güncellemesi — opsiyonel air-gapped."],
    ],
  },
  providers: {
    head: "provider matrisi",
    hint: "tek tenant ayarı · oturumda kontrollü geçiş",
    col: { name: "provider", mode: "mod", example: "açıklama" },
    rows: [
      { name: "Altaris LLM Studio", mode: "lokal",    example: "Argus tarafından sunulan kurumsal lokal LLM altyapısı. Tenant başına izole.", tag: "varsayılan" },
      { name: "Ollama",             mode: "lokal",    example: "Geliştirici makinesinde açık kaynak yerel model çalıştırıcı." },
      { name: "Anthropic",          mode: "bulut",    example: "Yüksek-uçuş bulut sağlayıcısı." },
      { name: "OpenAI",             mode: "bulut",    example: "Bulut sağlayıcısı." },
      { name: "Codex",              mode: "abonelik", example: "Abonelik tabanlı seat-paylaşımlı erişim." },
    ],
    note: "Bulut sağlayıcıları her tenant için ayrı API key + ayrı kota — kullanıcı seviyesinde değil. Model seçimi tenant ayarında.",
  },
  install: {
    head: "kurulum",
    hint: "tek binary · imzalı · ~10 mb",
    targets: {
      mac:   { os: "macOS",   arch: "arm64",  cmd: "altaris-darwin-arm64.tar.gz",  size: "9.4 MB" },
      linux: { os: "Linux",   arch: "x64",    cmd: "altaris-linux-x64.tar.gz",     size: "10.8 MB" },
      win:   { os: "Windows", arch: "x64",    cmd: "altaris-windows-x64.zip",      size: "11.2 MB" },
    },
    oneliner: { label: "tek satır", cmd: "curl -fsSL https://altaris.run/install | sh" },
    copy:    "kopyala",
    copied:  "kopyalandı",
    sigNote: "Apple Notarized · Authenticode · Linux GPG · supply-chain attestation",
  },
  cta: {
    eyebrow: "/ başla",
    titleA: "Bir terminal,\n",
    titleGrad: "bir kurum",
    titleB: ".",
    primary:   "demo iste",
    secondary: "indirme sayfası",
  },
  footer: { copy: "© 2026 argus teknoloji · altaris cli · enterprise agentic ai" },
};

// ──────────────────────────────────────────────────────────────────────────
// EN
// ──────────────────────────────────────────────────────────────────────────
const EN: CliDict = {
  nav: { back: "home", chapters: "iv scenes", auto: "auto-play", pause: "pause", restart: "restart" },
  hero: {
    eyebrow: "argus teknoloji · altaris cli · v0.1.0-α",
    titleA: "One binary, ",
    titleGrad: "one command line",
    titleB: ", a shared mind.",
    lede:
      "Runs locally. Asks the internet only when it must. Talks to a local LLM, speaks the same protocol to the cloud. Hooks into your vault, your team, your audit trail — behind closed doors.",
    badgeLocal:  "local-first",
    badgeMulti:  "multi-provider",
    badgeAirgap: "air-gapped",
  },
  scenesHead: "iv scenes · live simulation",
  scenesHint: "auto-play · click to focus",
  scenes: [
    {
      num: "I", slug: "login",
      title: "Login — Device Flow",
      meta: "altaris login · keycloak device flow · macOS keychain",
      lines: [
        { k: "cmd",  t: "altaris login" },
        { k: "out",  t: "▸ Opening device flow… https://keycloak.altaris.local/d/ALTR-7K3E" },
        { k: "out",  t: "✓ Authorized: burak@argusteknoloji.com.tr" },
        { k: "out",  t: "  tenant: argus · role: platform_admin" },
        { k: "out",  t: "✓ Token written to macOS Keychain." },
        { k: "blank",t: "" },
        { k: "cmd",  t: "altaris whoami" },
        { k: "out",  t: "  user      burak@argusteknoloji.com.tr" },
        { k: "out",  t: "  tenant    argus · MMVI teams" },
        { k: "out",  t: "  role      platform_admin" },
        { k: "out",  t: "  provider  altaris llm studio · local" },
      ],
    },
    {
      num: "II", slug: "vault",
      title: "Agentic Question — Q3 Late Payments",
      meta: "vault.search · db.query · chart.render",
      lines: [
        { k: "cmd",   t: "altaris" },
        { k: "out",   t: "🜂 altaris · agentic shell · v0.1.0-α" },
        { k: "cmd",   t: "> Q3 contract late-payment ratio? Pull a risk list." },
        { k: "wait",  t: "thinking…" },
        { k: "tool",  t: 'vault.search "overdue OR late payment"  →  47 hits' },
        { k: "tool",  t: "db.query  finance.invoices WHERE due_date < paid_at  →  312 rows" },
        { k: "tool",  t: "chart.render  risk-distribution.svg" },
        { k: "blank", t: "" },
        { k: "answer",t: "▸ In Q3, 47 of 312 invoices were overdue. Total risk: ₺1.42M." },
        { k: "answer",t: "" },
        { k: "answer",t: "  Three customers carry 68% of the exposure:" },
        { k: "answer",t: "    1. Customer X — ₺540K — 47-day average" },
        { k: "answer",t: "    2. Customer Y — ₺380K — 31-day" },
        { k: "answer",t: "    3. Customer Z — ₺220K — 24-day" },
        { k: "answer",t: "" },
        { k: "out",   t: "  Sources: 4 contracts, 12 emails, 3 ledger entries." },
        { k: "out",   t: "  Full list: ./altaris/answers/2026-05-03-q3-overdue.md" },
      ],
    },
    {
      num: "III", slug: "install",
      title: "Air-gapped Install",
      meta: "curl one-liner · USB transfer · signature check",
      lines: [
        { k: "head",  t: "# macOS / Linux — one-liner" },
        { k: "cmd",   t: "curl -fsSL https://altaris.run/install | sh" },
        { k: "out",   t: "  ✓ Signature verified (Argus Teknoloji A.Ş. · Apple Notarized)" },
        { k: "out",   t: "  ✓ Installed to /usr/local/bin/altaris" },
        { k: "out",   t: "  ✓ altaris v0.1.0-α ready." },
        { k: "blank", t: "" },
        { k: "head",  t: "# Air-gapped — over USB" },
        { k: "cmd",   t: "tar xz altaris-darwin-arm64.tar.gz && ./altaris install --offline" },
        { k: "out",   t: "  ✓ Core + manifest + SBOM verified" },
        { k: "out",   t: "  ✓ Zero internet. Zero bytes." },
      ],
    },
    {
      num: "IV", slug: "push",
      title: "Hand Off to the Web",
      meta: "altaris session push · audit trail",
      lines: [
        { k: "cmd",  t: "altaris session list" },
        { k: "out",  t: "  ID           STARTED             MESSAGES   PROVIDER" },
        { k: "out",  t: "  s_2lk93j     2026-05-03 09:14    23         ollama" },
        { k: "out",  t: "  s_2lk7x1     2026-05-02 18:02     8         anthropic" },
        { k: "blank",t: "" },
        { k: "cmd",  t: "altaris session push s_2lk93j" },
        { k: "wait", t: "remote sync…" },
        { k: "out",  t: "  ✓ 23 messages pushed to https://altaris.local/sessions/s_2lk93j" },
        { k: "out",  t: "  ✓ Visible: tenant argus · audit: enabled" },
        { k: "answer",t: "▸ Web panel: your team picks up where you left off." },
      ],
    },
  ],
  commands: {
    head: "commands",
    hint: "argus extensions · under src/argus",
    col: { cmd: "command", what: "what it does" },
    rows: [
      ["altaris login",                "Sign in via Keycloak device flow, write the token to the OS keychain."],
      ["altaris logout",               "Wipe the keychain token and end the Keycloak session."],
      ["altaris whoami",               "Current user, tenant and active provider."],
      ["altaris session list",         "Pull past sessions from the API."],
      ["altaris session push <id>",    "Sync a local session to the API so it shows up in the web panel."],
      ["altaris vaults sync",          "Index your vault and bind it to the agentic shell."],
      ["altaris remote attach <id>",   "Watch or take over a web session from the local terminal."],
      ["altaris update --channel beta","Signed binary update in one command — air-gapped optional."],
    ],
  },
  providers: {
    head: "provider matrix",
    hint: "single tenant setting · in-session controlled switch",
    col: { name: "provider", mode: "mode", example: "description" },
    rows: [
      { name: "Altaris LLM Studio", mode: "local",        example: "Argus-managed enterprise on-prem LLM infrastructure. Isolated per tenant.", tag: "default" },
      { name: "Ollama",             mode: "local",        example: "Open-source local model runner on the developer machine." },
      { name: "Anthropic",          mode: "cloud",        example: "High-end cloud provider." },
      { name: "OpenAI",             mode: "cloud",        example: "Cloud provider." },
      { name: "Codex",              mode: "subscription", example: "Subscription-based, seat-shared access." },
    ],
    note: "Cloud providers carry tenant-level API keys and tenant-level quota — never user-level. Model selection lives in tenant settings.",
  },
  install: {
    head: "install",
    hint: "single binary · signed · ~10 MB",
    targets: {
      mac:   { os: "macOS",   arch: "arm64",  cmd: "altaris-darwin-arm64.tar.gz",  size: "9.4 MB" },
      linux: { os: "Linux",   arch: "x64",    cmd: "altaris-linux-x64.tar.gz",     size: "10.8 MB" },
      win:   { os: "Windows", arch: "x64",    cmd: "altaris-windows-x64.zip",      size: "11.2 MB" },
    },
    oneliner: { label: "one-liner", cmd: "curl -fsSL https://altaris.run/install | sh" },
    copy:    "copy",
    copied:  "copied",
    sigNote: "Apple Notarized · Authenticode · Linux GPG · supply-chain attestation",
  },
  cta: {
    eyebrow: "/ get started",
    titleA: "One terminal,\n",
    titleGrad: "one organization",
    titleB: ".",
    primary:   "request demo",
    secondary: "downloads",
  },
  footer: { copy: "© 2026 argus teknoloji · altaris cli · enterprise agentic ai" },
};

// ──────────────────────────────────────────────────────────────────────────
// DE
// ──────────────────────────────────────────────────────────────────────────
const DE: CliDict = {
  nav: { back: "startseite", chapters: "iv szenen", auto: "auto-play", pause: "pause", restart: "neu" },
  hero: {
    eyebrow: "argus teknoloji · altaris cli · v0.1.0-α",
    titleA: "Eine Binary, ",
    titleGrad: "eine Befehlszeile",
    titleB: ", ein gemeinsamer Verstand.",
    lede:
      "Läuft lokal. Spricht das Internet nur an, wenn es muss. Mit einem lokalen LLM, im selben Protokoll mit der Cloud. Verbindet sich mit Ihrem Vault, Ihrem Team, Ihrem Audit — hinter verschlossener Tür.",
    badgeLocal:  "lokal-first",
    badgeMulti:  "multi-provider",
    badgeAirgap: "air-gapped",
  },
  scenesHead: "iv szenen · live-simulation",
  scenesHint: "auto-play · klicken zum fokussieren",
  scenes: [
    {
      num: "I", slug: "login",
      title: "Login — Geräte-Flow",
      meta: "altaris login · keycloak device flow · macOS keychain",
      lines: [
        { k: "cmd",  t: "altaris login" },
        { k: "out",  t: "▸ Geräte-Flow wird geöffnet… https://keycloak.altaris.local/d/ALTR-7K3E" },
        { k: "out",  t: "✓ Autorisiert: burak@argusteknoloji.com.tr" },
        { k: "out",  t: "  tenant: argus · role: platform_admin" },
        { k: "out",  t: "✓ Token in macOS Keychain geschrieben." },
        { k: "blank",t: "" },
        { k: "cmd",  t: "altaris whoami" },
        { k: "out",  t: "  user      burak@argusteknoloji.com.tr" },
        { k: "out",  t: "  tenant    argus · MMVI Teams" },
        { k: "out",  t: "  role      platform_admin" },
        { k: "out",  t: "  provider  altaris llm studio · lokal" },
      ],
    },
    {
      num: "II", slug: "vault",
      title: "Agentic Frage — Q3 Zahlungsverzug",
      meta: "vault.search · db.query · chart.render",
      lines: [
        { k: "cmd",   t: "altaris" },
        { k: "out",   t: "🜂 altaris · agentic shell · v0.1.0-α" },
        { k: "cmd",   t: "> Q3 Zahlungsverzugsquote bei Verträgen? Risikoliste erstellen." },
        { k: "wait",  t: "denkt nach…" },
        { k: "tool",  t: 'vault.search "Zahlungsverzug OR überfällig"  →  47 Treffer' },
        { k: "tool",  t: "db.query  finance.invoices WHERE due_date < paid_at  →  312 Zeilen" },
        { k: "tool",  t: "chart.render  risk-distribution.svg" },
        { k: "blank", t: "" },
        { k: "answer",t: "▸ In Q3 waren 47 von 312 Rechnungen überfällig. Gesamtrisiko: 1,42 Mio. ₺." },
        { k: "answer",t: "" },
        { k: "answer",t: "  Drei Kunden tragen 68 % des Risikos:" },
        { k: "answer",t: "    1. Kunde X — 540 Tsd. ₺ — 47 Tage Durchschnitt" },
        { k: "answer",t: "    2. Kunde Y — 380 Tsd. ₺ — 31 Tage" },
        { k: "answer",t: "    3. Kunde Z — 220 Tsd. ₺ — 24 Tage" },
        { k: "answer",t: "" },
        { k: "out",   t: "  Quellen: 4 Verträge, 12 E-Mails, 3 Buchhaltungseinträge." },
        { k: "out",   t: "  Volle Liste: ./altaris/answers/2026-05-03-q3-zahlungsverzug.md" },
      ],
    },
    {
      num: "III", slug: "install",
      title: "Air-gapped Installation",
      meta: "curl one-liner · USB-Transfer · Signaturprüfung",
      lines: [
        { k: "head",  t: "# macOS / Linux — Einzeiler" },
        { k: "cmd",   t: "curl -fsSL https://altaris.run/install | sh" },
        { k: "out",   t: "  ✓ Signatur geprüft (Argus Teknoloji A.Ş. · Apple Notarized)" },
        { k: "out",   t: "  ✓ Installiert nach /usr/local/bin/altaris" },
        { k: "out",   t: "  ✓ altaris v0.1.0-α bereit." },
        { k: "blank", t: "" },
        { k: "head",  t: "# Air-gapped — per USB" },
        { k: "cmd",   t: "tar xz altaris-darwin-arm64.tar.gz && ./altaris install --offline" },
        { k: "out",   t: "  ✓ Core + Manifest + SBOM geprüft" },
        { k: "out",   t: "  ✓ Null Internet. Null Bytes." },
      ],
    },
    {
      num: "IV", slug: "push",
      title: "Übergabe ans Web",
      meta: "altaris session push · audit trail",
      lines: [
        { k: "cmd",  t: "altaris session list" },
        { k: "out",  t: "  ID           GESTARTET           NACHRICHTEN  PROVIDER" },
        { k: "out",  t: "  s_2lk93j     2026-05-03 09:14    23           ollama" },
        { k: "out",  t: "  s_2lk7x1     2026-05-02 18:02     8           anthropic" },
        { k: "blank",t: "" },
        { k: "cmd",  t: "altaris session push s_2lk93j" },
        { k: "wait", t: "Remote-Sync…" },
        { k: "out",  t: "  ✓ 23 Nachrichten an https://altaris.local/sessions/s_2lk93j gesendet" },
        { k: "out",  t: "  ✓ Sichtbar: Tenant argus · Audit: aktiv" },
        { k: "answer",t: "▸ Web-Panel: Ihr Team setzt nahtlos fort." },
      ],
    },
  ],
  commands: {
    head: "befehle",
    hint: "argus-erweiterungen · unter src/argus",
    col: { cmd: "befehl", what: "wozu" },
    rows: [
      ["altaris login",                "Über Keycloak-Geräte-Flow anmelden, Token in den OS-Keychain schreiben."],
      ["altaris logout",               "Keychain-Token löschen, Keycloak-Session beenden."],
      ["altaris whoami",               "Aktiver Benutzer, Tenant und aktiver Provider."],
      ["altaris session list",         "Vergangene Sessions von der API holen."],
      ["altaris session push <id>",    "Lokale Session zur API pushen — wird im Web-Panel sichtbar."],
      ["altaris vaults sync",          "Vault indexieren und an die agentic shell binden."],
      ["altaris remote attach <id>",   "Eine Web-Session lokal beobachten oder übernehmen."],
      ["altaris update --channel beta","Signiertes Binary-Update in einem Befehl — air-gapped optional."],
    ],
  },
  providers: {
    head: "provider-matrix",
    hint: "ein tenant-setting · kontrollierter wechsel innerhalb der session",
    col: { name: "provider", mode: "modus", example: "Beschreibung" },
    rows: [
      { name: "Altaris LLM Studio", mode: "lokal",      example: "Argus-verwaltete unternehmensweite On-prem-LLM-Infrastruktur. Pro Tenant isoliert.", tag: "Standard" },
      { name: "Ollama",             mode: "lokal",      example: "Open-Source-Runner für lokale Modelle auf dem Entwicklerrechner." },
      { name: "Anthropic",          mode: "cloud",      example: "High-End-Cloud-Anbieter." },
      { name: "OpenAI",             mode: "cloud",      example: "Cloud-Anbieter." },
      { name: "Codex",              mode: "abonnement", example: "Abonnementbasierter, Seat-geteilter Zugang." },
    ],
    note: "Cloud-Provider laufen auf Tenant-API-Keys mit Tenant-Quota — niemals auf Benutzerebene. Modellwahl erfolgt in den Tenant-Einstellungen.",
  },
  install: {
    head: "installation",
    hint: "eine binary · signiert · ~10 MB",
    targets: {
      mac:   { os: "macOS",   arch: "arm64",  cmd: "altaris-darwin-arm64.tar.gz",  size: "9,4 MB" },
      linux: { os: "Linux",   arch: "x64",    cmd: "altaris-linux-x64.tar.gz",     size: "10,8 MB" },
      win:   { os: "Windows", arch: "x64",    cmd: "altaris-windows-x64.zip",      size: "11,2 MB" },
    },
    oneliner: { label: "einzeiler", cmd: "curl -fsSL https://altaris.run/install | sh" },
    copy:    "kopieren",
    copied:  "kopiert",
    sigNote: "Apple Notarized · Authenticode · Linux GPG · Supply-Chain-Attestation",
  },
  cta: {
    eyebrow: "/ los geht's",
    titleA: "Ein Terminal,\n",
    titleGrad: "eine Organisation",
    titleB: ".",
    primary:   "demo anfragen",
    secondary: "downloads",
  },
  footer: { copy: "© 2026 argus teknoloji · altaris cli · enterprise agentic ai" },
};

const ALL: Record<Locale, CliDict> = { tr: TR, en: EN, de: DE };

export function getCliDict(locale: Locale): CliDict {
  return ALL[locale] ?? EN;
}
