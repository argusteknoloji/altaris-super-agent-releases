import Link from "next/link";
import { auth, signIn } from "@/auth";

// ──────────────────────────────────────────────────────────────────────────
// Altaris landing — editorial terminal direction.
//
// Mono-first typography (no third-party fonts, ui-monospace stack only). The
// brand signature is the literal ALTARIS block-letter banner from the CLI,
// rendered with a sunset-gradient text clip. Atmosphere comes from a single
// warm radial wash + a hairline ruled grid borrowed from technical spec
// sheets. No new deps. Server component, async, Tailwind only.
// ──────────────────────────────────────────────────────────────────────────

const ALTARIS_ASCII = `█▀█   █    ▀█▀   █▀█   █▀▄   █   █▀▀
█▀█   █     █    █▀█   █▀▄   █   ▀▀█
▀ ▀   ▀▀▀   ▀    ▀ ▀   ▀ ▀   ▀   ▀▀▀`;

export default async function HomePage() {
  const session = await auth();
  const enter = session ? (
    <Link
      href="/dashboard"
      className="group inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#ddd8d0] transition-colors hover:text-[#ffb464]"
    >
      <span>panele git</span>
      <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
    </Link>
  ) : (
    <form
      action={async () => {
        "use server";
        await signIn("keycloak", { redirectTo: "/dashboard" });
      }}
    >
      <button
        type="submit"
        className="group inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#ddd8d0] transition-colors hover:text-[#ffb464]"
      >
        <span>giriş yap</span>
        <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
      </button>
    </form>
  );

  const enterCta = session ? (
    <Link
      href="/dashboard"
      className="group inline-flex items-center gap-3 border border-[#f08c50] bg-[#f08c50] px-7 py-3.5 text-[11px] uppercase tracking-[0.3em] text-[#0a0908] transition-all duration-300 hover:bg-transparent hover:text-[#f08c50]"
    >
      <span>panele git</span>
      <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
    </Link>
  ) : (
    <form
      action={async () => {
        "use server";
        await signIn("keycloak", { redirectTo: "/dashboard" });
      }}
    >
      <button
        type="submit"
        className="group inline-flex items-center gap-3 border border-[#f08c50] bg-[#f08c50] px-7 py-3.5 text-[11px] uppercase tracking-[0.3em] text-[#0a0908] transition-all duration-300 hover:bg-transparent hover:text-[#f08c50]"
      >
        <span>giriş yap</span>
        <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
      </button>
    </form>
  );

  return (
    <>
      <style>{`
        @keyframes altaris_blink   { 50% { opacity: 0; } }
        @keyframes altaris_shimmer { 0% { background-position: 0% 50%; } 100% { background-position: -200% 50%; } }
        @keyframes altaris_fade    { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .a-blink    { animation: altaris_blink 1.05s steps(1) infinite; }
        .a-shimmer  {
          background-image: linear-gradient(110deg, #ffb464 0%, #f08c50 18%, #d97757 36%, #c15f3c 54%, #823c32 72%, #c15f3c 90%, #f08c50 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: altaris_shimmer 14s linear infinite;
        }
        .a-grad     {
          background-image: linear-gradient(110deg, #ffb464 0%, #f08c50 35%, #d97757 60%, #c15f3c 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .a-reveal   { opacity: 0; animation: altaris_fade 800ms cubic-bezier(.2,.7,.2,1) forwards; }
        .a-hairline { background-image: linear-gradient(to right, transparent, rgba(120,80,50,.45), transparent); }
        .a-card-line {
          position: absolute; inset: auto 0 0 0; height: 1px;
          background: linear-gradient(to right, transparent, #f08c50, transparent);
          transform: scaleX(0); transform-origin: left center;
          transition: transform 600ms cubic-bezier(.2,.7,.2,1);
        }
        .a-card:hover .a-card-line { transform: scaleX(1); }
        .a-card:hover .a-card-num  { color: #f08c50; }
        .a-card-num                { transition: color 400ms ease; }
      `}</style>

      <main className="relative min-h-screen overflow-x-hidden bg-[#0a0908] font-mono text-[#ddd8d0] antialiased">
        {/* ── ATMOSPHERE ─────────────────────────────────────────────── */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(240,140,80,0.10),transparent_70%)]" />
          <div className="absolute inset-x-0 top-0 h-px a-hairline" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_60%,rgba(0,0,0,0.55)_100%)]" />
        </div>

        {/* ── TOP RULE / NAV ─────────────────────────────────────────── */}
        <header className="border-b border-[rgba(120,80,50,0.22)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-[#6b6358]">
              <span aria-hidden className="size-1.5 rounded-full bg-[#f08c50] a-blink" />
              <span>cloud</span>
              <span className="text-[#3a342d]">·</span>
              <span>live</span>
              <span className="text-[#3a342d]">/</span>
              <span className="text-[#9b9285]">v0.1.0-alpha</span>
            </div>
            {enter}
          </div>
        </header>

        {/* ── HERO ───────────────────────────────────────────────────── */}
        <section className="relative mx-auto max-w-6xl px-6 pb-28 pt-20 md:pt-28">
          {/* Floating column-rule meta */}
          <div
            className="a-reveal flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]"
            style={{ animationDelay: "0ms" }}
          >
            <span>argus teknoloji</span>
            <span aria-hidden className="h-px w-10 bg-[#3a342d]" />
            <span>i̇stanbul · ankara · berlin</span>
            <span aria-hidden className="h-px w-10 bg-[#3a342d]" />
            <span>2026</span>
          </div>

          {/* Block-letter wordmark */}
          <pre
            aria-label="Altaris"
            className="a-reveal a-shimmer mt-10 select-none overflow-x-auto whitespace-pre font-bold leading-[1.05] tracking-[0.02em] text-[clamp(11px,1.7vw,18px)] md:text-[clamp(13px,1.9vw,22px)]"
            style={{ animationDelay: "120ms" }}
          >
{ALTARIS_ASCII}
          </pre>

          {/* Tagline */}
          <div className="a-reveal mt-12 max-w-3xl" style={{ animationDelay: "260ms" }}>
            <h2 className="text-[clamp(22px,3.4vw,40px)] font-light leading-[1.18] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">{"// "}</span>
              Kurumsal ekiplerin{" "}
              <span className="a-grad font-medium">agentic AI</span>{" "}
              terminali.
            </h2>
            <p className="mt-7 max-w-2xl text-sm leading-relaxed text-[#9b9285] md:text-base">
              Lokalde çalışan{" "}
              <code className="rounded-sm border border-[rgba(120,80,50,0.35)] bg-[#1a1612] px-1.5 py-0.5 font-mono text-[0.85em] text-[#f08c50]">
                altaris
              </code>{" "}
              komutu, web üzerinden yönetilen tek panel, on-prem ya da bulut deploy.
              KVKK uyumlu audit trail, kurumlara özel veri izolasyonu, vault tabanlı kurumsal hafıza —
              tek binary, tek kontrol düzlemi, ekibinizin paylaşılan zihni.
            </p>
          </div>

          {/* Pseudo-prompt */}
          <div
            className="a-reveal mt-14 inline-flex max-w-full items-center gap-3 overflow-x-auto rounded-md border border-[rgba(120,80,50,0.32)] bg-[#14110f] px-5 py-3 shadow-[0_0_0_1px_rgba(0,0,0,0.4),0_30px_60px_-30px_rgba(240,140,80,0.18)]"
            style={{ animationDelay: "400ms" }}
          >
            <span aria-hidden className="text-[#f08c50]">▸</span>
            <code className="whitespace-nowrap text-sm text-[#ddd8d0]">
              <span className="text-[#7a7166]">altaris</span>{" "}
              <span className="text-[#ddd8d0]">login</span>{" "}
              <span className="text-[#9b9285]">--api</span>{" "}
              <span className="text-[#f08c50]">https://altaris.local</span>
            </code>
            <span aria-hidden className="ml-1 inline-block h-4 w-[7px] bg-[#f08c50] a-blink" />
          </div>

          {/* Side rules (decorative) */}
          <div
            aria-hidden
            className="pointer-events-none absolute right-6 top-28 hidden flex-col items-end gap-2 text-[9px] uppercase tracking-[0.4em] text-[#3a342d] md:flex"
          >
            <span>argus.altaris</span>
            <span className="h-12 w-px bg-[#3a342d]" />
            <span>v0.1.0-α</span>
          </div>
        </section>

        {/* ── DÖRT YÜZEY ────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 pb-28">
          <SectionHead idx="01" tag="dört yüzey" hint="terminal · masaüstü · web · remote" />
          <div className="grid gap-px overflow-hidden rounded-md border border-[rgba(120,80,50,0.22)] bg-[rgba(120,80,50,0.22)] md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard num="01" title="Terminal">
              <code className="text-[#f08c50]">altaris</code> komutu ile lokal LLM destekli agentik shell.
              macOS, Linux, Windows tek binary. Bulut ve kurum içi model sağlayıcıları —
              hepsi tek <em className="text-[#ddd8d0] not-italic">kurum ayarı</em>'nın arkasında.
            </FeatureCard>
            <FeatureCard num="02" title="Masaüstü Uygulaması">
              Terminale alışkın olmayan kullanıcılar için <em className="text-[#ddd8d0] not-italic">native</em> macOS
              ve Windows uygulaması. Tauri tabanlı, ~10 MB binary. Auto-update, code-signed,
              air-gapped USB dağıtıma uygun.
            </FeatureCard>
            <FeatureCard num="03" title="Web Chat">
              Tarayıcıdan oturum aç, ekibinizle paylaşılan kurumsal hafızada sohbet et. Vault tabanlı bağlam,
              tam transcript, oturum geçmişi — admin panelinde herkesin tüm konuşmaları izlenebilir.
            </FeatureCard>
            <FeatureCard num="04" title="Remote Control">
              Lokalde çalışan <code className="text-[#f08c50]">altaris</code> oturumlarını web'den izle ve devral.
              Multi-viewer denetim, takeover ile yetkili devralma, her tuş vuruşu için audit kaydı.
            </FeatureCard>
          </div>
        </section>

        {/* ── KİM İÇİN — CLOUD / ON-PREM ──────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 pb-28">
          <SectionHead idx="02" tag="kim için" hint="bulut · on-prem" />
          <div className="grid gap-6 md:grid-cols-2">
            <DeployPanel
              tag="cloud"
              title="Bulut"
              subtitle="Hızlı başla, üst-tier modeller"
              points={[
                "Üst seviye bulut model seçenekleri",
                "Veritabanı seviyesinde kurumlara özel veri izolasyonu",
                "Kurumsal SSO entegrasyonu hazır",
                "Tarayıcı üzerinden mevcut model hesaplarını bağlama",
              ]}
            />
            <DeployPanel
              tag="on-prem"
              title="On-Prem"
              subtitle="Veri tek bir bayt dışarı çıkmaz"
              points={[
                "Kurum içi model altyapısı bağlantısı",
                "Kurum içi veritabanı ve kimlik yönetimi",
                "Air-gapped kurulum, hava boşluklu güncelleme paketleri",
                "Kamu, savunma, finans için KVKK + ISO 27001 hizalı",
              ]}
            />
          </div>
        </section>

        {/* ── KURUMSAL OMURGA ──────────────────────────────────────── */}
        <section className="border-y border-[rgba(120,80,50,0.22)] bg-[#0d0b0a]">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <SectionHead idx="03" tag="kurumsal omurga" hint="6 sütun" muted />
            <ul className="grid gap-x-10 gap-y-7 md:grid-cols-2 lg:grid-cols-3">
              {CAPS.map(([k, v], i) => (
                <li key={k} className="flex gap-4 border-l border-[rgba(120,80,50,0.32)] pl-4">
                  <span className="mt-0.5 shrink-0 text-[10px] uppercase tracking-[0.22em] text-[#f08c50]/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-[#ddd8d0]">{k}</div>
                    <div className="mt-1.5 text-xs leading-relaxed text-[#7a7166]">{v}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 py-28">
          <div className="flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">/ başla</div>
              <p className="mt-5 max-w-2xl text-[clamp(20px,2.4vw,30px)] font-light leading-[1.25] text-[#ddd8d0]">
                Kurum içi veriden bir bayt çıkarmadan{" "}
                <span className="a-grad">agentik AI çalıştırmaya</span>{" "}
                hazırsanız — demoyu konuşalım.
              </p>
            </div>
            {enterCta}
          </div>
        </section>

        {/* ── FOOTER ────────────────────────────────────────────────── */}
        <footer className="border-t border-[rgba(120,80,50,0.22)]">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-7 text-[10px] uppercase tracking-[0.28em] text-[#6b6358] md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <span className="text-[#ddd8d0]">altaris</span>
              <span className="text-[#3a342d]">·</span>
              <span>v0.1.0-alpha</span>
              <span className="text-[#3a342d]">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-1 rounded-full bg-[#f08c50] a-blink" />
                live
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span>© 2026 argus teknoloji</span>
              <span className="text-[#3a342d]">·</span>
              <span>kurumsal agentic ai</span>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}

// ── PARÇACIKLAR ──────────────────────────────────────────────────────────

function SectionHead({
  idx,
  tag,
  hint,
  muted = false,
}: {
  idx: string;
  tag: string;
  hint: string;
  muted?: boolean;
}) {
  return (
    <div className={`mb-10 flex items-baseline justify-between border-b ${muted ? "border-[rgba(120,80,50,0.18)]" : "border-[rgba(120,80,50,0.22)]"} pb-4`}>
      <div className="flex items-baseline gap-4">
        <span className="text-[10px] uppercase tracking-[0.32em] text-[#3a342d]">/ {idx}</span>
        <h3 className="text-[10px] uppercase tracking-[0.32em] text-[#ddd8d0]">{tag}</h3>
      </div>
      <span className="text-[10px] uppercase tracking-[0.28em] text-[#3a342d]">{hint}</span>
    </div>
  );
}

function FeatureCard({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="a-card group relative overflow-hidden bg-[#0d0b0a] p-7 transition-colors duration-300 hover:bg-[#100d0b] md:p-8">
      <div className="mb-6 flex items-baseline justify-between">
        <span className="a-card-num text-[10px] uppercase tracking-[0.32em] text-[#3a342d]">
          /{num}
        </span>
        <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">module</span>
      </div>
      <h4 className="mb-4 text-xl font-medium tracking-tight text-[#ddd8d0]">
        {title}
      </h4>
      <p className="text-[13px] leading-relaxed text-[#9b9285]">{children}</p>
      <span aria-hidden className="a-card-line" />
    </div>
  );
}

function DeployPanel({
  tag,
  title,
  subtitle,
  points,
}: {
  tag: string;
  title: string;
  subtitle: string;
  points: string[];
}) {
  return (
    <div className="relative overflow-hidden rounded-md border border-[rgba(120,80,50,0.28)] bg-[#0d0b0a]">
      {/* corner tag */}
      <div className="flex items-baseline justify-between border-b border-[rgba(120,80,50,0.22)] px-7 py-4">
        <span className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">[ {tag} ]</span>
        <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">deploy.target</span>
      </div>
      <div className="px-7 pb-7 pt-6">
        <h4 className="text-[clamp(22px,2.6vw,30px)] font-light tracking-tight text-[#ddd8d0]">
          {title}
        </h4>
        <p className="mt-1.5 text-[11px] uppercase tracking-[0.22em] text-[#7a7166]">
          {subtitle}
        </p>
        <ul className="mt-7 space-y-4">
          {points.map((p, i) => (
            <li
              key={p}
              className="flex items-start gap-4 border-t border-[rgba(120,80,50,0.18)] pt-4 first:border-t-0 first:pt-0"
            >
              <span className="mt-0.5 shrink-0 text-[10px] uppercase tracking-[0.22em] text-[#f08c50]/70">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[13px] leading-relaxed text-[#bdb4a6]">{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const CAPS: Array<[string, string]> = [
  [
    "Kurumsal veri izolasyonu",
    "Tek fiziksel veritabanı üzerinde kurum bazlı ayrım ve katı erişim politikalarıyla izolasyon.",
  ],
  [
    "KVKK-uyumlu audit",
    "Her işlem, yetkili erişim ve model geçişi merkezi olarak kayıt altına alınır. Tam izlenebilir kurumsal trail.",
  ],
  [
    "Kurumsal SSO",
    "CLI, web ve yönetim paneli aynı kurumsal kimlik altyapısı üzerinden güvenli oturum açar.",
  ],
  [
    "Model soyutlama katmanı",
    "Bulut ve kurum içi model sağlayıcıları tek kurum ayarında yönetilir; oturum içinde kontrollü geçiş yapılır.",
  ],
  [
    "Vault tabanlı hafıza",
    "Obsidian uyumlu kurumsal knowledge base, güçlü arama ve paylaşımlı bağlam yönetimi.",
  ],
  [
    "Container-only kurulum",
    "docker compose up · 6 servis · MacBook açılışında otomatik başlatma. Tek komut, tek panel, sıfır el ile yapılandırma.",
  ],
];
