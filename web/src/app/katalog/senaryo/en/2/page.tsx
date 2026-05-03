"use client";

// Scenario 02 — "Night Crisis" — ENGLISH VERSION

import { SenaryoPlayer, type ScheduleFn } from "../../_lib/SenaryoPlayer";
import { SenaryoStage } from "../../_lib/SenaryoStage";
import { bell, gain, heartbeat, lfo, masterEnv, NOTES, osc, pad, sweep } from "../../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0, 3], [3, 3], [6, 3], [9, 6], [15, 3], [18, 4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.55, totalDur: TOTAL, holdUntilSec: 21, fadeOutSec: 1 });
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.D3, NOTES.F3, NOTES.A3], [
    [0, 0], [2, 0.026], [9, 0.022], [13, 0.030], [17, 0.04], [20, 0.024], [21.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.3, 0.008, TOTAL, t0);
  const heart: Array<[number, number]> = [
    [0.4, 0.32], [1.0, 0.28], [1.6, 0.28], [2.2, 0.28],
    [3.4, 0.24], [4.4, 0.22], [5.4, 0.22],
    [6.6, 0.22], [7.6, 0.22], [8.5, 0.30],
    [9.2, 0.34], [10.2, 0.22], [11.2, 0.22], [12.5, 0.22],
    [15.2, 0.26], [16.4, 0.20],
    [17.8, 0.32], [20.0, 0.18],
  ];
  heart.forEach(([t, p]) => heartbeat(ctx, master, t0 + t, p));
  for (let i = 0; i < 4; i++) {
    const at = t0 + 0.3 + i * 0.55;
    const o = osc(ctx, 880, "square");
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 2200;
    const g = gain(ctx, 0);
    o.connect(f).connect(g).connect(master);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.045, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
    o.start(at);
    o.stop(at + 0.2);
  }
  sweep(ctx, master, t0 + 7, 2.2, 200, 1800, 0.10, 4);
  bell(ctx, master, t0 + 9.05, NOTES.A4, 0.14, 1.6);
  bell(ctx, master, t0 + 9.5,  NOTES.A4, 0.1,  1.0);
  bell(ctx, master, t0 + 11.0, NOTES.C5, 0.1,  1.0);
  bell(ctx, master, t0 + 12.5, NOTES.D5, 0.1,  1.0);
  [NOTES.A4, NOTES.C5, NOTES.D5, NOTES.A5].forEach((freq, i) => {
    bell(ctx, master, t0 + 15.4 + i * 0.18, freq, 0.10, 1.0);
  });
  [NOTES.F4, NOTES.A4, NOTES.C5, NOTES.F4 * 2].forEach((freq, i) => {
    bell(ctx, master, t0 + 18.2 + i * 0.26, freq, 0.13, 1.7);
  });
};

export default function Senaryo2EnPage() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus teknoloji · scenario 02 · night crisis"
      timeline={["alarm", "question", "altaris", "root cause", "time", "morning"]}
    >
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ 02:30 · before dawn</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
              The phone is ringing.<br />
              <span className="text-[#7a7166]">The line is down.</span>
            </h1>
            <div className="mt-12 grid grid-cols-2 gap-4 max-w-xl">
              {[
                ["scada", "Line 3 — total stop"],
                ["mes", "OEE 0% · 47 min"],
                ["telegram", "Shift lead: 12 messages"],
                ["email", "Customer Q complaint queued"],
              ].map(([s, t]) => (
                <div key={t} className="rounded-md border border-[rgba(255,90,90,0.4)] bg-[#1a0808]/85 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#ff7a7a]">{s}</div>
                  <div className="mt-1 text-sm text-[#ddd8d0]">{t}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="scene s2">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ ceo's first thought</div>
            <h2 className="mt-6 text-[clamp(36px,5.5vw,80px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">"</span>
              What's the <span className="grad-text font-medium">cause</span>?
              Can we <span className="grad-text font-medium">fix it by morning</span>?
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-10 text-base text-[#7a7166]">
              SCADA, MES, shift plan, supply schedule — <span className="text-[#ddd8d0]">all in different systems</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="scene s3">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">
              <span aria-hidden className="size-1.5 rounded-full bg-[#9bd07e] animate-pulse" />
              <span>altaris superagent</span>
              <span className="text-[#3a342d]">·</span>
              <span>overnight monitoring</span>
            </div>
            <div className="rounded-md border border-[rgba(155,208,126,0.5)] bg-[#0d1209] p-6">
              <div className="text-[10px] uppercase tracking-[0.28em] text-[#9bd07e]">/ proactive brief — prepared while you slept</div>
              <p className="mt-3 text-base leading-relaxed text-[#ddd8d0]">
                Critical anomaly detected 3 minutes ago.
                Cause tree built, 3 corrective actions ranked.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
                {[
                  ["₺1.7M", "live loss"],
                  ["3 customers", "affected"],
                  ["73%", "fix-by-morning odds"],
                ].map(([v, l]) => (
                  <div key={l} className="border-l border-[rgba(155,208,126,0.4)] pl-3">
                    <div className="text-base font-medium text-[#9bd07e]">{v}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-6 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#9bd07e]">/ root cause tree</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">3 causes · ranked</div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  num: "01",
                  metric: "Sensor #14",
                  title: "Calibration drift",
                  detail: "Avg 4% drift over the last 72h. Last service 91 days ago.",
                  src: ["MES", "Maintenance", "IoT"],
                },
                {
                  num: "02",
                  metric: "Shift handover",
                  title: "23:00 understaffed",
                  detail: "2 engineers on leave. Junior alone. Training gap.",
                  src: ["HR", "Shift", "Training"],
                },
                {
                  num: "03",
                  metric: "Supplier P",
                  title: "Raw material batch drift",
                  detail: "New batch 0.8% under tolerance. QC report unanswered.",
                  src: ["Supply", "QC", "ERP"],
                },
              ].map((r) => (
                <div key={r.num} className="relative rounded-md border border-[rgba(255,140,80,0.4)] bg-[#0d0b0a] p-4">
                  <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-[#f08c50]" />
                  <div className="flex items-start justify-between">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-[#f08c50]">/{r.num}</div>
                    <div className="text-base font-medium text-[#ffb464]">{r.metric}</div>
                  </div>
                  <h4 className="mt-3 text-base font-medium text-[#ddd8d0]">{r.title}</h4>
                  <p className="mt-2 text-[12px] leading-relaxed text-[#bdb4a6]">{r.detail}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[rgba(120,80,50,0.25)] pt-2">
                    {r.src.map((s) => (
                      <span key={s} className="rounded-sm border border-[rgba(120,80,50,0.4)] bg-[#1a1612] px-2 py-0.5 text-[9px] uppercase tracking-[0.22em] text-[#9b9285]">{s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="scene s5">
        <div className="stage">
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ classic flow · overnight info gathering</div>
            <div className="mt-6 flex items-center justify-center gap-8">
              <div className="text-[clamp(56px,8vw,128px)] font-light leading-none text-[#7a7166] line-through decoration-[#7a7166]/40">2 h</div>
              <div className="text-[#f08c50]">→</div>
              <div className="text-[clamp(72px,11vw,160px)] font-light leading-none">
                <span className="grad-text font-medium">3 min</span>
              </div>
            </div>
            <p className="mt-8 text-base text-[#bdb4a6]">
              Done while you slept. <span className="text-[#ddd8d0]">Brief on your desk by morning.</span>
            </p>
          </div>
        </div>
      </section>

      <section className="scene s6">
        <div className="stage">
          <div className="w-full max-w-4xl text-center">
            <pre aria-label="Altaris" className="grad-shimmer mx-auto select-none whitespace-pre font-bold leading-[1.05] tracking-[0.02em] text-[clamp(13px,1.8vw,22px)]">
{`█▀█   █    ▀█▀   █▀█   █▀▄   █   █▀▀
█▀█   █     █    █▀█   █▀▄   █   ▀▀█
▀ ▀   ▀▀▀   ▀    ▀ ▀   ▀ ▀   ▀   ▀▀▀`}
            </pre>
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">
              superagent — guards you through the night
            </div>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#f08c50] bg-[#f08c50] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ 24×7 monitoring</span>
              <span className="font-medium">demo · innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-02-night" label="scenario 02 · night crisis" />
    </SenaryoStage>
  );
}
