"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LocaleSwitcher } from "@/app/_components/LocaleSwitcher";
import type { Locale } from "@/lib/i18n";
import type { CliDict, CliLine, CliLineKind } from "@/lib/cli-content";

// ──────────────────────────────────────────────────────────────────────────
// Altaris CLI — cinematic showcase
//
// Four self-playing terminal scenes with a typewriter engine. Per-line kind
// drives the cadence: `cmd` and `answer` get char-by-char, `out`/`tool`/etc
// settle instantly with a per-kind dwell. A spinner replaces `wait` lines for
// a beat before they collapse into the trace.
//
// Header / nav matches the rest of the marketing surfaces; locale switcher
// reuses the shared form component.
// ──────────────────────────────────────────────────────────────────────────

const ALTARIS_ASCII = `█▀█   █    ▀█▀   █▀█   █▀▄   █   █▀▀
█▀█   █     █    █▀█   █▀▄   █   ▀▀█
▀ ▀   ▀▀▀   ▀    ▀ ▀   ▀ ▀   ▀   ▀▀▀`;

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// per-kind cadence
const CMD_CHAR_MS    = 55;
const ANSWER_CHAR_MS = 28;
const OUT_LINE_MS    = 130;
const HEAD_LINE_MS   = 180;
const TOOL_LINE_MS   = 380;
const BLANK_LINE_MS  = 90;
const WAIT_DWELL_MS  = 1400;
const SCENE_HOLD_MS  = 2400;
const TYPEWRITER_KINDS = new Set<CliLineKind>(["cmd", "answer"]);

export default function CliClient({
  d,
  locale,
}: {
  d: CliDict;
  locale: Locale;
}) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [revealed, setRevealed] = useState(0);     // how many lines have fully settled
  const [partial,  setPartial]  = useState("");    // current typewriter partial
  const [tick,     setTick]     = useState(0);     // for spinner
  const [auto,     setAuto]     = useState(true);
  const [copied,   setCopied]   = useState<string | null>(null);
  const termBodyRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scene = d.scenes[sceneIdx];
  const totalLines = scene.lines.length;
  const currentLine: CliLine | null =
    revealed < totalLines ? scene.lines[revealed] : null;

  // ─── spinner tick ───
  useEffect(() => {
    if (!auto) return;
    if (currentLine?.k !== "wait") return;
    const id = setInterval(() => setTick((t) => t + 1), 90);
    return () => clearInterval(id);
  }, [auto, currentLine?.k]);

  // ─── reveal engine ───
  useEffect(() => {
    if (!auto) {
      // pause → show full scene
      setPartial("");
      setRevealed(totalLines);
      return;
    }

    // scene complete → wait, then advance to next scene
    if (revealed >= totalLines) {
      timerRef.current = setTimeout(() => {
        setRevealed(0);
        setPartial("");
        setSceneIdx((i) => (i + 1) % d.scenes.length);
      }, SCENE_HOLD_MS);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }

    const line = scene.lines[revealed];

    // typewriter
    if (TYPEWRITER_KINDS.has(line.k)) {
      const speed = line.k === "cmd" ? CMD_CHAR_MS : ANSWER_CHAR_MS;
      if (partial.length < line.t.length) {
        timerRef.current = setTimeout(
          () => setPartial(line.t.slice(0, partial.length + 1)),
          speed,
        );
      } else {
        // settle
        timerRef.current = setTimeout(() => {
          setPartial("");
          setRevealed((r) => r + 1);
        }, line.k === "cmd" ? 220 : 80);
      }
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }

    // non-typewriter dwells
    let dwell: number;
    switch (line.k) {
      case "wait":  dwell = WAIT_DWELL_MS;  break;
      case "tool":  dwell = TOOL_LINE_MS;   break;
      case "head":  dwell = HEAD_LINE_MS;   break;
      case "blank": dwell = BLANK_LINE_MS;  break;
      default:      dwell = OUT_LINE_MS;
    }
    timerRef.current = setTimeout(() => setRevealed((r) => r + 1), dwell);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [auto, sceneIdx, revealed, partial, totalLines, scene.lines, d.scenes.length]);

  // ─── auto-scroll terminal body ───
  useEffect(() => {
    const el = termBodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [revealed, partial, sceneIdx]);

  // ─── manual scene chip ───
  const goScene = (i: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSceneIdx(i);
    setRevealed(0);
    setPartial("");
    setAuto(true);
  };

  const restart = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setRevealed(0);
    setPartial("");
    setAuto(true);
  };

  // ─── copy helpers ───
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1400);
    } catch {/* clipboard blocked — silent */}
  };

  const spinnerChar = useMemo(() => SPINNER[tick % SPINNER.length], [tick]);

  // ─────────────────────────────────────────────────────────────────────
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
        @keyframes line_in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scan {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
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
        .phos-grad {
          background-image: linear-gradient(110deg, #c1e69e 0%, #9bd07e 50%, #7aaf5d 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .a-reveal   { opacity: 0; animation: altaris_fade 800ms cubic-bezier(.2,.7,.2,1) forwards; }
        .a-hairline { background-image: linear-gradient(to right, transparent, rgba(120,80,50,.45), transparent); }
        .pulse-dot { animation: ember_pulse 1.6s infinite; }

        /* terminal frame — phosphor body, ember chrome */
        .term-frame {
          background:
            radial-gradient(1200px 300px at 50% -10%, rgba(155,208,126,0.05), transparent 70%),
            #07070a;
          box-shadow:
            inset 0 0 0 1px rgba(120,80,50,0.32),
            0 60px 80px -40px rgba(0,0,0,0.7),
            0 0 1px rgba(155,208,126,0.18),
            inset 0 0 80px rgba(155,208,126,0.025);
        }
        /* phosphor glow on terminal text */
        .term-body, .term-body * { font-family: ui-monospace, "SF Mono", "JetBrains Mono", "Fira Code", Menlo, monospace; }
        .term-body { color: #d8d4c8; text-shadow: 0 0 1px rgba(155,208,126,0.18); }
        .term-line { animation: line_in 240ms ease-out; }
        .term-cmd  { color: #ddd8d0; }
        .term-cmd  > .prompt { color: #9bd07e; margin-right: 8px; }
        .term-out  { color: #b8b0a0; }
        .term-head { color: #6b6358; font-style: italic; }
        .term-tool { color: #f08c50; }
        .term-tool > .pill { display:inline-block; padding:1px 8px; margin-right:10px; border:1px solid rgba(240,140,80,0.45); border-radius:999px; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #ffb464; }
        .term-answer { color: #9bd07e; }
        .term-wait { color: #f08c50; }
        .term-cursor {
          display: inline-block;
          width: 9px; height: 1.05em;
          margin-left: 2px;
          vertical-align: middle;
          background: #9bd07e;
          box-shadow: 0 0 8px rgba(155,208,126,0.55);
          animation: altaris_blink 1.05s steps(1) infinite;
        }

        /* light CRT scanlines + vignette */
        .crt::before {
          content: "";
          position: absolute; inset: 0;
          pointer-events: none;
          background-image: repeating-linear-gradient(
            to bottom,
            rgba(155,208,126,0.04) 0px,
            rgba(155,208,126,0.04) 1px,
            transparent 1px,
            transparent 3px
          );
          mix-blend-mode: screen;
        }
        .crt::after {
          content: "";
          position: absolute; inset: 0;
          pointer-events: none;
          background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%);
        }
        .scanbeam {
          position: absolute; left: 0; right: 0; height: 80px;
          background: linear-gradient(to bottom, transparent, rgba(155,208,126,0.06), transparent);
          mix-blend-mode: screen;
          pointer-events: none;
          animation: scan 7.5s linear infinite;
        }

        /* chip row */
        .chip { transition: all 320ms cubic-bezier(.2,.7,.2,1); }
        .chip-on  { background: #f08c50; color: #0a0908; border-color: #f08c50; }
        .chip-off { background: transparent; color: #9b9285; border-color: rgba(120,80,50,0.4); }
        .chip-off:hover { color: #f08c50; border-color: #f08c50; }

        /* progress dots */
        .pd { width: 24px; height: 2px; background: rgba(120,80,50,0.4); }
        .pd-on   { background: #f08c50; }
        .pd-done { background: #9bd07e; }
      `}</style>

      <main className="relative min-h-screen overflow-x-hidden bg-[#0a0908] font-mono text-[#ddd8d0] antialiased">
        {/* atmosphere */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(155,208,126,0.06),transparent_70%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_70%_30%,rgba(240,140,80,0.07),transparent_70%)]" />
          <div className="absolute inset-x-0 top-0 h-px a-hairline" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_60%,rgba(0,0,0,0.55)_100%)]" />
        </div>

        {/* nav */}
        <header className="border-b border-[rgba(120,80,50,0.22)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
            <Link
              href="/"
              className="group inline-flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-[#6b6358] transition-colors hover:text-[#ddd8d0]"
            >
              <span aria-hidden className="transition-transform group-hover:-translate-x-1">←</span>
              <span>altaris</span>
              <span className="text-[#3a342d]">·</span>
              <span className="text-[#9b9285]">{d.nav.back}</span>
            </Link>
            <div className="flex items-center gap-5">
              <div className="hidden items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-[#6b6358] md:flex">
                <span aria-hidden className="size-1.5 rounded-full bg-[#9bd07e] pulse-dot" />
                <span className="text-[#ddd8d0]">cli</span>
                <span className="text-[#3a342d]">·</span>
                <span>{d.nav.chapters}</span>
              </div>
              <LocaleSwitcher current={locale} path="/cli" />
            </div>
          </div>
        </header>

        {/* HERO */}
        <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-14 md:pt-20">
          <div className="a-reveal flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]" style={{ animationDelay: "0ms" }}>
            <span>{d.hero.eyebrow}</span>
          </div>

          <div className="mt-10 flex flex-col gap-3">
            <pre
              aria-label="Altaris"
              className="a-reveal a-shimmer select-none overflow-x-auto whitespace-pre font-bold leading-[1.05] tracking-[0.02em] text-[clamp(11px,1.7vw,18px)] md:text-[clamp(13px,1.9vw,22px)]"
              style={{ animationDelay: "120ms" }}
            >
{ALTARIS_ASCII}
            </pre>
            <div className="a-reveal flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]" style={{ animationDelay: "200ms" }}>
              <span aria-hidden className="h-px w-10 bg-[#3a342d]" />
              <span className="text-[#9bd07e]">cli</span>
              <span className="text-[#3a342d]">·</span>
              <span>command line interface</span>
            </div>
          </div>

          <h1
            className="a-reveal mt-10 max-w-4xl text-[clamp(30px,4.6vw,64px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]"
            style={{ animationDelay: "260ms" }}
          >
            <span className="text-[#5a534a]">{"// "}</span>
            {d.hero.titleA}
            <span className="a-grad font-medium">{d.hero.titleGrad}</span>
            {d.hero.titleB}
          </h1>

          <p className="a-reveal mt-6 max-w-2xl text-sm leading-relaxed text-[#9b9285] md:text-base" style={{ animationDelay: "400ms" }}>
            {d.hero.lede}
          </p>

          {/* 3 badges */}
          <div className="a-reveal mt-7 flex flex-wrap items-center gap-2.5" style={{ animationDelay: "540ms" }}>
            {[
              { txt: d.hero.badgeLocal,  c: "#9bd07e" },
              { txt: d.hero.badgeMulti,  c: "#f08c50" },
              { txt: d.hero.badgeAirgap, c: "#bdb4a6" },
            ].map((b) => (
              <span
                key={b.txt}
                className="inline-flex items-center gap-2 rounded-full border border-[rgba(120,80,50,0.4)] bg-[#14110f] px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-[#bdb4a6]"
              >
                <span aria-hidden className="size-1.5 rounded-full" style={{ background: b.c }} />
                {b.txt}
              </span>
            ))}
          </div>

          {/* one-liner copy strip */}
          <div className="a-reveal mt-10 flex max-w-3xl items-stretch overflow-hidden rounded-md border border-[rgba(120,80,50,0.32)] bg-[#14110f]" style={{ animationDelay: "680ms" }}>
            <span className="hidden items-center gap-2 border-r border-[rgba(120,80,50,0.28)] px-4 text-[10px] uppercase tracking-[0.28em] text-[#7a7166] sm:flex">
              <span aria-hidden className="text-[#f08c50]">▸</span>
              {d.install.oneliner.label}
            </span>
            <code className="flex-1 overflow-x-auto whitespace-nowrap px-4 py-3.5 text-sm text-[#ddd8d0]">
              <span className="text-[#9bd07e]">$</span>{" "}
              <span>{d.install.oneliner.cmd}</span>
            </code>
            <button
              type="button"
              onClick={() => copy("oneliner", d.install.oneliner.cmd)}
              className="border-l border-[rgba(120,80,50,0.28)] px-4 text-[10px] uppercase tracking-[0.28em] text-[#9b9285] transition-colors hover:bg-[#1a1612] hover:text-[#f08c50]"
            >
              {copied === "oneliner" ? d.install.copied : d.install.copy}
            </button>
          </div>
        </section>

        {/* SCENES */}
        <section className="mx-auto max-w-6xl px-6 pb-28">
          <div className="mb-7 flex items-baseline justify-between border-b border-[rgba(120,80,50,0.22)] pb-4">
            <div className="flex items-baseline gap-4">
              <span className="text-[10px] uppercase tracking-[0.32em] text-[#3a342d]">/ 01</span>
              <h3 className="text-[10px] uppercase tracking-[0.32em] text-[#ddd8d0]">{d.scenesHead}</h3>
            </div>
            <span className="text-[10px] uppercase tracking-[0.28em] text-[#3a342d]">{d.scenesHint}</span>
          </div>

          {/* chip row */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {d.scenes.map((s, i) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => goScene(i)}
                className={`chip ${i === sceneIdx ? "chip-on" : "chip-off"} flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.22em]`}
              >
                <span className="font-light tracking-[0.05em]">{s.num}</span>
                <span>{s.title}</span>
              </button>
            ))}
            <span aria-hidden className="hidden flex-1 sm:block" />
            <button
              type="button"
              onClick={() => setAuto((a) => !a)}
              className="rounded-full border border-[rgba(120,80,50,0.4)] px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-[#9b9285] transition-colors hover:border-[#9bd07e] hover:text-[#9bd07e]"
              aria-pressed={auto}
            >
              {auto ? d.nav.pause : d.nav.auto}
            </button>
            <button
              type="button"
              onClick={restart}
              className="rounded-full border border-[rgba(120,80,50,0.4)] px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-[#9b9285] transition-colors hover:border-[#f08c50] hover:text-[#f08c50]"
            >
              {d.nav.restart}
            </button>
          </div>

          {/* scene meta */}
          <div className="mb-3 flex flex-wrap items-baseline gap-3 text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">
            <span className="text-[#f08c50]">/{String(sceneIdx + 1).padStart(2, "0")}</span>
            <span className="text-[#ddd8d0]">{scene.title}</span>
            <span className="text-[#3a342d]">·</span>
            <span>{scene.meta}</span>
          </div>

          {/* TERMINAL FRAME */}
          <div className="term-frame crt relative overflow-hidden rounded-md">
            {/* window chrome */}
            <div className="flex items-center gap-3 border-b border-[rgba(120,80,50,0.32)] bg-[#0d0b0a] px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-full bg-[#ff5f56]" />
                <span aria-hidden className="size-2.5 rounded-full bg-[#ffbd2e]" />
                <span aria-hidden className="size-2.5 rounded-full bg-[#27c93f]" />
              </div>
              <span className="flex-1 text-center text-[10px] uppercase tracking-[0.28em] text-[#6b6358]">
                burak@argus  —  altaris  —  80×24
              </span>
              <div className="flex items-center gap-2">
                {d.scenes.map((_, i) => {
                  const cls = i === sceneIdx ? "pd-on" : i < sceneIdx ? "pd-done" : "";
                  return <span key={i} className={`pd ${cls}`} aria-hidden />;
                })}
              </div>
            </div>

            {/* body */}
            <div
              ref={termBodyRef}
              className="term-body relative max-h-[64vh] min-h-[420px] overflow-y-auto px-5 py-5 text-[13.5px] leading-[1.55] md:text-[14px]"
            >
              {/* settled lines */}
              {scene.lines.slice(0, revealed).map((line, i) => (
                <RenderedLine key={`${sceneIdx}-${i}`} line={line} spinner={null} />
              ))}

              {/* current typewriter / wait line */}
              {currentLine && (
                <RenderedLine
                  key={`${sceneIdx}-cur`}
                  line={currentLine}
                  spinner={currentLine.k === "wait" ? spinnerChar : null}
                  partial={
                    TYPEWRITER_KINDS.has(currentLine.k) ? partial : currentLine.t
                  }
                  showCursor={TYPEWRITER_KINDS.has(currentLine.k) || currentLine.k === "wait"}
                />
              )}

              {/* idle blinking prompt at the very end of a scene */}
              {!currentLine && (
                <div className="term-line term-cmd">
                  <span className="prompt">$</span>
                  <span className="term-cursor align-middle" />
                </div>
              )}
            </div>

            {/* moving phosphor scanbeam */}
            <span aria-hidden className="scanbeam" />
          </div>
        </section>

        {/* COMMANDS TABLE */}
        <section className="mx-auto max-w-6xl px-6 pb-28">
          <div className="mb-7 flex items-baseline justify-between border-b border-[rgba(120,80,50,0.22)] pb-4">
            <div className="flex items-baseline gap-4">
              <span className="text-[10px] uppercase tracking-[0.32em] text-[#3a342d]">/ 02</span>
              <h3 className="text-[10px] uppercase tracking-[0.32em] text-[#ddd8d0]">{d.commands.head}</h3>
            </div>
            <span className="text-[10px] uppercase tracking-[0.28em] text-[#3a342d]">{d.commands.hint}</span>
          </div>

          <div className="overflow-hidden rounded-md border border-[rgba(120,80,50,0.22)]">
            <div className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,2fr)] border-b border-[rgba(120,80,50,0.22)] bg-[#0d0b0a] px-5 py-3 text-[10px] uppercase tracking-[0.28em] text-[#6b6358]">
              <span>{d.commands.col.cmd}</span>
              <span>{d.commands.col.what}</span>
            </div>
            <ul>
              {d.commands.rows.map(([cmd, what], i) => (
                <li
                  key={cmd}
                  className={`grid grid-cols-1 gap-2 px-5 py-4 transition-colors hover:bg-[#100d0b] sm:grid-cols-[minmax(0,0.85fr)_minmax(0,2fr)] sm:gap-6 ${
                    i < d.commands.rows.length - 1 ? "border-b border-[rgba(120,80,50,0.18)]" : ""
                  }`}
                >
                  <code className="text-[13px] text-[#ffb464]">{cmd}</code>
                  <span className="text-[13px] leading-relaxed text-[#bdb4a6]">{what}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* PROVIDER MATRIX */}
        <section className="border-y border-[rgba(120,80,50,0.22)] bg-[#0d0b0a]">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="mb-7 flex items-baseline justify-between border-b border-[rgba(120,80,50,0.18)] pb-4">
              <div className="flex items-baseline gap-4">
                <span className="text-[10px] uppercase tracking-[0.32em] text-[#3a342d]">/ 03</span>
                <h3 className="text-[10px] uppercase tracking-[0.32em] text-[#ddd8d0]">{d.providers.head}</h3>
              </div>
              <span className="text-[10px] uppercase tracking-[0.28em] text-[#3a342d]">{d.providers.hint}</span>
            </div>

            <div className="grid gap-px overflow-hidden rounded-md border border-[rgba(120,80,50,0.22)] bg-[rgba(120,80,50,0.22)] md:grid-cols-2">
              {d.providers.rows.map((p) => (
                <div key={p.name} className="bg-[#0a0908] p-6">
                  <div className="flex items-baseline justify-between">
                    <h4 className="text-lg font-medium tracking-tight text-[#ddd8d0]">{p.name}</h4>
                    <span
                      className={`text-[10px] uppercase tracking-[0.22em] ${
                        p.mode.toLowerCase().startsWith("lokal") || p.mode.toLowerCase() === "local"
                          ? "text-[#9bd07e]"
                          : p.mode.toLowerCase().includes("abon") || p.mode.toLowerCase().includes("subscription")
                            ? "text-[#bdb4a6]"
                            : "text-[#f08c50]"
                      }`}
                    >
                      [{p.mode}]
                    </span>
                  </div>
                  <code className="mt-3 block overflow-x-auto whitespace-nowrap text-[12.5px] text-[#9b9285]">
                    {p.example}
                  </code>
                  {p.tag && (
                    <span className="mt-3 inline-block rounded-sm border border-[rgba(155,208,126,0.4)] bg-[#0d100a] px-2 py-0.5 text-[9px] uppercase tracking-[0.22em] text-[#9bd07e]">
                      {p.tag}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-6 max-w-3xl text-[12px] leading-relaxed text-[#7a7166]">{d.providers.note}</p>
          </div>
        </section>

        {/* INSTALL */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-7 flex items-baseline justify-between border-b border-[rgba(120,80,50,0.22)] pb-4">
            <div className="flex items-baseline gap-4">
              <span className="text-[10px] uppercase tracking-[0.32em] text-[#3a342d]">/ 04</span>
              <h3 className="text-[10px] uppercase tracking-[0.32em] text-[#ddd8d0]">{d.install.head}</h3>
            </div>
            <span className="text-[10px] uppercase tracking-[0.28em] text-[#3a342d]">{d.install.hint}</span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {(["mac","linux","win"] as const).map((k) => {
              const t = d.install.targets[k];
              const Glyph = k === "mac" ? "" : k === "linux" ? "" : "";
              const flag =
                k === "mac"   ? { ring: "rgba(240,140,80,0.4)",  word: "macOS" } :
                k === "linux" ? { ring: "rgba(155,208,126,0.4)", word: "Linux" } :
                                { ring: "rgba(189,180,166,0.4)", word: "Windows" };
              return (
                <div
                  key={k}
                  className="flex flex-col rounded-md border bg-[#0d0b0a] p-6 transition-colors hover:bg-[#100d0b]"
                  style={{ borderColor: flag.ring }}
                >
                  <div className="flex items-baseline justify-between">
                    <h4 className="text-base font-medium tracking-tight text-[#ddd8d0]">{t.os}</h4>
                    <span className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">{t.arch}</span>
                  </div>
                  <code className="mt-4 block break-all rounded-sm bg-[#14110f] p-3 text-[12px] text-[#bdb4a6]">{t.cmd}</code>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.22em] text-[#6b6358]">{t.size}</span>
                    <button
                      type="button"
                      onClick={() => copy(`bin-${k}`, t.cmd)}
                      className="text-[10px] uppercase tracking-[0.28em] text-[#9b9285] transition-colors hover:text-[#f08c50]"
                    >
                      {copied === `bin-${k}` ? d.install.copied : d.install.copy}
                      <span aria-hidden> ↗</span>
                    </button>
                  </div>
                  {Glyph && <span className="sr-only">{Glyph}</span>}
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-[11px] uppercase tracking-[0.22em] text-[#7a7166]">
            <span aria-hidden className="mr-2 inline-block size-1.5 translate-y-[-1px] rounded-full bg-[#9bd07e] align-middle" />
            {d.install.sigNote}
          </p>
        </section>

        {/* CTA */}
        <section className="border-t border-[rgba(120,80,50,0.22)]">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-6 py-20 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">{d.cta.eyebrow}</div>
              <h2 className="mt-5 max-w-2xl whitespace-pre-line text-[clamp(28px,4vw,52px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
                {d.cta.titleA}
                <span className="a-grad font-medium">{d.cta.titleGrad}</span>
                {d.cta.titleB}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="mailto:innovahub@argusteknoloji.com.tr"
                className="group inline-flex items-center gap-3 border border-[#f08c50] bg-[#f08c50] px-7 py-3.5 text-[11px] uppercase tracking-[0.3em] text-[#0a0908] transition-all duration-300 hover:bg-transparent hover:text-[#f08c50]"
              >
                <span>{d.cta.primary}</span>
                <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
              </a>
              <a
                href="#"
                className="group inline-flex items-center gap-3 border border-[rgba(120,80,50,0.4)] px-7 py-3.5 text-[11px] uppercase tracking-[0.3em] text-[#9b9285] transition-all duration-300 hover:border-[#9bd07e] hover:text-[#9bd07e]"
              >
                <span>{d.cta.secondary}</span>
                <span aria-hidden className="transition-transform group-hover:translate-x-1">↓</span>
              </a>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-[rgba(120,80,50,0.22)]">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-7 text-[10px] uppercase tracking-[0.28em] text-[#6b6358] md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <span className="text-[#ddd8d0]">altaris cli</span>
              <span className="text-[#3a342d]">·</span>
              <span>v0.1.0-alpha</span>
              <span className="text-[#3a342d]">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-1 rounded-full bg-[#9bd07e] pulse-dot" />
                live
              </span>
            </div>
            <div>{d.footer.copy}</div>
          </div>
        </footer>
      </main>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// LINE RENDERER
// ──────────────────────────────────────────────────────────────────────────

function RenderedLine({
  line,
  spinner,
  partial,
  showCursor = false,
}: {
  line: CliLine;
  spinner: string | null;
  partial?: string;
  showCursor?: boolean;
}) {
  const text = partial !== undefined ? partial : line.t;

  if (line.k === "blank") return <div className="h-[0.85em]" aria-hidden />;

  if (line.k === "cmd") {
    return (
      <div className="term-line term-cmd">
        <span className="prompt">$</span>
        <span>{text}</span>
        {showCursor && <span className="term-cursor" />}
      </div>
    );
  }
  if (line.k === "head") {
    return <div className="term-line term-head">{text}</div>;
  }
  if (line.k === "out") {
    return <div className="term-line term-out whitespace-pre">{text}</div>;
  }
  if (line.k === "tool") {
    return (
      <div className="term-line term-tool whitespace-pre">
        <span className="pill">tool</span>
        <span>{text}</span>
      </div>
    );
  }
  if (line.k === "wait") {
    return (
      <div className="term-line term-wait">
        <span aria-hidden className="mr-2">{spinner ?? "⠋"}</span>
        <span className="italic text-[#bdb4a6]">{text}</span>
      </div>
    );
  }
  // answer
  return (
    <div className="term-line term-answer whitespace-pre">
      {text}
      {showCursor && <span className="term-cursor" />}
    </div>
  );
}
