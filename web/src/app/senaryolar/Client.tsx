"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LocaleSwitcher } from "@/app/_components/LocaleSwitcher";
import type { Locale } from "@/lib/i18n";

type Scene = {
  num: string;
  title: string;
  line: string;
  meta: [string, string, string];
  tag: string;
};

type ClientDict = {
  scenes: {
    sectionHead: string;
    livePreview: string;
    pageTitleA: string;
    pageTitleGrad: string;
    pageTitleC: string;
    pageLede: string;
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
    chapter: string;
  };
  nav: { altaris: string; home: string; scenes: string };
  start: { head: string; requestDemo: string };
  footer: { copy: string };
};

const SRC_BY_NUM: Record<string, string> = {
  I:    "/scenarios/01-yonetici-sabahi.mp4",
  II:   "/scenarios/02-gece-krizi.mp4",
  III:  "/scenarios/03-boardroom.mp4",
  IV:   "/scenarios/04-ilk-gun.mp4",
  V:    "/scenarios/05-10dk-kala.mp4",
  VI:   "/scenarios/06-imza-oncesi.mp4",
  VII:  "/scenarios/07-sessiz-cikis.mp4",
  VIII: "/scenarios/08-q4-hedefi.mp4",
  IX:   "/scenarios/09-yatirim-karari.mp4",
  X:    "/scenarios/10-denetim-hazir.mp4",
  XI:   "/scenarios/11-yesil-sinir.mp4",
  XII:  "/scenarios/12-aksam-vardiyasi.mp4",
  XIII: "/scenarios/13-hat-durusu.mp4",
  XIV:  "/scenarios/14-davaya-24-saat.mp4",
  XV:   "/scenarios/15-komite-sabahi.mp4",
  XVI:  "/scenarios/16-konteyner-gecikmesi.mp4",
};

export default function SenaryolarClient({
  scenes,
  d,
  locale,
}: {
  scenes: Scene[];
  d: ClientDict;
  locale: Locale;
}) {
  const [active, setActive] = useState(0);
  const [engaged, setEngaged] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isFs, setIsFs] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  // load + play whenever active changes
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const desired = SRC_BY_NUM[scenes[active].num];
    if (!desired) return;
    if (!v.src.endsWith(desired)) v.src = desired;
    v.play().catch(() => {});
  }, [active, scenes]);

  // sync mute
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt && tgt.matches?.("input, textarea")) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % scenes.length); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + scenes.length) % scenes.length); }
      else if (e.key === "Enter") { setEngaged(true); setMuted(false); videoRef.current?.play(); }
      else if (e.key.toLowerCase() === "m") { setMuted((m) => !m); }
      else if (e.key.toLowerCase() === "f") { e.preventDefault(); toggleFullscreen(); }
      else if (e.key === " ") {
        e.preventDefault();
        const v = videoRef.current; if (!v) return;
        v.paused ? v.play() : v.pause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes.length]);

  // fullscreen state listener — Safari webkit prefix'li event'i de dinle
  useEffect(() => {
    const onFs = () => {
      const fsEl = document.fullscreenElement
        // @ts-expect-error — Safari prefix
        || document.webkitFullscreenElement
        // @ts-expect-error — iOS Safari (only on <video>)
        || document.webkitCurrentFullScreenElement;
      setIsFs(Boolean(fsEl));
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    // iOS Safari video tam ekran event'i ayrı
    const v = videoRef.current;
    v?.addEventListener("webkitbeginfullscreen", onFs);
    v?.addEventListener("webkitendfullscreen", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
      v?.removeEventListener("webkitbeginfullscreen", onFs);
      v?.removeEventListener("webkitendfullscreen", onFs);
    };
  }, []);

  const toggleFullscreen = () => {
    const el = frameRef.current;
    const v  = videoRef.current;
    if (!el && !v) return;
    // Aktif fullscreen var mı? (standart + webkit)
    const fsActive = document.fullscreenElement
      // @ts-expect-error — Safari prefix
      || document.webkitFullscreenElement
      // @ts-expect-error — iOS Safari
      || document.webkitCurrentFullScreenElement;

    if (fsActive) {
      (document.exitFullscreen
        // @ts-expect-error — Safari prefix
        ?? document.webkitExitFullscreen?.bind(document))?.();
      return;
    }

    setEngaged(true);
    setMuted(false);

    // iOS Safari div fullscreen desteklemiyor — sadece <video>'nun
    // webkitEnterFullscreen() metodu çalışır. macOS Safari div fullscreen
    // için webkitRequestFullscreen prefix'ine ihtiyaç duyar.
    // @ts-expect-error — iOS Safari only
    const iosVideoFs = v?.webkitEnterFullscreen as (() => void) | undefined;
    const elReq = el?.requestFullscreen
      // @ts-expect-error — Safari prefix
      ?? el?.webkitRequestFullscreen?.bind(el);

    if (elReq) {
      Promise.resolve(elReq()).catch(() => {
        // div fullscreen reddedildi (iOS Safari) → video native fullscreen'e düş
        if (iosVideoFs) iosVideoFs();
      });
    } else if (iosVideoFs) {
      iosVideoFs();
    }
  };

  const onRowEnter = (i: number) => { if (!engaged) setActive(i); };
  const onRowClick = (i: number) => {
    setEngaged(true);
    setMuted(false);
    setActive(i);
    if (window.matchMedia("(max-width: 1080px)").matches) {
      stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const cur = scenes[active];

  return (
    <>
      <style>{`
        @keyframes altaris_blink   { 50% { opacity: 0; } }
        @keyframes altaris_shimmer { 0% { background-position: 0% 50%; } 100% { background-position: -200% 50%; } }
        @keyframes altaris_fade    { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ember_pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(240,140,80,0.55); }
          50%      { box-shadow: 0 0 0 10px rgba(240,140,80,0); }
        }
        .a-blink   { animation: altaris_blink 1.05s steps(1) infinite; }
        .a-shimmer {
          background-image: linear-gradient(110deg, #ffb464 0%, #f08c50 18%, #d97757 36%, #c15f3c 54%, #823c32 72%, #c15f3c 90%, #f08c50 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text; background-clip: text; color: transparent;
          animation: altaris_shimmer 14s linear infinite;
        }
        .a-grad {
          background-image: linear-gradient(110deg, #ffb464 0%, #f08c50 35%, #d97757 60%, #c15f3c 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .a-reveal   { opacity: 0; animation: altaris_fade 800ms cubic-bezier(.2,.7,.2,1) forwards; }
        .a-hairline { background-image: linear-gradient(to right, transparent, rgba(120,80,50,.45), transparent); }

        .row { position: relative; transition: background 360ms ease, padding-left 360ms ease; }
        .row::before {
          content: ''; position: absolute; left: 0; top: 0; bottom: 0;
          width: 2px; background: #f08c50;
          transform: scaleY(0); transform-origin: top;
          transition: transform 480ms cubic-bezier(.2,.7,.2,1);
        }
        .row:hover { background: rgba(240,140,80,0.035); padding-left: 18px; }
        .row:hover::before { transform: scaleY(1); }
        .row.is-active { background: rgba(240,140,80,0.06); padding-left: 22px; }
        .row.is-active::before { transform: scaleY(1); }
        .row__num { transition: color 360ms ease; }
        .row:hover .row__num,
        .row.is-active .row__num { color: #f08c50; }

        .pulse-dot { animation: ember_pulse 1.6s infinite; }

        /* Fullscreen — frame fills the whole viewport */
        .stage-frame:fullscreen,
        .stage-frame:-webkit-full-screen { width: 100vw; height: 100vh; aspect-ratio: auto; border-radius: 0; border: 0; }
        .stage-frame:fullscreen video,
        .stage-frame:-webkit-full-screen video { width: 100%; height: 100%; object-fit: contain; background: #000; }
      `}</style>

      <main className="relative min-h-screen overflow-x-hidden bg-[#0a0908] font-mono text-[#ddd8d0] antialiased">
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(240,140,80,0.10),transparent_70%)]" />
          <div className="absolute inset-x-0 top-0 h-px a-hairline" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_60%,rgba(0,0,0,0.55)_100%)]" />
        </div>

        {/* NAV */}
        <header className="border-b border-[rgba(120,80,50,0.22)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
            <Link
              href="/"
              className="group inline-flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-[#6b6358] transition-colors hover:text-[#ddd8d0]"
            >
              <span aria-hidden className="transition-transform group-hover:-translate-x-1">←</span>
              <span>{d.nav.altaris}</span>
              <span className="text-[#3a342d]">·</span>
              <span className="text-[#9b9285]">{d.nav.home}</span>
            </Link>
            <div className="flex items-center gap-5">
              <div className="hidden items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-[#6b6358] md:flex">
                <span aria-hidden className="size-1.5 rounded-full bg-[#f08c50] pulse-dot" />
                <span>{d.nav.scenes}</span>
                <span className="text-[#3a342d]">·</span>
                <span className="text-[#9b9285]">{d.scenes.chapter}</span>
              </div>
              <LocaleSwitcher current={locale} path="/senaryolar" />
            </div>
          </div>
        </header>

        {/* HERO */}
        <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-24">
          <div
            className="a-reveal flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]"
            style={{ animationDelay: "0ms" }}
          >
            <span>argus teknoloji</span>
            <span aria-hidden className="h-px w-10 bg-[#3a342d]" />
            <span>{d.nav.scenes} · katalog</span>
            <span aria-hidden className="h-px w-10 bg-[#3a342d]" />
            <span>2026</span>
          </div>

          <h1
            className="a-reveal mt-10 max-w-4xl text-[clamp(28px,4vw,52px)] font-light leading-[1.12] tracking-tight text-[#ddd8d0]"
            style={{ animationDelay: "260ms" }}
          >
            <span className="text-[#5a534a]">{"// "}</span>
            {d.scenes.pageTitleA}
            <span className="a-grad font-medium">{d.scenes.pageTitleGrad}</span>
            {d.scenes.pageTitleC}
          </h1>

          <p
            className="a-reveal mt-6 max-w-2xl text-sm leading-relaxed text-[#9b9285] md:text-base"
            style={{ animationDelay: "400ms" }}
          >
            {d.scenes.pageLede}
          </p>

          <div
            className="a-reveal mt-8 flex items-center gap-3 text-[9px] uppercase tracking-[0.32em] text-[#3a342d]"
            style={{ animationDelay: "540ms" }}
          >
            <KeyHint label="↑↓" desc={d.scenes.keyNav} />
            <KeyHint label="enter" desc={d.scenes.keyPlay} />
            <KeyHint label="m" desc={d.scenes.keySound} />
            <KeyHint label="f" desc={d.scenes.keyFs} />
          </div>
        </section>

        {/* SAHNELER GRID */}
        <section className="mx-auto max-w-6xl px-6 pb-28">
          <div className="mb-10 flex items-baseline justify-between border-b border-[rgba(120,80,50,0.22)] pb-4">
            <div className="flex items-baseline gap-4">
              <span className="text-[10px] uppercase tracking-[0.32em] text-[#3a342d]">/ 01</span>
              <h3 className="text-[10px] uppercase tracking-[0.32em] text-[#ddd8d0]">{d.scenes.sectionHead}</h3>
            </div>
            <span className="text-[10px] uppercase tracking-[0.28em] text-[#3a342d]">{d.scenes.livePreview}</span>
          </div>

          <div className="grid grid-cols-1 gap-x-10 gap-y-10 lg:grid-cols-[1.05fr_0.95fr]">

            {/* LEDGER */}
            <ol className="border-t border-[rgba(120,80,50,0.22)]">
              {scenes.map((s, i) => (
                <li
                  key={s.num}
                  className={`row grid cursor-pointer grid-cols-[64px_1fr_auto] items-start gap-5 border-b border-[rgba(120,80,50,0.22)] px-1.5 py-6 ${
                    active === i ? "is-active" : ""
                  }`}
                  onMouseEnter={() => onRowEnter(i)}
                  onClick={() => onRowClick(i)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRowClick(i); } }}
                  aria-label={`${s.num} — ${s.title}`}
                >
                  <span className="row__num pt-1 font-light leading-none tracking-tight text-[#3a342d] text-[28px] md:text-[32px]">
                    {s.num}
                  </span>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">
                      {s.meta.map((m, k) => (
                        <span key={`${s.num}-m-${k}`} className="flex items-center gap-2">
                          {k > 0 && <span className="text-[#3a342d]">·</span>}
                          <span>{m}</span>
                        </span>
                      ))}
                    </div>
                    <h4 className="mt-2 text-[clamp(20px,2.2vw,26px)] font-light leading-[1.15] tracking-tight text-[#ddd8d0]">
                      {s.title}
                    </h4>
                    <p className="mt-2 max-w-[58ch] text-[13px] italic leading-relaxed text-[#9b9285]">
                      {s.line}
                    </p>
                  </div>

                  <span
                    className={`hidden self-center whitespace-nowrap rounded-full border px-3 py-1.5 text-[9px] uppercase tracking-[0.26em] transition-all md:inline-flex ${
                      active === i
                        ? "border-[#f08c50] bg-[#f08c50] text-[#0a0908]"
                        : "border-[rgba(120,80,50,0.4)] text-[#7a7166]"
                    }`}
                  >
                    {active === i ? d.scenes.playing : d.scenes.watch}
                  </span>
                </li>
              ))}
            </ol>

            {/* STAGE */}
            <aside ref={stageRef} className="lg:relative">
              <div className="lg:sticky lg:top-6">
                <div
                  ref={frameRef}
                  className="stage-frame relative aspect-[16/10] overflow-hidden rounded-md border border-[rgba(120,80,50,0.32)] bg-[#0d0b0a] shadow-[0_60px_80px_-40px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.02)]"
                >
                  <video
                    ref={videoRef}
                    className="h-full w-full object-cover"
                    src={SRC_BY_NUM[scenes[0].num]}
                    muted
                    playsInline
                    preload="metadata"
                    autoPlay
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setActive((i) => (i + 1) % scenes.length)}
                    onTimeUpdate={(e) => {
                      const v = e.currentTarget;
                      if (v.duration) setProgress((v.currentTime / v.duration) * 100);
                    }}
                  />

                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(10,9,8,0.55)_0%,rgba(10,9,8,0)_22%,rgba(10,9,8,0)_60%,rgba(10,9,8,0.85)_100%)]"
                  />

                  {/* topbar */}
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 py-4 text-[10px] uppercase tracking-[0.22em] text-[#ddd8d0]">
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden className="size-1.5 rounded-full bg-[#f08c50] pulse-dot" />
                      <span>{d.scenes.nowPlaying}</span>
                    </span>
                    <span className="text-[#9b9285]">
                      <span className="text-[#ddd8d0]">{String(active + 1).padStart(2, "0")}</span>
                      <span className="text-[#3a342d]"> / {scenes.length}</span>
                    </span>
                  </div>

                  {/* bottombar */}
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-5 pb-5 pt-4">
                    <div className="flex items-start gap-3">
                      <span className="font-light leading-none text-[#f08c50] text-[28px] md:text-[34px]">
                        {cur.num}
                      </span>
                      <div>
                        <h5 className="text-base font-medium leading-[1.15] tracking-tight text-[#ddd8d0]">
                          {cur.title}
                        </h5>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[#9b9285]">
                          {cur.meta.join(" · ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CtlButton
                        label={muted ? "sound on" : "sound off"}
                        onClick={() => { setMuted((m) => !m); if (muted) setEngaged(true); }}
                      >
                        {muted ? "🔇" : "🔊"}
                      </CtlButton>
                      <CtlButton
                        label="prev"
                        onClick={() => setActive((i) => (i - 1 + scenes.length) % scenes.length)}
                      >‹</CtlButton>
                      <CtlButton
                        label={d.scenes.fallbackPause}
                        onClick={() => {
                          const v = videoRef.current; if (!v) return;
                          v.paused ? v.play() : v.pause();
                        }}
                      >{playing ? "❚❚" : "▶"}</CtlButton>
                      <CtlButton
                        label="next"
                        onClick={() => setActive((i) => (i + 1) % scenes.length)}
                      >›</CtlButton>
                      <CtlButton
                        label={d.scenes.fullscreen}
                        onClick={toggleFullscreen}
                      >{isFs ? "⤢" : "⛶"}</CtlButton>
                    </div>
                  </div>

                  {/* progress */}
                  <div className="absolute inset-x-0 bottom-0 h-[2px] bg-[rgba(237,230,214,0.08)]">
                    <span
                      className="block h-full bg-[#f08c50] transition-[width] duration-150"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* compact thumb strip */}
                <ol
                  className="mt-5 grid gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${scenes.length}, minmax(0, 1fr))` }}
                >
                  {scenes.map((s, i) => (
                    <li key={`thumb-${s.num}`}>
                      <button
                        onClick={() => onRowClick(i)}
                        onMouseEnter={() => onRowEnter(i)}
                        className={`flex h-9 w-full items-center justify-center rounded-sm border text-[10px] uppercase tracking-[0.18em] transition-colors ${
                          active === i
                            ? "border-[#f08c50] bg-[#f08c50] text-[#0a0908]"
                            : "border-[rgba(120,80,50,0.32)] bg-[#14110f] text-[#7a7166] hover:border-[#f08c50] hover:text-[#f08c50]"
                        }`}
                        aria-label={s.num}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-[rgba(120,80,50,0.22)]">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-6 py-20 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">{d.start.head}</div>
              <p className="mt-5 max-w-2xl text-[clamp(20px,2.4vw,30px)] font-light leading-[1.25] text-[#ddd8d0]">
                {/* small reuse of grad accent */}
                <span className="a-grad">{d.start.requestDemo}.</span>
              </p>
            </div>
            <a
              href="mailto:innovahub@argusteknoloji.com.tr"
              className="group inline-flex items-center gap-3 border border-[#f08c50] bg-[#f08c50] px-7 py-3.5 text-[11px] uppercase tracking-[0.3em] text-[#0a0908] transition-all duration-300 hover:bg-transparent hover:text-[#f08c50]"
            >
              <span>{d.start.requestDemo}</span>
              <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
            </a>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-[rgba(120,80,50,0.22)]">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-7 text-[10px] uppercase tracking-[0.28em] text-[#6b6358] md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <span className="text-[#ddd8d0]">altaris</span>
              <span className="text-[#3a342d]">·</span>
              <span>{d.nav.scenes}</span>
              <span className="text-[#3a342d]">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-1 rounded-full bg-[#f08c50] pulse-dot" />
                xvi
              </span>
            </div>
            <div>{d.footer.copy}</div>
          </div>
        </footer>
      </main>
    </>
  );
}

function CtlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-full border border-[rgba(120,80,50,0.4)] bg-[rgba(10,9,8,0.6)] text-[12px] text-[#ddd8d0] backdrop-blur-md transition-colors hover:border-[#f08c50] hover:text-[#f08c50]"
    >
      {children}
    </button>
  );
}

function KeyHint({ label, desc }: { label: string; desc: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="rounded-sm border border-[rgba(120,80,50,0.32)] bg-[#14110f] px-2 py-1 text-[#9b9285]">{label}</span>
      <span>{desc}</span>
      <span aria-hidden className="h-px w-6 bg-[#3a342d] last:hidden" />
    </span>
  );
}
