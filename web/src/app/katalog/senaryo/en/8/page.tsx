"use client";

// Scenario 08 — "Q4 Target" — ENGLISH VERSION

import { SenaryoPlayer, type ScheduleFn } from "../../_lib/SenaryoPlayer";
import { SenaryoStage } from "../../_lib/SenaryoStage";
import { bell, gain, heartbeat, masterEnv, NOTES, osc, pad, sweep } from "../../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0,3],[3,3],[6,3],[9,6],[15,3],[18,4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });
  pad(ctx, master, t0, TOTAL, [NOTES.D3, NOTES.A3], [
    [0, 0], [2, 0.020], [9, 0.018], [14, 0.024], [17, 0.030], [21.6, 0],
  ]);
  for (let i = 0; i < 36; i++) {
    const at = t0 + i * 0.6;
    if (at > t0 + TOTAL - 1) break;
    heartbeat(ctx, master, at, 0.16, 100, 40, 0.18);
  }
  heartbeat(ctx, master, t0 + 9.0, 0.32);
  heartbeat(ctx, master, t0 + 15.2, 0.26);
  heartbeat(ctx, master, t0 + 17.8, 0.32);
  [0.4, 6.2, 9.05, 15.3].forEach((t, i) => {
    const o = osc(ctx, [NOTES.A4, NOTES.D5, NOTES.A5, NOTES.D5][i], "triangle");
    const g = gain(ctx, 0);
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 1500;
    o.connect(f).connect(g).connect(master);
    const at = t0 + t;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.06, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);
    o.start(at);
    o.stop(at + 0.8);
  });
  sweep(ctx, master, t0 + 7, 2.2, 200, 1500, 0.07, 4);
  [9.5, 11.0, 12.5].forEach((t, i) => bell(ctx, master, t0 + t, [NOTES.A4, NOTES.D5, NOTES["F#5"]][i], 0.085, 1.0));
  [NOTES.D4, NOTES["F#4"], NOTES.A4, NOTES.D5].forEach((f, i) => bell(ctx, master, t0 + 15.4 + i*0.18, f, 0.10, 1.0));
  [NOTES.D4, NOTES["F#4"], NOTES.A4, NOTES.D5].forEach((f, i) => bell(ctx, master, t0 + 18.2 + i*0.26, f, 0.13, 1.7));
};

export default function Senaryo8EnPage() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus teknoloji · scenario 08 · q4 target"
      timeline={["factory", "question", "altaris", "bottleneck", "time", "act"]}
    >
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ production board · mid-october</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
              Q4 targets.<br />
              <span className="text-[#7a7166]">8 weeks to December.</span>
            </h1>
            <div className="mt-12 grid grid-cols-3 gap-4 max-w-2xl">
              {[["12.4M", "unit target"], ["87%", "capacity"], ["3", "suppliers"]].map(([v, l]) => (
                <div key={l} className="rounded-md border border-[rgba(120,80,50,0.4)] bg-[#0d0b0a]/85 px-3 py-3">
                  <div className="text-2xl font-light text-[#ddd8d0]">{v}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="scene s2">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <h2 className="text-[clamp(36px,5.5vw,80px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">"</span>
              Will Q4 targets<br />
              <span className="grad-text font-medium">land?</span>
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-10 text-base text-[#7a7166]">ERP, supply, capacity, orders, logistics — <span className="text-[#ddd8d0]">impossible to see at a glance</span>.</p>
          </div>
        </div>
      </section>

      <section className="scene s3">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">altaris · cross-forecast</div>
            <div className="rounded-md border border-[rgba(120,80,50,0.32)] bg-[#0d0b0a] p-6">
              <p className="text-base text-[#ddd8d0]">
                <span className="text-[#f08c50]">▸</span> 47 variables · 18-month history · 5-scenario simulation
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-6 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#9bd07e]">/ forecast</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">3 causes · ranked</div>
            </div>
            <div className="text-center mb-6">
              <div className="text-[10px] uppercase tracking-[0.28em] text-[#7a7166]">probability of hitting target</div>
              <div className="mt-2 text-[clamp(60px,8vw,120px)] font-light leading-none">
                <span className="grad-text font-medium">73%</span>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["Supplier P · bottleneck", "Raw material 4 weeks late · alternative: domestic source", "32%"],
                ["Line 2 · capacity", "Maintenance scheduled mid-Q4 · need to shift", "21%"],
                ["Logistics · port", "Export traffic peaks · early booking", "18%"],
              ].map(([t, d, p]) => (
                <div key={t} className="rounded-md border border-[rgba(255,140,80,0.4)] bg-[#0d0b0a] p-4">
                  <div className="flex items-start justify-between">
                    <div className="text-sm font-medium text-[#ddd8d0]">{t}</div>
                    <div className="text-base font-light text-[#ffb464]">{p}</div>
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-[#bdb4a6]">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="scene s5">
        <div className="stage">
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ classic forecasting · team meetings</div>
            <div className="mt-6 flex items-center justify-center gap-8">
              <div className="text-[clamp(56px,8vw,128px)] font-light leading-none text-[#7a7166] line-through decoration-[#7a7166]/40">2 weeks</div>
              <div className="text-[#f08c50]">→</div>
              <div className="text-[clamp(72px,11vw,160px)] font-light leading-none">
                <span className="grad-text font-medium">90 sec</span>
              </div>
            </div>
            <p className="mt-8 text-base text-[#bdb4a6]">Act now — <span className="text-[#ddd8d0]">target lands in December</span>.</p>
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
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">superagent — live production forecasting</div>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#f08c50] bg-[#f08c50] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ production forecast</span>
              <span className="font-medium">demo · innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-08-q4" label="scenario 08 · q4 target" />
    </SenaryoStage>
  );
}
