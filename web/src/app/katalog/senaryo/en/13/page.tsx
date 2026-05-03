"use client";

// ─────────────────────────────────────────────────────────────────
// Scenario 13 — "Line Down" (Manufacturing/OEE) — ENGLISH VERSION
// Production manager · 14:23 · OEE dropped to 72%.
// MES + SCADA + ERP + QC — four systems, minutes of data drift.
// Altaris: Pareto + root cause in 90 seconds.
// ─────────────────────────────────────────────────────────────────

import { SenaryoPlayer, type ScheduleFn } from "../../_lib/SenaryoPlayer";
import { SenaryoStage } from "../../_lib/SenaryoStage";
import { bell, gain, heartbeat, lfo, masterEnv, NOTES, osc, pad } from "../../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0,3],[3,3],[6,3],[9,6],[15,3],[18,4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.D3, NOTES.A3, NOTES.D4], [
    [0, 0], [2, 0.026], [9, 0.024], [14, 0.030], [17, 0.036], [20, 0.022], [21.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.3, 0.008, TOTAL, t0);
  const kicks = [0.7, 1.4, 2.1, 2.8, 3.5, 4.2, 4.9, 5.6, 6.3, 7.0, 7.7, 8.4, 9.1,
                 10.0, 11.0, 12.0, 13.0, 14.0,
                 15.0, 15.7, 16.4,
                 17.5, 18.5, 19.5, 20.5];
  kicks.forEach((t, i) => {
    heartbeat(ctx, master, t0 + t, i % 7 === 0 ? 0.30 : 0.18);
  });
  bell(ctx, master, t0 + 0.4, NOTES.A4, 0.14, 1.6);
  bell(ctx, master, t0 + 0.7, NOTES.F4, 0.10, 1.4);
  bell(ctx, master, t0 + 1.4, NOTES.D4, 0.10, 1.2);
  bell(ctx, master, t0 + 3.2, NOTES.F4, 0.10, 1.4);
  bell(ctx, master, t0 + 3.8, NOTES.D4, 0.10, 1.4);
  bell(ctx, master, t0 + 4.6, NOTES.A3, 0.09, 1.4);
  [6.2, 6.5, 6.8, 7.1, 7.4, 7.7, 8.0].forEach((t) => {
    bell(ctx, master, t0 + t, NOTES.A5 + Math.random() * 40, 0.05, 0.4);
  });
  bell(ctx, master, t0 + 8.6, NOTES.D5, 0.10, 1.3);
  [
    [9.5, NOTES.D4],
    [10.8, NOTES.F4],
    [12.1, NOTES.A4],
  ].forEach(([t, f]) => {
    bell(ctx, master, t0 + (t as number), f as number, 0.13, 1.4);
  });
  [13.5, 13.8, 14.1].forEach((t, i) => {
    bell(ctx, master, t0 + t, [NOTES.D4, NOTES.F4, NOTES.A4][i], 0.08, 1.0);
  });
  [15.0, 15.4, 15.8, 16.2, 16.6].forEach((t) => {
    bell(ctx, master, t0 + t, NOTES.A5, 0.07, 0.5);
  });
  [NOTES.D4, NOTES["F#4"], NOTES.A4, NOTES.D5].forEach((f, i) => {
    bell(ctx, master, t0 + 18.2 + i * 0.26, f, 0.13, 1.7);
  });
  const finalOsc = osc(ctx, NOTES.D3, "triangle");
  const finalG = gain(ctx, 0);
  finalOsc.connect(finalG).connect(master);
  finalG.gain.setValueAtTime(0, t0 + 18);
  finalG.gain.linearRampToValueAtTime(0.05, t0 + 18.4);
  finalG.gain.linearRampToValueAtTime(0.04, t0 + 21);
  finalG.gain.exponentialRampToValueAtTime(0.0001, t0 + 22);
  finalOsc.start(t0 + 18);
  finalOsc.stop(t0 + 22.1);
};

export default function Senaryo13EnPage() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus + altaris industry · scenario 13 · line down"
      timeline={["alarm", "question", "altaris", "root cause", "time", "industry 4.0"]}
      accentColors={{ from: "#a0b0d8", via: "#7080a8", to: "#404870" }}
    >
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ production · line 03 · 14:23</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
              <span className="text-[#ff8060]">⚠</span> OEE dropped.<br />
              <span className="text-[#7a7166]">84% → 72%</span>
            </h1>
            <div className="mt-12 grid grid-cols-3 gap-3 max-w-2xl">
              <div className="rounded-md border border-[rgba(160,176,216,0.45)] bg-[#0a0c10]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a0b0d8]">availability</div>
                <div className="mt-1 text-[12px] text-[#ddd8d0]">88% — normal</div>
              </div>
              <div className="rounded-md border border-[rgba(255,140,80,0.45)] bg-[#1a0d08]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#ffae6e]">performance</div>
                <div className="mt-1 text-[12px] text-[#ffae6e]">79% ↓ critical</div>
              </div>
              <div className="rounded-md border border-[rgba(255,140,80,0.45)] bg-[#1a0d08]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#ffae6e]">quality</div>
                <div className="mt-1 text-[12px] text-[#ffae6e]">92% ↓ rework rising</div>
              </div>
            </div>
            <p className="mt-8 max-w-xl text-sm leading-relaxed text-[#9b9285]">
              MES · SCADA · ERP · QC —
              <span className="text-[#ddd8d0]"> four separate systems, minute-level drift</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="scene s2">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <h2 className="text-[clamp(32px,5vw,72px)] font-light leading-[1.15] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">"</span>
              Which shift, which batch,<br />
              <span className="grad-text font-medium">which parameter</span>?
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-10 text-base text-[#7a7166]">
              Shift logs · batch traceability · temperature curve · operator notes —
              <span className="text-[#ddd8d0]"> humans can't correlate this alone</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="scene s3">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">
              <span aria-hidden className="size-1.5 rounded-full bg-[#a0b0d8] animate-pulse" />
              <span>altaris industry · OEE analysis</span>
              <span className="text-[#3a342d]">·</span>
              <span>MES-bridged</span>
            </div>
            <div className="rounded-md border border-[rgba(160,176,216,0.5)] bg-[#0a0c10] p-6">
              <p className="text-base text-[#ddd8d0] font-mono">
                <span className="text-[#a0b0d8]">▸</span> altaris line-analysis
                <span className="text-[#7a7166]"> --line=03</span>
                <span className="text-[#7a7166]"> --window=4h</span>
                <span className="text-[#7a7166]"> --pareto</span>
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">
                <span>shift × batch</span>
                <span>scada params</span>
                <span>QC defects</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-6 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#a0b0d8]">/ pareto · root causes of the OEE drop</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">last 4h · 12.4k units</div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  num: "01",
                  label: "Temperature drift",
                  metric: "47%",
                  detail: "Press-04 jaw temp 184°C → 196°C. Setpoint band breached at 11:50.",
                  src: ["SCADA", "Trend log", "Setpoint"],
                },
                {
                  num: "02",
                  label: "Lot 7821 raw material",
                  metric: "32%",
                  detail: "New supplier batch — viscosity +8%. Parameter compatibility with prior lot not tested.",
                  src: ["ERP", "QA intake", "Supplier"],
                },
                {
                  num: "03",
                  label: "Shift handover",
                  metric: "17%",
                  detail: "B shift has 2 operators with incomplete training. Reset procedure delayed.",
                  src: ["MES", "Training", "Shift"],
                },
              ].map((r) => (
                <div key={r.num} className="relative rounded-md border border-[rgba(160,176,216,0.45)] bg-[#0a0c10] p-4">
                  <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-[#a0b0d8]" />
                  <div className="flex items-start justify-between">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-[#a0b0d8]">/{r.num}</div>
                    <div className="text-base font-medium text-[#a0b0d8]">{r.metric}</div>
                  </div>
                  <h4 className="mt-3 text-base font-medium text-[#ddd8d0]">{r.label}</h4>
                  <p className="mt-2 text-[12px] leading-relaxed text-[#bdb4a6]">{r.detail}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[rgba(120,80,50,0.25)] pt-2">
                    {r.src.map((s) => (
                      <span key={s} className="rounded-sm border border-[rgba(160,176,216,0.4)] bg-[#0a1018] px-2 py-0.5 text-[9px] uppercase tracking-[0.22em] text-[#9b9285]">{s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-[rgba(160,176,216,0.45)] bg-[#0a0c10] p-4">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#a0b0d8]">recommendation · act now</div>
                <p className="mt-2 text-[12px] leading-relaxed text-[#ddd8d0]">Lower Press-04 setpoint to 188°C · separate Lot 7821 batches and re-run QA · trigger the reset checklist on shift handover.</p>
              </div>
              <div className="rounded-md border border-[rgba(159,216,159,0.45)] bg-[#0a100c] p-4">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#9fd89f]">expected recovery</div>
                <div className="mt-2 text-2xl font-light text-[#9fd89f]">OEE 72% → 86%</div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#bdb4a6]">Within two hours if all three actions land together. Hourly value loss approx ₺94k.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s5">
        <div className="stage">
          <div className="text-center max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ data on the floor · decision with the shift lead</div>
            <h2 className="mt-8 text-[clamp(36px,5.5vw,80px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              <span className="text-[#7a7166]">Four systems</span> →
              <span className="grad-text font-medium"> ninety seconds</span>
            </h2>
            <p className="mt-8 text-base text-[#bdb4a6]">
              Temperature · batch · shift — correlated, ranked, recommended.
              <br />Root cause documented before the line stopped.
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
            <div className="mt-3 text-[11px] uppercase tracking-[0.32em] text-[#a0b0d8]">
              + altaris industry · MES + SCADA bridge
            </div>
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">
              industry 4.0 · data on the floor · decisions in seconds not minutes
            </div>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#a0b0d8] bg-[#a0b0d8] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ pilot</span>
              <span className="font-medium">demo · innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-13-line-down" label="scenario 13 · line down" />
    </SenaryoStage>
  );
}
