"use client";

// Scenario 11 — "Green Border" (CBAM/ESG) — ENGLISH VERSION

import { SenaryoPlayer, type ScheduleFn } from "../../_lib/SenaryoPlayer";
import { SenaryoStage } from "../../_lib/SenaryoStage";
import { bell, gain, heartbeat, lfo, masterEnv, NOTES, osc, pad } from "../../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0,3],[3,3],[6,3],[9,6],[15,3],[18,4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.E3, NOTES.B3, NOTES.E4], [
    [0, 0], [2, 0.024], [9, 0.022], [14, 0.026], [17, 0.034], [20, 0.022], [21.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.18, 0.006, TOTAL, t0);
  const wbuf = ctx.createBuffer(1, ctx.sampleRate * (TOTAL + 0.3), ctx.sampleRate);
  const wd = wbuf.getChannelData(0);
  for (let i = 0; i < wd.length; i++) wd[i] = (Math.random() * 2 - 1) * 0.4;
  const wsrc = ctx.createBufferSource();
  wsrc.buffer = wbuf;
  const wf = ctx.createBiquadFilter();
  wf.type = "lowpass";
  wf.frequency.value = 600;
  wf.Q.value = 1.2;
  const wg = gain(ctx, 0);
  wsrc.connect(wf).connect(wg).connect(master);
  wg.gain.setValueAtTime(0, t0);
  wg.gain.linearRampToValueAtTime(0.022, t0 + 2);
  wg.gain.linearRampToValueAtTime(0.018, t0 + 9);
  wg.gain.linearRampToValueAtTime(0.026, t0 + 17);
  wg.gain.linearRampToValueAtTime(0, t0 + 21.5);
  wsrc.start(t0);
  wsrc.stop(t0 + TOTAL + 0.2);
  wf.frequency.setValueAtTime(500, t0);
  wf.frequency.linearRampToValueAtTime(900, t0 + 9);
  wf.frequency.linearRampToValueAtTime(1400, t0 + 17);
  [1.5, 4.5, 7.5, 9.0, 12.0, 15.0, 18.0, 20.5].forEach((t, i) => {
    heartbeat(ctx, master, t0 + t, [3, 6].includes(i) ? 0.30 : 0.18);
  });
  bell(ctx, master, t0 + 0.4, NOTES.E5, 0.10, 1.8);
  bell(ctx, master, t0 + 6.2, NOTES.B3, 0.10, 1.6);
  bell(ctx, master, t0 + 9.05, NOTES.E5, 0.13, 1.8);
  bell(ctx, master, t0 + 9.5,  NOTES.E4, 0.085, 1.2);
  bell(ctx, master, t0 + 11.0, NOTES.G4, 0.085, 1.2);
  bell(ctx, master, t0 + 12.5, NOTES.B3 * 2, 0.085, 1.2);
  [NOTES.E4, NOTES["F#4"], NOTES.B3 * 2, NOTES.E5].forEach((f, i) => {
    bell(ctx, master, t0 + 15.4 + i * 0.18, f, 0.10, 1.0);
  });
  [NOTES.E4, NOTES["F#4"] + 30, NOTES.B3 * 2, NOTES.E5].forEach((f, i) => {
    bell(ctx, master, t0 + 18.2 + i * 0.26, f, 0.13, 1.7);
  });
  const finalOsc = osc(ctx, NOTES.E3, "sine");
  const finalG = gain(ctx, 0);
  finalOsc.connect(finalG).connect(master);
  finalG.gain.setValueAtTime(0, t0 + 18);
  finalG.gain.linearRampToValueAtTime(0.05, t0 + 18.4);
  finalG.gain.linearRampToValueAtTime(0.04, t0 + 21);
  finalG.gain.exponentialRampToValueAtTime(0.0001, t0 + 22);
  finalOsc.start(t0 + 18);
  finalOsc.stop(t0 + 22.1);
};

export default function Senaryo11EnPage() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus + carbon-labs · scenario 11 · green border"
      timeline={["cbam", "question", "data layer", "scope 1·2·3", "premium", "exports"]}
      accentColors={{ from: "#a8d895", via: "#6fb573", to: "#3a8060" }}
    >
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ production director · 2026 q4</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
              CBAM is live.<br />
              <span className="text-[#7a7166]">EU carbon border tariff.</span>
            </h1>
            <div className="mt-12 grid grid-cols-2 gap-4 max-w-xl">
              <div className="rounded-md border border-[rgba(168,216,149,0.45)] bg-[#0d0e0a]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8d895]">EU market</div>
                <div className="mt-1 text-sm text-[#ddd8d0]">38% of our exports go to EU</div>
              </div>
              <div className="rounded-md border border-[rgba(168,216,149,0.45)] bg-[#0d0e0a]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a8d895]">carbon tariff</div>
                <div className="mt-1 text-sm text-[#ddd8d0]">€85+/ton and rising</div>
              </div>
            </div>
            <p className="mt-8 max-w-xl text-sm leading-relaxed text-[#9b9285]">
              Our carbon footprint · water usage · energy intensity —
              <span className="text-[#ddd8d0]"> all in different reports, all late</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="scene s2">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <h2 className="text-[clamp(32px,5vw,72px)] font-light leading-[1.15] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">"</span>
              How much carbon did we emit this year?<br />
              <span className="grad-text font-medium">What's the impact on EU exports</span>?
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-10 text-base text-[#7a7166]">
              Scope 1, 2, 3 · energy · logistics · supply chain · water footprint —
              <span className="text-[#ddd8d0]"> impossible to see in one table</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="scene s3">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">
              <span aria-hidden className="size-1.5 rounded-full bg-[#a8d895] animate-pulse" />
              <span>carbon-labs · green data</span>
              <span className="text-[#3a342d]">·</span>
              <span>green data layer</span>
            </div>
            <div className="rounded-md border border-[rgba(168,216,149,0.5)] bg-[#0d0e0a] p-6">
              <p className="text-base text-[#ddd8d0]">
                <span className="text-[#a8d895]">▸</span> Plant data · ERP · IoT energy meters · logistics
                · water dashboard · supplier carbon reports
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">
                <span>scope 1 — direct</span>
                <span>scope 2 — energy</span>
                <span>scope 3 — value chain</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-6 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#a8d895]">/ carbon + water · single table</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">2026 q1-q3 cumulative</div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  num: "01",
                  label: "Scope 1 · direct emissions",
                  metric: "12.4 kt CO₂e",
                  detail: "Natural gas · process heating · onsite vehicle fleet. 18% reduction recorded YoY.",
                  src: ["IoT", "ERP", "Fleet"],
                },
                {
                  num: "02",
                  label: "Scope 2 · purchased energy",
                  metric: "8.7 kt CO₂e",
                  detail: "Grid electricity. Renewable share 22%. Solar PPA potential adds 14% more reduction.",
                  src: ["EPDK", "Meter", "PPA"],
                },
                {
                  num: "03",
                  label: "Scope 3 · value chain",
                  metric: "31.8 kt CO₂e",
                  detail: "Suppliers · logistics · product use · end-of-life. Suppliers carry the largest share.",
                  src: ["Supplier", "Logistics", "LCA"],
                },
              ].map((r) => (
                <div key={r.num} className="relative rounded-md border border-[rgba(168,216,149,0.45)] bg-[#0d0e0a] p-4">
                  <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-[#a8d895]" />
                  <div className="flex items-start justify-between">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-[#a8d895]">/{r.num}</div>
                    <div className="text-base font-medium text-[#a8d895]">{r.metric}</div>
                  </div>
                  <h4 className="mt-3 text-base font-medium text-[#ddd8d0]">{r.label}</h4>
                  <p className="mt-2 text-[12px] leading-relaxed text-[#bdb4a6]">{r.detail}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[rgba(120,80,50,0.25)] pt-2">
                    {r.src.map((s) => (
                      <span key={s} className="rounded-sm border border-[rgba(168,216,149,0.4)] bg-[#0d1209] px-2 py-0.5 text-[9px] uppercase tracking-[0.22em] text-[#9b9285]">{s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-[rgba(168,216,149,0.45)] bg-[#0d0e0a] p-4">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#a8d895]">water footprint</div>
                <div className="mt-2 text-2xl font-light text-[#ddd8d0]">2.34M m³</div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#bdb4a6]">Fresh water · process · cooling · cleaning. Recovery potential 31%.</p>
              </div>
              <div className="rounded-md border border-[rgba(168,216,149,0.45)] bg-[#0d0e0a] p-4">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#a8d895]">cbam impact</div>
                <div className="mt-2 text-2xl font-light text-[#ddd8d0]">€2.7M / yr</div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#bdb4a6]">Extra carbon tariff on EU exports at current carbon intensity.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s5">
        <div className="stage">
          <div className="text-center max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ tariff to premium · ref: bagfas €7.2m green premium</div>
            <h2 className="mt-8 text-[clamp(36px,5.5vw,80px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              <span className="text-[#7a7166]">Carbon burden</span> →
              <span className="grad-text font-medium"> green premium</span>
            </h2>
            <p className="mt-8 text-base text-[#bdb4a6]">
              Right measurement + certification = <span className="text-[#ddd8d0]">€/ton advantage</span> in EU markets.
              <br />Carbon is managed by data, not intuition.
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
            <div className="mt-3 text-[11px] uppercase tracking-[0.32em] text-[#a8d895]">
              + carbon-labs partnership
            </div>
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">
              carbon · water · energy — what gets measured gets managed
            </div>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#a8d895] bg-[#a8d895] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ green data</span>
              <span className="font-medium">demo · innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-11-green-border" label="scenario 11 · green border" />
    </SenaryoStage>
  );
}
