import Link from "next/link";

// ──────────────────────────────────────────────────────────────────────────
// Altaris katalog — editorial terminal direction, A4-proportioned spreads.
//
// Aynı landing page'in dil ve atmosferiyle (mono-first, sunset gradient,
// hairline ruled grid, numaralandırılmış spec-sheet panelleri) çok sayfalı
// bir kurumsal sunum kataloğu. Her bölüm bir "sayfa" gibi tasarlandı —
// tarayıcıda kaydır, yazdır deyince A4'te düzgün döker. Server component,
// no new deps, Tailwind only.
// ──────────────────────────────────────────────────────────────────────────

const ALTARIS_ASCII = `█▀█   █    ▀█▀   █▀█   █▀▄   █   █▀▀
█▀█   █     █    █▀█   █▀▄   █   ▀▀█
▀ ▀   ▀▀▀   ▀    ▀ ▀   ▀ ▀   ▀   ▀▀▀`;

const TOC: Array<[string, string, string]> = [
  ["00", "Kapak", "Edition 01 · 2026"],
  ["01", "Vizyon", "Kurumsal agentic AI'ın yeni nesli"],
  ["02", "Üç Yüzey", "Terminal · Web · Remote Control"],
  ["03", "Mimari", "Servis topolojisi ve veri akışı"],
  ["04", "Sağlayıcı Matrisi", "Cloud / on-prem model abstraction"],
  ["05", "Vault Sistemi", "Kurumsal paylaşımlı bilgi katmanı"],
  ["06", "Güvenlik & Uyum", "KVKK · ISO 27001 · RLS · Audit"],
  ["07", "Deploy Modelleri", "Cloud · On-prem · Air-gapped"],
  ["08", "Kullanım Senaryoları", "Kamu · Finans · Savunma · Sağlık"],
  ["09", "Teknik Spesifikasyonlar", "System requirements & SLA"],
  ["10", "Yol Haritası", "2026 Q2 – Q4"],
  ["11", "İletişim", "argusteknoloji.com"],
];

const PROVIDERS: Array<{ name: string; tier: string; backend: string; notes: string }> = [
  { name: "Anthropic Claude",   tier: "cloud", backend: "api.anthropic.com",                    notes: "Sonnet · Opus · Haiku · prompt caching" },
  { name: "OpenAI GPT",         tier: "cloud", backend: "api.openai.com",                       notes: "GPT-4o · GPT-5.x · responses + chat APIs" },
  { name: "Codex (ChatGPT)",    tier: "cloud", backend: "chatgpt.com/backend-api/codex",        notes: "OAuth bağlantısı · platform-tutulan refresh_token" },
  { name: "Google Gemini",      tier: "cloud", backend: "generativelanguage.googleapis.com",    notes: "Flash · Pro · multimodal" },
  { name: "Mistral",            tier: "cloud", backend: "api.mistral.ai",                       notes: "Devstral · Codestral · open weights" },
  { name: "Ollama",             tier: "local", backend: "localhost:11434",                      notes: "Llama 3.x · Qwen · DeepSeek-R1 · self-host" },
  { name: "vLLM / LM Studio",   tier: "local", backend: "OpenAI-compatible endpoint",           notes: "Air-gapped kurum içi GPU sunucu" },
];

const CAPS: Array<[string, string]> = [
  ["Multi-tenant RLS",        "Tek fiziksel veritabanı, tenant_id discrimination, PostgreSQL Row-Level Security policy'leri ile katı izolasyon."],
  ["KVKK-uyumlu audit",       "Her API çağrısı, her takeover, her provider geçişi audit_events'e yazılır. Tam izlenebilir kurumsal trail."],
  ["Keycloak OAuth + SSO",    "CLI için Device Flow, web için NextAuth, kurumsal IdP federasyonu — tek SSO tüm yüzeyleri kapsar."],
  ["Provider abstraction",    "Codex · OpenAI · Anthropic · Ollama · Mistral · Gemini. Tek tenant config'te değiştir, mid-session geçiş yap."],
  ["Vault tabanlı hafıza",    "Markdown tabanlı kurumsal knowledge base, PostgreSQL FTS + pg_trgm fuzzy search, paylaşımlı bağlam."],
  ["Container-only kurulum",  "docker compose up · 6 servis · MacBook açılışında otomatik başlatma. Tek komut, tek panel."],
];

const USECASES: Array<{ tag: string; title: string; lines: string[] }> = [
  {
    tag: "kamu",
    title: "Kamu / E-Devlet",
    lines: [
      "Vatandaş verisi sınır dışına çıkmaz — on-prem deploy zorunlu.",
      "Bakanlık bazlı tenant izolasyonu, KVKK auditörü için tam log.",
      "Yerli LLM (Ollama) seçeneği ile offline operasyon mümkün.",
    ],
  },
  {
    tag: "finans",
    title: "Bankacılık & Finans",
    lines: [
      "BDDK uyumu için sıfır data-egress mimari.",
      "Kart no / TCKN gibi PII alanları için redaction katmanı.",
      "Trader masaları için takeover'lı ortak terminal oturumları.",
    ],
  },
  {
    tag: "savunma",
    title: "Savunma Sanayii",
    lines: [
      "Air-gapped LAN'da çalışır; güncellemeler imzalı paket.",
      "TS/SCI gizlilik seviyesi için yerel Llama / Qwen modelleri.",
      "Komuta zinciri için role-based capability override sistemi.",
    ],
  },
  {
    tag: "sağlık",
    title: "Sağlık & Hastane Sistemleri",
    lines: [
      "Hasta dosyaları için on-prem vault, KVKK Madde 6 hassas veri sınıfı.",
      "Multi-disipliner konseyler için paylaşımlı oturum hafızası.",
      "HBYS / EMR entegrasyonu için MCP server adaptörleri.",
    ],
  },
];

const SPECS: Array<[string, string]> = [
  ["Min. Sunucu",        "4 vCPU · 8 GB RAM · 50 GB SSD · Linux x86_64 / arm64"],
  ["Önerilen",           "8 vCPU · 16 GB RAM · 200 GB SSD · 1 Gbps NIC"],
  ["GPU (lokal LLM)",    "NVIDIA A10/A100/H100 · 24+ GB VRAM (model bağımlı)"],
  ["Veritabanı",         "PostgreSQL 16+ · Row-Level Security · pg_trgm extension"],
  ["Cache",              "Redis 7+ · keyspace per tenant"],
  ["Kimlik",             "Keycloak 25+ · OIDC · SSO federasyonu"],
  ["Konteyner",          "Docker 24+ · docker compose · 6 servis"],
  ["İstemci",            "macOS 12+ · Linux glibc 2.28+ · Windows 10+"],
  ["Ağ",                 "443/TCP · 80/TCP (HTTP→HTTPS redirect) · WebSocket"],
  ["Yedekleme",          "Postgres WAL streaming · vault dosya snapshot"],
  ["SLA (cloud)",        "%99.9 uptime · destek 7×16 (Avrupa saati)"],
  ["SLA (on-prem)",      "Müşteri destek paketi seviyesine bağlı"],
];

const ROADMAP: Array<{ q: string; items: string[] }> = [
  {
    q: "2026 Q2",
    items: [
      "Codex OAuth bağlantısı & platform-tutulan refresh worker (✓ teslim)",
      "Tenant provider seçimi /provider menüsü (✓ teslim)",
      "Vault FTS + pg_trgm fuzzy search (✓ teslim)",
      "Multi-viewer Remote Control + takeover audit (✓ teslim)",
    ],
  },
  {
    q: "2026 Q3",
    items: [
      "Mobile companion (read-only oturum izleme + push notification)",
      "Skills marketplace (kurumsal ortak araç havuzu)",
      "Voice mode (push-to-talk STT, Türkçe optimize)",
      "Apple notarization + Windows code-signing",
    ],
  },
  {
    q: "2026 Q4",
    items: [
      "Executive Brain v3 — tenant-level cross-vault sentez ajanı",
      "Bağımsız agent loop (openclaude bağımlılığını sıfırdan reimplement)",
      "Agentic workflow scheduler (cron + event triggers)",
      "ISO 27001 sertifikasyon süreci",
    ],
  },
];

export default function KatalogPage() {
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

        /* PRINT — A4, hide nav, force colors */
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
        {/* fixed atmosphere */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(240,140,80,0.10),transparent_70%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_70%,rgba(0,0,0,0.5)_100%)]" />
        </div>

        {/* sticky top rail — print'te gizli */}
        <header className="k-no-print sticky top-0 z-20 border-b border-[rgba(120,80,50,0.3)] bg-[rgba(10,9,8,0.85)] backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-[#6b6358]">
              <Link href="/" className="text-[#ddd8d0] transition-colors hover:text-[#ffb464]">altaris</Link>
              <span className="text-[#3a342d]">/</span>
              <span>katalog</span>
              <span className="text-[#3a342d]">·</span>
              <span>edition 01</span>
              <span className="text-[#3a342d]">·</span>
              <span>2026</span>
            </div>
            <button
              type="button"
              className="hidden md:inline-flex items-center gap-2 border border-[rgba(120,80,50,0.45)] px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-[#ddd8d0] transition-colors hover:border-[#f08c50] hover:text-[#ffb464]"
              // print() server component'te yapılamaz; UI sadece bilgi
              // amaçlı — kullanıcı CMD/CTRL+P kullanır.
            >
              <span aria-hidden>⌘</span><span>+ P · pdf'e bas</span>
            </button>
          </div>
        </header>

        {/* ╔════════════════════════════════════════════════════════════════ */}
        {/* SAYFA 00 — KAPAK                                                 */}
        {/* ╚════════════════════════════════════════════════════════════════ */}
        <section className="k-spread mx-auto max-w-6xl">
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">
            <span>argus teknoloji</span>
            <span aria-hidden className="h-px w-10 bg-[#3a342d]" />
            <span>i̇stanbul · ankara · berlin</span>
          </div>

          <pre
            aria-label="Altaris"
            className="k-reveal k-shimmer mt-12 select-none whitespace-pre font-bold leading-[1.05] tracking-[0.02em] text-[clamp(13px,2.0vw,24px)]"
            style={{ animationDelay: "100ms" }}
          >
{ALTARIS_ASCII}
          </pre>

          <div className="mt-16 max-w-3xl">
            <div className="text-[10px] uppercase tracking-[0.32em] text-[#3a342d]">/ kurumsal katalog</div>
            <h1 className="mt-4 text-[clamp(28px,4vw,56px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">{"// "}</span>
              Kurumsal Agentic AI <span className="k-grad">Platform Kataloğu</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-relaxed text-[#9b9285]">
              Bu katalog, Altaris platformunun kurumsal yetkinliklerini, deploy modellerini,
              güvenlik mimarisini ve sektörel kullanım senaryolarını yapılandırılmış bir referans
              halinde sunar. CTO, CISO, BT direktörleri ve teknoloji satın alma birimleri için
              hazırlanmıştır.
            </p>
          </div>

          {/* alt köşe — meta */}
          <div className="absolute bottom-12 left-12 right-12 flex items-end justify-between text-[10px] uppercase tracking-[0.28em] text-[#6b6358] md:bottom-16 md:left-24 md:right-24">
            <div className="space-y-1">
              <div className="text-[#ddd8d0]">edition 01 · 2026</div>
              <div className="text-[#3a342d]">argusteknoloji.com</div>
            </div>
            <div className="space-y-1 text-right">
              <div className="text-[#ddd8d0]">v{process.env.NEXT_PUBLIC_BUILD_VERSION ?? "0.0.0"}</div>
              <div className="text-[#3a342d]">© argus teknoloji</div>
            </div>
          </div>
        </section>

        {/* ╔════════════════════════════════════════════════════════════════ */}
        {/* İÇİNDEKİLER                                                      */}
        {/* ╚════════════════════════════════════════════════════════════════ */}
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

        {/* ╔════════════════════════════════════════════════════════════════ */}
        {/* 01 — VİZYON                                                      */}
        {/* ╚════════════════════════════════════════════════════════════════ */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="01" tag="vizyon" hint="why altaris" />
          <div className="grid gap-12 md:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="text-[clamp(20px,2.4vw,32px)] font-light leading-[1.3] text-[#ddd8d0]">
                Kurumsal ekipler agentic AI'dan faydalanmak istiyor; ama mevcut çözümler ya{" "}
                <span className="text-[#7a7166]">veriyi sınır dışına çıkarıyor</span>, ya{" "}
                <span className="text-[#7a7166]">tek bir model sağlayıcısına kilitliyor</span>, ya da{" "}
                <span className="text-[#7a7166]">terminal ve web yüzeylerini birbirinden kopuk bırakıyor</span>.
              </p>
              <p className="mt-8 text-[clamp(20px,2.4vw,32px)] font-light leading-[1.3] text-[#ddd8d0]">
                Altaris, <span className="k-grad">tek panel · tek binary · tek tenant config</span>{" "}
                ile bu üç sorunu da kapatır.
              </p>
            </div>
            <div className="space-y-6">
              <Stat label="Provider abstraction" value="6" suffix="model sağlayıcı"   note="Anthropic · OpenAI · Codex · Gemini · Mistral · Ollama" />
              <Stat label="Deploy modeli"        value="3" suffix="senaryo"           note="Cloud · On-prem · Air-gapped" />
              <Stat label="Yüzey"                value="3" suffix="kontrol noktası"   note="Terminal · Web · Remote Control" />
              <Stat label="Kurulum"              value="1" suffix="komut"             note="docker compose --profile local up -d" />
            </div>
          </div>
        </section>

        {/* ╔════════════════════════════════════════════════════════════════ */}
        {/* 02 — ÜÇ YÜZEY                                                    */}
        {/* ╚════════════════════════════════════════════════════════════════ */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="02" tag="üç yüzey" hint="terminal · web · remote control" />
          <div className="grid gap-px overflow-hidden rounded-md border border-[rgba(120,80,50,0.28)] bg-[rgba(120,80,50,0.28)] md:grid-cols-3">
            <SurfacePanel
              num="01"
              title="Terminal"
              kicker="lokal yüzey"
              specs={[
                ["binary", "tek dosya, ~80 MB"],
                ["platform", "macOS · Linux · Windows"],
                ["transport", "WebSocket + HTTPS"],
                ["auth", "Keycloak Device Flow"],
              ]}
            >
              CLI <em className="text-[#ddd8d0] not-italic">altaris</em> komutu ile lokal LLM destekli agentik shell.
              Provider seçimi, vault sync, slash komutları ve tam transcript desteği.
            </SurfacePanel>
            <SurfacePanel
              num="02"
              title="Web Chat"
              kicker="paylaşılan yüzey"
              specs={[
                ["framework", "Next.js 16 · React 19"],
                ["auth", "NextAuth + Keycloak SSO"],
                ["db", "PostgreSQL 16 RLS"],
                ["cache", "Redis 7"],
              ]}
            >
              Tarayıcıdan oturum aç, ekipçe paylaşılan kurumsal hafızada sohbet et. Vault tabanlı bağlam,
              session geçmişi, admin panelinde tam transcript.
            </SurfacePanel>
            <SurfacePanel
              num="03"
              title="Remote Control"
              kicker="izleme & devralma"
              specs={[
                ["protokol", "WebSocket broker"],
                ["mod", "watch / takeover"],
                ["audit", "her tuş vuruşu"],
                ["limit", "8 MB frame cap"],
              ]}
            >
              Lokalde çalışan altaris oturumlarını web'den canlı izle ve devral. Multi-viewer denetim,
              yetkili takeover, persistent audit kaydı.
            </SurfacePanel>
          </div>
        </section>

        {/* ╔════════════════════════════════════════════════════════════════ */}
        {/* 03 — MİMARİ                                                      */}
        {/* ╚════════════════════════════════════════════════════════════════ */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="03" tag="mimari" hint="servis topolojisi" />
          <div className="grid gap-12 md:grid-cols-[1fr_1.2fr]">
            <div className="space-y-6">
              <p className="text-base leading-relaxed text-[#bdb4a6]">
                Altaris monorepo'su altı konteyner servisinden oluşur. Hepsi{" "}
                <code className="rounded-sm border border-[rgba(120,80,50,0.35)] bg-[#1a1612] px-1.5 py-0.5 text-[0.85em] text-[#f08c50]">
                  docker compose --profile local up
                </code>{" "}
                ile başlatılır.
              </p>
              <ul className="space-y-4 text-sm">
                {[
                  ["api",          ":5050",    ".NET 9 · Minimal API · EF Core",     "REST + WS endpoint, RLS middleware, OAuth refresh worker"],
                  ["web",          ":3000",    "Next.js 16 · NextAuth",              "Server components, admin paneli, vault yöneticisi"],
                  ["postgres",     ":5433",    "PostgreSQL 16",                      "RLS, pg_trgm, FTS, jsonb"],
                  ["keycloak",     ":8081",    "Keycloak 25",                        "Identity, device flow, SSO federasyonu"],
                  ["keycloak-db",  "internal", "PostgreSQL 16",                      "Yalıtık IdP veritabanı"],
                  ["redis",        ":6380",    "Redis 7",                            "Presence, broker pub/sub, ratelimit"],
                ].map(([n, p, t, d]) => (
                  <li key={n} className="grid grid-cols-[5.5rem_1fr] items-start gap-4 border-b border-[rgba(120,80,50,0.18)] pb-4">
                    <span className="text-[11px] uppercase tracking-[0.22em] text-[#f08c50]">{n}</span>
                    <div>
                      <div className="text-sm font-medium text-[#ddd8d0]">{p} · {t}</div>
                      <div className="mt-1 text-xs leading-relaxed text-[#7a7166]">{d}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* ASCII diagram */}
            <div className="rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a] p-6 md:p-8">
              <div className="mb-4 flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-[0.28em] text-[#f08c50]">[ topology ]</span>
                <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">altaris.platform</span>
              </div>
              <pre className="overflow-x-auto whitespace-pre text-[clamp(9px,0.95vw,12px)] leading-[1.55] text-[#9b9285]">
{`        ┌─────────────────────────────────────────────┐
        │             [ external client ]            │
        │      altaris CLI · web · remote viewer      │
        └──────────────────┬──────────────────────────┘
                           │  HTTPS · WSS
                           ▼
                ┌──────────────────────┐
                │  api · :5050         │ ◀── keycloak
                │  ─ OAuth refresh     │     (:8081)
                │  ─ RLS middleware    │
                │  ─ broker            │
                │  ─ vault storage     │
                └────┬─────────┬───────┘
                     │         │
                     ▼         ▼
              ┌──────────┐  ┌────────┐
              │ postgres │  │ redis  │
              │  :5433   │  │ :6380  │
              │  RLS+FTS │  │ pubsub │
              └──────────┘  └────────┘`}
              </pre>
            </div>
          </div>
        </section>

        {/* ╔════════════════════════════════════════════════════════════════ */}
        {/* 04 — SAĞLAYICI MATRİSİ                                           */}
        {/* ╚════════════════════════════════════════════════════════════════ */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="04" tag="sağlayıcı matrisi" hint="provider abstraction" />
          <div className="overflow-hidden rounded-md border border-[rgba(120,80,50,0.28)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[rgba(120,80,50,0.28)] bg-[#0d0b0a] text-[10px] uppercase tracking-[0.28em] text-[#7a7166]">
                  <th className="px-5 py-3 font-normal">sağlayıcı</th>
                  <th className="px-5 py-3 font-normal">tier</th>
                  <th className="px-5 py-3 font-normal">backend</th>
                  <th className="px-5 py-3 font-normal">notlar</th>
                </tr>
              </thead>
              <tbody>
                {PROVIDERS.map((p, i) => (
                  <tr key={p.name} className={i % 2 === 0 ? "bg-[#0a0908]" : "bg-[#0d0b0a]"}>
                    <td className="border-t border-[rgba(120,80,50,0.18)] px-5 py-4 text-[#ddd8d0]">{p.name}</td>
                    <td className="border-t border-[rgba(120,80,50,0.18)] px-5 py-4">
                      <span className={`inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] ${p.tier === "local" ? "text-[#9bd07e]" : "text-[#f08c50]"}`}>
                        <span aria-hidden className={`size-1.5 rounded-full ${p.tier === "local" ? "bg-[#9bd07e]" : "bg-[#f08c50]"}`} />
                        {p.tier}
                      </span>
                    </td>
                    <td className="border-t border-[rgba(120,80,50,0.18)] px-5 py-4 font-mono text-xs text-[#9b9285]">{p.backend}</td>
                    <td className="border-t border-[rgba(120,80,50,0.18)] px-5 py-4 text-xs text-[#bdb4a6]">{p.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-[#7a7166]">
            Tüm sağlayıcılar tenant config tablosunda satır olarak tutulur; admin paneli üzerinden{" "}
            ★ ile default seçilir, CLI <code className="text-[#f08c50]">/provider</code>{" "}
            menüsü mid-session geçişe izin verir. Codex için OAuth refresh token'ı platform tarafından
            yönetilir, kullanıcı yeniden bağlanmadan sürekli aktif kalır.
          </p>
        </section>

        {/* ╔════════════════════════════════════════════════════════════════ */}
        {/* 05 — VAULT SİSTEMİ                                               */}
        {/* ╚════════════════════════════════════════════════════════════════ */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="05" tag="vault sistemi" hint="kurumsal paylaşımlı bilgi" />
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <p className="text-base leading-relaxed text-[#bdb4a6]">
                Vault, Altaris'in kurumsal hafıza katmanıdır. Markdown tabanlı, doğal dosya
                hiyerarşisi, FTS aranabilir, üç görünürlük seviyesi destekler:{" "}
                <span className="text-[#f08c50]">private</span> · {" "}
                <span className="text-[#f08c50]">tenant</span> · {" "}
                <span className="text-[#f08c50]">executive</span>.
              </p>
              <p className="mt-6 text-base leading-relaxed text-[#bdb4a6]">
                CLI <code className="rounded-sm border border-[rgba(120,80,50,0.35)] bg-[#1a1612] px-1.5 py-0.5 text-[0.85em] text-[#f08c50]">altaris vault</code>{" "}
                komutuyla yönetilir; web tarafında card / browser / canvas force-directed graph
                görünümleri vardır. Lokal mirror{" "}
                <code className="rounded-sm border border-[rgba(120,80,50,0.35)] bg-[#1a1612] px-1.5 py-0.5 text-[0.85em] text-[#f08c50]">~/.altaris/vaults/</code>{" "}
                altında tutulur, conflict durumunda{" "}
                <code className="text-[#f08c50]">.conflict-*.md</code> sidecar üretir.
              </p>
            </div>
            <div className="space-y-4">
              {[
                ["Storage",   "Server: dosya sistemi · Client: lokal mirror · Conflict: sidecar pattern"],
                ["Search",    "PostgreSQL FTS (tsvector) + pg_trgm fuzzy · GIN index · sub-100ms p95"],
                ["Sync",      "Push + checksum diff · 64 KB/dosya cap · idempotent UUID dedup"],
                ["Görünürlük", "private (kullanıcı) · tenant (ekip) · executive (cross-vault sentez)"],
                ["Editör",    "Web: Monaco + canlı önizleme · CLI: $EDITOR · markdown editör uyumu"],
                ["Agentic katman", "agents/ · skills/ · commands/ · hooks/ · _templates/ · bin/"],
              ].map(([k, v]) => (
                <div key={k} className="border-l border-[rgba(120,80,50,0.32)] pl-4">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-[#f08c50]/80">{k}</div>
                  <div className="mt-1 text-sm leading-relaxed text-[#bdb4a6]">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ╔════════════════════════════════════════════════════════════════ */}
        {/* 06 — GÜVENLİK & UYUM                                             */}
        {/* ╚════════════════════════════════════════════════════════════════ */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="06" tag="güvenlik & uyum" hint="kvkk · iso 27001 hizalı" />
          <ul className="grid gap-x-10 gap-y-7 md:grid-cols-2 lg:grid-cols-3">
            {CAPS.map(([k, v], i) => (
              <li key={k} className="border-l border-[rgba(120,80,50,0.32)] pl-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-[#f08c50]/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="text-sm font-medium text-[#ddd8d0]">{k}</div>
                </div>
                <div className="mt-2 text-xs leading-relaxed text-[#7a7166]">{v}</div>
              </li>
            ))}
          </ul>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <ComplianceTile tag="kvkk"      desc="Kişisel veri sınıflandırma · Madde 6 hassas veri için ek RLS · 7 yıl audit retention" />
            <ComplianceTile tag="iso 27001" desc="Risk yönetimi · erişim kontrolü · log koruma · sürekli izleme süreçleri yapılandırılmış" />
            <ComplianceTile tag="bddk"      desc="Finans sektörü için sıfır data-egress mod · PII redaction · BDDK siber güvenlik tebliği uyumu" />
          </div>
        </section>

        {/* ╔════════════════════════════════════════════════════════════════ */}
        {/* 07 — DEPLOY MODELLERİ                                            */}
        {/* ╚════════════════════════════════════════════════════════════════ */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="07" tag="deploy modelleri" hint="cloud · on-prem · air-gapped" />
          <div className="grid gap-6 md:grid-cols-3">
            <DeployCard
              tag="cloud"
              title="Bulut"
              hint="Argus yönetimli"
              points={[
                "Frankfurt (EU-CENTRAL-1) datacenter",
                "Multi-tenant izolasyon, otomatik patch",
                "Anthropic / OpenAI / Codex / Gemini",
                "%99.9 uptime SLA · 7×16 destek",
              ]}
            />
            <DeployCard
              tag="on-prem"
              title="On-Prem"
              hint="müşteri datacenter"
              points={[
                "Kurumsal Linux (RHEL/Ubuntu/Rocky)",
                "Lokal Postgres + Keycloak konteynerleri",
                "Ollama / vLLM ile yerel LLM",
                "Müşteri SLA paketine bağlı destek",
              ]}
            />
            <DeployCard
              tag="air-gapped"
              title="Air-Gapped"
              hint="hava boşluklu"
              points={[
                "İnternet bağlantısı sıfır",
                "İmzalı offline güncelleme paketi",
                "Sadece yerel LLM (Llama / Qwen)",
                "Savunma, kamu, kritik altyapı",
              ]}
            />
          </div>
        </section>

        {/* ╔════════════════════════════════════════════════════════════════ */}
        {/* 08 — KULLANIM SENARYOLARI                                        */}
        {/* ╚════════════════════════════════════════════════════════════════ */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="08" tag="kullanım senaryoları" hint="sektörel" />
          <div className="grid gap-px overflow-hidden rounded-md border border-[rgba(120,80,50,0.28)] bg-[rgba(120,80,50,0.28)] md:grid-cols-2">
            {USECASES.map((u) => (
              <div key={u.tag} className="bg-[#0d0b0a] p-7 md:p-8">
                <div className="mb-5 flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">[ {u.tag} ]</span>
                  <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">use.case</span>
                </div>
                <h4 className="mb-5 text-xl font-medium tracking-tight text-[#ddd8d0]">{u.title}</h4>
                <ul className="space-y-3 text-[13px] leading-relaxed text-[#bdb4a6]">
                  {u.lines.map((l, i) => (
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

        {/* ╔════════════════════════════════════════════════════════════════ */}
        {/* 09 — TEKNİK SPESİFİKASYONLAR                                     */}
        {/* ╚════════════════════════════════════════════════════════════════ */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="09" tag="teknik spesifikasyonlar" hint="system requirements" />
          <div className="overflow-hidden rounded-md border border-[rgba(120,80,50,0.28)]">
            <dl className="divide-y divide-[rgba(120,80,50,0.18)]">
              {SPECS.map(([k, v], i) => (
                <div key={k} className={`grid grid-cols-[10rem_1fr] items-baseline gap-6 px-6 py-4 ${i % 2 === 0 ? "bg-[#0a0908]" : "bg-[#0d0b0a]"}`}>
                  <dt className="text-[11px] uppercase tracking-[0.28em] text-[#f08c50]/70">{k}</dt>
                  <dd className="text-sm leading-relaxed text-[#ddd8d0]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ╔════════════════════════════════════════════════════════════════ */}
        {/* 10 — YOL HARİTASI                                                */}
        {/* ╚════════════════════════════════════════════════════════════════ */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="10" tag="yol haritası" hint="2026" />
          <div className="grid gap-8 md:grid-cols-3">
            {ROADMAP.map((r) => (
              <div key={r.q} className="rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a] p-6 md:p-7">
                <div className="mb-5 flex items-baseline justify-between border-b border-[rgba(120,80,50,0.22)] pb-3">
                  <span className="text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">{r.q}</span>
                  <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">quarter</span>
                </div>
                <ul className="space-y-3 text-[13px] leading-relaxed text-[#bdb4a6]">
                  {r.items.map((it, i) => {
                    const done = it.includes("(✓");
                    return (
                      <li key={i} className="flex items-start gap-3">
                        <span aria-hidden className={`mt-2 size-1 shrink-0 rounded-full ${done ? "bg-[#9bd07e]" : "bg-[#f08c50]/60"}`} />
                        <span>{it}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ╔════════════════════════════════════════════════════════════════ */}
        {/* 11 — İLETİŞİM / ARKA KAPAK                                       */}
        {/* ╚════════════════════════════════════════════════════════════════ */}
        <section className="k-spread mx-auto max-w-6xl">
          <SpreadHead idx="11" tag="i̇letişim" hint="back cover" />
          <div className="grid gap-12 md:grid-cols-[1fr_1.2fr]">
            <div className="space-y-8">
              <div>
                <div className="text-[10px] uppercase tracking-[0.32em] text-[#3a342d]">/ kurumsal satış</div>
                <p className="mt-3 text-[clamp(20px,2.4vw,30px)] font-light leading-[1.25] text-[#ddd8d0]">
                  Kurum içi veriden bir bayt çıkarmadan{" "}
                  <span className="k-grad">agentik AI çalıştırmaya</span>{" "}
                  hazırsanız — demoyu konuşalım.
                </p>
              </div>
              <ul className="space-y-3 text-sm">
                {[
                  ["e-posta",   "satis@argusteknoloji.com"],
                  ["telefon",   "+90 (212) 000 00 00"],
                  ["adres",     "Argus Teknoloji A.Ş. · İstanbul"],
                  ["web",       "argusteknoloji.com / altaris"],
                ].map(([k, v]) => (
                  <li key={k} className="grid grid-cols-[6rem_1fr] items-baseline gap-4 border-b border-[rgba(120,80,50,0.18)] pb-3">
                    <span className="text-[11px] uppercase tracking-[0.28em] text-[#f08c50]/70">{k}</span>
                    <span className="text-[#ddd8d0]">{v}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a] p-7 md:p-8">
              <div className="mb-5 flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">[ pilot ]</span>
                <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">demo.protocol</span>
              </div>
              <ol className="space-y-5 text-sm">
                {[
                  ["01", "Keşif görüşmesi",     "30 dk · NDA imzalı, kullanım senaryosu çıkarımı."],
                  ["02", "Pilot kapsamı",       "1–3 hafta · sınırlı tenant, 5–10 kullanıcı."],
                  ["03", "Deploy",              "Cloud sandbox veya müşteri datacenter — seçim sizin."],
                  ["04", "Production geçiş",    "SLA paketi ile devamlılık · sertifika & dokümantasyon."],
                ].map(([n, t, d]) => (
                  <li key={n} className="grid grid-cols-[2.5rem_1fr] items-baseline gap-4">
                    <span className="text-[11px] uppercase tracking-[0.28em] text-[#f08c50]/80">{n}</span>
                    <div>
                      <div className="font-medium text-[#ddd8d0]">{t}</div>
                      <div className="mt-1 text-xs leading-relaxed text-[#7a7166]">{d}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="absolute bottom-12 left-12 right-12 flex items-end justify-between text-[10px] uppercase tracking-[0.28em] text-[#6b6358] md:bottom-16 md:left-24 md:right-24">
            <div>edition 01 · 2026 · v{process.env.NEXT_PUBLIC_BUILD_VERSION ?? "0.0.0"}</div>
            <div>© argus teknoloji · altaris</div>
          </div>
        </section>

        {/* footer ruler */}
        <div aria-hidden className="k-rule h-px" />
        <div className="k-no-print mx-auto max-w-6xl px-6 py-6 text-[10px] uppercase tracking-[0.28em] text-[#6b6358]">
          Yazdırmak için <span className="text-[#ddd8d0]">⌘/Ctrl + P</span>. Sayfa düzeni A4 · arka plan renklerini koruyacak şekilde ayarlanmıştır.
        </div>
      </main>
    </>
  );
}

// ── PARÇALAR ─────────────────────────────────────────────────────────────

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

function Stat({
  label,
  value,
  suffix,
  note,
}: {
  label: string;
  value: string;
  suffix: string;
  note: string;
}) {
  return (
    <div className="border-l border-[rgba(120,80,50,0.32)] pl-5">
      <div className="text-[10px] uppercase tracking-[0.28em] text-[#7a7166]">{label}</div>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="text-[clamp(36px,4vw,56px)] font-light leading-none text-[#ddd8d0]">{value}</span>
        <span className="text-xs uppercase tracking-[0.22em] text-[#f08c50]">{suffix}</span>
      </div>
      <div className="mt-2 text-xs leading-relaxed text-[#7a7166]">{note}</div>
    </div>
  );
}

function SurfacePanel({
  num,
  title,
  kicker,
  specs,
  children,
}: {
  num: string;
  title: string;
  kicker: string;
  specs: Array<[string, string]>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0d0b0a] p-7 md:p-8">
      <div className="mb-6 flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.32em] text-[#3a342d]">/{num}</span>
        <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">{kicker}</span>
      </div>
      <h4 className="mb-4 text-xl font-medium tracking-tight text-[#ddd8d0]">{title}</h4>
      <p className="text-[13px] leading-relaxed text-[#9b9285]">{children}</p>
      <dl className="mt-6 space-y-2 border-t border-[rgba(120,80,50,0.18)] pt-5 text-xs">
        {specs.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[5.5rem_1fr] items-baseline gap-3">
            <dt className="text-[10px] uppercase tracking-[0.22em] text-[#f08c50]/70">{k}</dt>
            <dd className="text-[#bdb4a6]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ComplianceTile({ tag, desc }: { tag: string; desc: string }) {
  return (
    <div className="rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a] p-5">
      <div className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">{tag}</div>
      <p className="mt-3 text-xs leading-relaxed text-[#bdb4a6]">{desc}</p>
    </div>
  );
}

function DeployCard({
  tag,
  title,
  hint,
  points,
}: {
  tag: string;
  title: string;
  hint: string;
  points: string[];
}) {
  return (
    <div className="rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a]">
      <div className="flex items-baseline justify-between border-b border-[rgba(120,80,50,0.22)] px-6 py-4">
        <span className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">[ {tag} ]</span>
        <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">{hint}</span>
      </div>
      <div className="px-6 pb-6 pt-5">
        <h4 className="text-[clamp(20px,2.4vw,26px)] font-light tracking-tight text-[#ddd8d0]">{title}</h4>
        <ul className="mt-6 space-y-3 text-[13px] leading-relaxed text-[#bdb4a6]">
          {points.map((p, i) => (
            <li key={p} className="flex items-start gap-3 border-t border-[rgba(120,80,50,0.18)] pt-3 first:border-t-0 first:pt-0">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-[#f08c50]/70" />
              <span>{p}</span>
              {i === -1 ? null : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
