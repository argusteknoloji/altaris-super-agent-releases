// ──────────────────────────────────────────────────────────────────
// Generic stage wrapper — atmosphere, top/bottom UI chrome, scene CSS.
// Server component. Tüm senaryolar bunu sarar; sadece `scenes` ve
// `accent` rengini özelleştirirler.
// ──────────────────────────────────────────────────────────────────

import * as React from "react";

interface Props {
  /** Scene 1..6 timing tablosu. Her satır [delaySec, durationSec]. */
  sceneTimings: ReadonlyArray<readonly [number, number]>;
  /** Senaryo başlığı (top bar'da görünür, kayıtta gizli). */
  topLabel: string;
  /** Bottom timeline label'ları (6 madde). */
  timeline: ReadonlyArray<string>;
  /** Accent gradient renk override (default sunset). */
  accentColors?: { from: string; via: string; to: string };
  /** Ekstra CSS keyframes (senaryoya özel animasyonlar). */
  extraCss?: string;
  /** Sahne içerikleri — sırayla 6 child. */
  children: React.ReactNode;
}

export function SenaryoStage({
  sceneTimings,
  topLabel,
  timeline,
  accentColors,
  extraCss,
  children,
}: Props) {
  const accent = accentColors ?? { from: "#ffb464", via: "#d97757", to: "#c15f3c" };

  // Her sahne için CSS animation rule üret
  const sceneRules = sceneTimings
    .map(
      ([delay, dur], i) =>
        `html[data-play="1"] .s${i + 1} { animation: scene-life ${dur}s ${delay}s ease-out forwards; }`,
    )
    .join("\n        ");

  return (
    <>
      <style>{`
        @keyframes scene-life {
          0%, 100% { opacity: 0; transform: translateY(10px); }
          6%, 92%  { opacity: 1; transform: translateY(0); }
        }
        .grad-text {
          background-image: linear-gradient(110deg,${accent.from} 0%,${accent.via} 50%,${accent.to} 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .grad-shimmer {
          background-image: linear-gradient(110deg,${accent.from},${accent.via},${accent.to},${accent.via},${accent.from});
          background-size: 200% 100%;
          -webkit-background-clip: text; background-clip: text; color: transparent;
          animation: shim 14s linear infinite;
        }
        @keyframes shim { 0% { background-position: 0% 50%; } 100% { background-position: -200% 50%; } }
        .hairline { background: linear-gradient(to right, transparent, rgba(120,80,50,.55), transparent); }

        .scene { position: absolute; inset: 0; opacity: 0; pointer-events: none; }
        .scene > .stage { width: 100%; height: 100%; display: grid; place-items: center; padding: 6vw; }

        ${sceneRules}
        /* Base opacity:0 zaten .scene class'ında — animation forwards ile
           override olur. */
        html[data-recording="1"] .ui-chrome { opacity: 0 !important; pointer-events: none !important; }

        /* iOS Safari fullscreen API div'ler için sınırlı; pseudo-fullscreen
           fallback — body'yi viewport'a kilitle, tarayıcı chrome'u görsel
           olarak gizle (gerçekten kapatamayız ama z-index ile üzerini ört). */
        html[data-pseudo-fullscreen="1"] {
          height: 100% !important;
          overflow: hidden !important;
        }
        html[data-pseudo-fullscreen="1"] body {
          position: fixed; inset: 0;
          width: 100vw; height: 100vh; height: 100dvh;
          overflow: hidden;
          margin: 0;
        }
        html[data-pseudo-fullscreen="1"] main {
          position: fixed; inset: 0;
          width: 100vw; height: 100vh; height: 100dvh;
          z-index: 9999;
        }
        ${extraCss ?? ""}
      `}</style>

      <main className="relative h-screen w-screen overflow-hidden bg-[#0a0908] font-mono text-[#ddd8d0] antialiased">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(ellipse 60% 50% at 50% 0%, ${accent.via}1a, transparent 70%)`,
            }}
          />
          <div className="absolute inset-x-0 top-0 h-px hairline" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_70%,rgba(0,0,0,0.55)_100%)]" />
        </div>

        <div className="ui-chrome absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-8 py-4 text-[10px] uppercase tracking-[0.32em] text-[#6b6358] transition-opacity duration-300">
          <span>{topLabel}</span>
          <span>22 sn</span>
        </div>

        <div className="ui-chrome absolute bottom-6 left-1/2 z-10 -translate-x-1/2 transition-opacity duration-300">
          <div className="flex items-center gap-3 text-[9px] uppercase tracking-[0.32em] text-[#3a342d]">
            {timeline.map((s, i) => (
              <span key={s + i} className="flex items-center gap-3">
                {i > 0 && <span aria-hidden className="h-px w-6 bg-[#3a342d]" />}
                <span>{s}</span>
              </span>
            ))}
          </div>
        </div>

        {children}
      </main>
    </>
  );
}
