import Link from "next/link";
import { auth } from "@/auth";
import { detectLocale, t } from "@/lib/i18n";
import { LocaleSwitcher } from "@/app/_components/LocaleSwitcher";
import SignInButton from "@/app/_components/SignInButton";

// ──────────────────────────────────────────────────────────────────────────
// Altaris landing — editorial terminal direction.
//
// Mono-first typography (no third-party fonts, ui-monospace stack only). The
// brand signature is the literal ALTARIS block-letter banner from the CLI,
// rendered with a sunset-gradient text clip. Atmosphere comes from a single
// warm radial wash + a hairline ruled grid borrowed from technical spec
// sheets. No new deps. Server component, async, Tailwind only.
//
// Locale: default EN, falls back to TR when Accept-Language signals Turkish.
// Manual switcher in the header writes a cookie.
// ──────────────────────────────────────────────────────────────────────────

const ALTARIS_ASCII = `█▀█   █    ▀█▀   █▀█   █▀▄   █   █▀▀
█▀█   █     █    █▀█   █▀▄   █   ▀▀█
▀ ▀   ▀▀▀   ▀    ▀ ▀   ▀ ▀   ▀   ▀▀▀`;

export default async function HomePage() {
  const session = await auth();
  const locale = await detectLocale();
  const d = t(locale);

  const enter = session ? (
    <Link
      href="/dashboard"
      className="group inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#ddd8d0] transition-colors hover:text-[#ffb464]"
    >
      <span>{d.nav.panel}</span>
      <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
    </Link>
  ) : (
    <SignInButton className="group inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#ddd8d0] transition-colors hover:text-[#ffb464]">
      <span>{d.nav.signIn}</span>
      <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
    </SignInButton>
  );

  const enterCta = session ? (
    <Link
      href="/dashboard"
      className="group inline-flex items-center gap-3 border border-[#f08c50] bg-[#f08c50] px-7 py-3.5 text-[11px] uppercase tracking-[0.3em] text-[#0a0908] transition-all duration-300 hover:bg-transparent hover:text-[#f08c50]"
    >
      <span>{d.nav.panel}</span>
      <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
    </Link>
  ) : (
    <SignInButton className="group inline-flex items-center gap-3 border border-[#f08c50] bg-[#f08c50] px-7 py-3.5 text-[11px] uppercase tracking-[0.3em] text-[#0a0908] transition-all duration-300 hover:bg-transparent hover:text-[#f08c50]">
      <span>{d.nav.signIn}</span>
      <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
    </SignInButton>
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
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-[#6b6358]">
              <span aria-hidden className="size-1.5 rounded-full bg-[#f08c50] a-blink" />
              <span>{d.nav.cloud}</span>
              <span className="text-[#3a342d]">·</span>
              <span>{d.nav.live}</span>
              <span className="text-[#3a342d]">/</span>
              <span className="text-[#9b9285]">{d.footer.edition}</span>
            </div>
            <div className="flex items-center gap-5">
              <Link
                href="/senaryolar"
                className="group hidden items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#9b9285] transition-colors hover:text-[#ffb464] sm:inline-flex"
              >
                <span>{d.nav.scenes}</span>
                <span aria-hidden className="text-[#3a342d] transition-colors group-hover:text-[#f08c50]">·</span>
                <span className="text-[#6b6358]">{d.nav.chapters}</span>
              </Link>
              <Link
                href="/cli"
                className="group hidden items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#9b9285] transition-colors hover:text-[#9bd07e] sm:inline-flex"
              >
                <span>cli</span>
                <span aria-hidden className="text-[#3a342d] transition-colors group-hover:text-[#9bd07e]">·</span>
                <span className="text-[#6b6358]">iv</span>
              </Link>
              <LocaleSwitcher current={locale} path="/" />
              {enter}
            </div>
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
            <span>{d.hero.metaCities}</span>
            <span aria-hidden className="h-px w-10 bg-[#3a342d]" />
            <span>{d.hero.metaYear}</span>
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
              {d.hero.taglinePre}
              <span className="a-grad font-medium">{d.hero.taglineGrad}</span>
              {d.hero.taglinePost}
            </h2>
            <p className="mt-7 max-w-2xl text-sm leading-relaxed text-[#9b9285] md:text-base">
              {d.hero.description}
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

          <div
            aria-hidden
            className="pointer-events-none absolute right-6 top-28 hidden flex-col items-end gap-2 text-[9px] uppercase tracking-[0.4em] text-[#3a342d] md:flex"
          >
            <span>argus.altaris</span>
            <span className="h-12 w-px bg-[#3a342d]" />
            <span>v0.1.0-α</span>
          </div>
        </section>

        {/* ── DÖRT YÜZEY / FOUR SURFACES ─────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 pb-28">
          <SectionHead idx="01" tag={d.surfaces.head} hint={d.surfaces.hint} />
          <div className="grid gap-px overflow-hidden rounded-md border border-[rgba(120,80,50,0.22)] bg-[rgba(120,80,50,0.22)] md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard num="01" title={d.surfaces.terminal.title}>{d.surfaces.terminal.body}</FeatureCard>
            <FeatureCard num="02" title={d.surfaces.desktop.title}>{d.surfaces.desktop.body}</FeatureCard>
            <FeatureCard num="03" title={d.surfaces.web.title}>{d.surfaces.web.body}</FeatureCard>
            <FeatureCard num="04" title={d.surfaces.remote.title}>{d.surfaces.remote.body}</FeatureCard>
          </div>
        </section>

        {/* ── KİM İÇİN / WHO IT'S FOR ────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 pb-28">
          <SectionHead idx="02" tag={d.whoFor.head} hint={d.whoFor.hint} />
          <div className="grid gap-6 md:grid-cols-2">
            <DeployPanel
              tag={d.whoFor.cloud.tag}
              title={d.whoFor.cloud.title}
              subtitle={d.whoFor.cloud.subtitle}
              points={d.whoFor.cloud.points}
            />
            <DeployPanel
              tag={d.whoFor.onprem.tag}
              title={d.whoFor.onprem.title}
              subtitle={d.whoFor.onprem.subtitle}
              points={d.whoFor.onprem.points}
            />
          </div>
        </section>

        {/* ── ENTERPRISE BACKBONE ───────────────────────────────────── */}
        <section className="border-y border-[rgba(120,80,50,0.22)] bg-[#0d0b0a]">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <SectionHead idx="03" tag={d.spine.head} hint={d.spine.hint} muted />
            <ul className="grid gap-x-10 gap-y-7 md:grid-cols-2 lg:grid-cols-3">
              {d.spine.items.map(([k, v], i) => (
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

        {/* ── SCENES TEASE ─────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 pb-28">
          <SectionHead idx="04" tag={d.scenes.head} hint={d.scenes.hint} />

          <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] md:items-start md:gap-14">
            <div>
              <h3 className="whitespace-pre-line text-[clamp(26px,3.4vw,42px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
                {d.scenes.title1}
                <span className="a-grad font-medium">{d.scenes.titleGrad}</span>
                {d.scenes.title3}
              </h3>
              <p className="mt-6 max-w-md text-sm leading-relaxed text-[#9b9285] md:text-[15px]">
                {d.scenes.lede}
              </p>

              <Link
                href="/senaryolar"
                className="group mt-9 inline-flex items-center gap-3 border border-[#f08c50] px-6 py-3 text-[10px] uppercase tracking-[0.3em] text-[#f08c50] transition-all duration-300 hover:bg-[#f08c50] hover:text-[#0a0908]"
              >
                <span>{d.scenes.cta}</span>
                <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
              </Link>

              <div className="mt-7 flex items-center gap-3 text-[9px] uppercase tracking-[0.32em] text-[#3a342d]">
                <span aria-hidden className="size-1.5 rounded-full bg-[#f08c50] a-blink" />
                <span>{d.scenes.livePreview}</span>
                <span aria-hidden className="h-px w-8 bg-[#3a342d]" />
                <span>{d.scenes.keyboardHint}</span>
              </div>
            </div>

            <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-[rgba(120,80,50,0.22)] bg-[rgba(120,80,50,0.22)] sm:grid-cols-2">
              {d.scenes.list.map((s) => (
                <li key={s.num}>
                  <Link
                    href="/senaryolar"
                    className="group relative flex items-baseline gap-4 bg-[#0d0b0a] px-5 py-3.5 transition-colors duration-300 hover:bg-[#100d0b]"
                  >
                    <span aria-hidden className="absolute left-0 top-0 h-full w-[2px] origin-top scale-y-0 bg-[#f08c50] transition-transform duration-500 group-hover:scale-y-100" />
                    <span className="w-9 shrink-0 font-light leading-none text-[#3a342d] transition-colors group-hover:text-[#f08c50] text-[18px]">
                      {s.num}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[#ddd8d0]">{s.title}</span>
                    <span className="shrink-0 text-[9px] uppercase tracking-[0.26em] text-[#7a7166]">{s.tag}</span>
                    <span aria-hidden className="-mr-1 text-[12px] text-[#3a342d] transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-[#f08c50]">→</span>
                  </Link>
                </li>
              ))}
              <li className="sm:col-span-2">
                <Link
                  href="/senaryolar"
                  className="group flex items-center justify-between gap-4 bg-[#0d0b0a] px-5 py-4 transition-colors duration-300 hover:bg-[#14110f]"
                >
                  <span className="text-[10px] uppercase tracking-[0.32em] text-[#7a7166] transition-colors group-hover:text-[#f08c50]">
                    /xiii · {d.scenes.seeAll}
                  </span>
                  <span aria-hidden className="text-[#f08c50] transition-transform duration-300 group-hover:translate-x-1">→</span>
                </Link>
              </li>
            </ul>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 py-28">
          <div className="flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">{d.start.head}</div>
              <p className="mt-5 max-w-2xl text-[clamp(20px,2.4vw,30px)] font-light leading-[1.25] text-[#ddd8d0]">
                {d.start.line1}
                <span className="a-grad">{d.start.lineGrad}</span>
                {d.start.cta}
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
              <span>{d.footer.edition}</span>
              <span className="text-[#3a342d]">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-1 rounded-full bg-[#f08c50] a-blink" />
                {d.nav.live}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span>{d.footer.copy}</span>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}

// ── PARTS ──────────────────────────────────────────────────────────

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
        <span className="a-card-num text-[10px] uppercase tracking-[0.32em] text-[#3a342d]">/{num}</span>
        <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">module</span>
      </div>
      <h4 className="mb-4 text-xl font-medium tracking-tight text-[#ddd8d0]">{title}</h4>
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
      <div className="flex items-baseline justify-between border-b border-[rgba(120,80,50,0.22)] px-7 py-4">
        <span className="text-[10px] uppercase tracking-[0.32em] text-[#f08c50]">[ {tag} ]</span>
        <span className="text-[10px] uppercase tracking-[0.22em] text-[#3a342d]">deploy.target</span>
      </div>
      <div className="px-7 pb-7 pt-6">
        <h4 className="text-[clamp(22px,2.6vw,30px)] font-light tracking-tight text-[#ddd8d0]">{title}</h4>
        <p className="mt-1.5 text-[11px] uppercase tracking-[0.22em] text-[#7a7166]">{subtitle}</p>
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
