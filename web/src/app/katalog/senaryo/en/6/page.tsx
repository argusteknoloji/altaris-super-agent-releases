"use client";

// Scenario 06 — "Before Signing" — ENGLISH VERSION

import { SenaryoPlayer, type ScheduleFn } from "../../_lib/SenaryoPlayer";
import { SenaryoStage } from "../../_lib/SenaryoStage";
import { bell, heartbeat, lfo, masterEnv, NOTES, pad, sweep } from "../../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0,3],[3,3],[6,3],[9,6],[15,3],[18,4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.E3, NOTES.B3, NOTES.E4], [
    [0, 0], [2, 0.022], [9, 0.020], [14, 0.026], [17, 0.024], [21.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.12, 0.005, TOTAL, t0);
  [1.5, 3.5, 5.5, 7.5, 9.0, 11.0, 13.0, 15.5, 17.8, 20.0].forEach((t, i) => {
    heartbeat(ctx, master, t0 + t, [3, 7].includes(i) ? 0.28 : 0.20);
  });
  bell(ctx, master, t0 + 0.4, NOTES.E5, 0.08, 1.6);
  sweep(ctx, master, t0 + 7, 2.2, 300, 1500, 0.07, 5);
  bell(ctx, master, t0 + 9.05, NOTES.E5, 0.13, 1.6);
  [9.5, 11.0, 12.5].forEach((t, i) => bell(ctx, master, t0 + t, [NOTES.E5, NOTES.G5, NOTES["F#5"]][i], 0.085, 1.0));
  [NOTES.E4, NOTES.G4, NOTES.B3, NOTES.E5].forEach((f, i) => bell(ctx, master, t0 + 15.4 + i*0.18, f, 0.10, 1.0));
  [NOTES.E4, NOTES.G4, NOTES.B3, NOTES.E5].forEach((f, i) => bell(ctx, master, t0 + 18.2 + i*0.26, f, 0.13, 1.7));
};

export default function Senaryo6EnPage() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus teknoloji · scenario 06 · before signing"
      timeline={["contract", "question", "scan", "3 risks", "time", "signature"]}
    >
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ ceo's desk · final check before signing</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
              28-page contract.<br />
              <span className="text-[#7a7166]">Risk · hidden · buried.</span>
            </h1>
            <p className="mt-12 max-w-xl text-sm leading-relaxed text-[#9b9285]">
              Legal read it. Finance read it. But cross-checking against every past lawsuit,
              regulation change, and similar contract — <span className="text-[#ddd8d0]">impossible</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="scene s2">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <h2 className="text-[clamp(36px,5.5vw,80px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">"</span>
              Did I miss<br />
              a <span className="grad-text font-medium">hidden risk</span>?
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-10 text-base text-[#7a7166]">Impossible to spot by eye — <span className="text-[#ddd8d0]">200+ similar contracts</span> over 5 years.</p>
          </div>
        </div>
      </section>

      <section className="scene s3">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">altaris · contract scan</div>
            <div className="rounded-md border border-[rgba(120,80,50,0.32)] bg-[#0d0b0a] p-6">
              <p className="text-base text-[#ddd8d0]">
                <span className="text-[#f08c50]">▸</span> Clause-by-clause cross-reference started
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
                {["compare against past lawsuits", "regulation changes", "similar-contract archive", "competitor terms"].map((d) => (
                  <div key={d} className="rounded border border-[rgba(120,80,50,0.32)] bg-[#1a1612] px-3 py-2 text-[#bdb4a6]">
                    <span className="text-[#9bd07e]">✓</span> {d}
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
            <div className="mb-6 text-[11px] uppercase tracking-[0.32em] text-[#ffa0a0]">⚠ 3 risks flagged</div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  num: "01",
                  metric: "Clause 7.4",
                  title: "Regulation conflict",
                  detail: "Clashes with new Tax Code Article 56. Takes effect in January.",
                  src: ["Regulation", "Legal archive"],
                },
                {
                  num: "02",
                  metric: "Clause 14.2",
                  title: "Past dispute",
                  detail: "Same firm, similar clause, ₺4.2M loss case in 2023.",
                  src: ["Case archive", "CRM"],
                },
                {
                  num: "03",
                  metric: "Clause 23",
                  title: "Asymmetric penalty",
                  detail: "Penalty applies to you only. Counterparty has none. Outside the norm.",
                  src: ["200+ contracts", "Benchmark"],
                },
              ].map((r) => (
                <div key={r.num} className="relative rounded-md border border-[rgba(255,160,160,0.4)] bg-[#0d0b0a] p-4">
                  <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-[#ffa0a0]" />
                  <div className="flex items-start justify-between">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-[#ffa0a0]">/{r.num}</div>
                    <div className="text-[10px] font-medium text-[#ffa0a0]">{r.metric}</div>
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
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ classic legal review</div>
            <div className="mt-6 flex items-center justify-center gap-8">
              <div className="text-[clamp(56px,8vw,128px)] font-light leading-none text-[#7a7166] line-through decoration-[#7a7166]/40">3 days</div>
              <div className="text-[#f08c50]">→</div>
              <div className="text-[clamp(72px,11vw,160px)] font-light leading-none">
                <span className="grad-text font-medium">12 sec</span>
              </div>
            </div>
            <p className="mt-8 text-base text-[#bdb4a6]">A <span className="text-[#ddd8d0]">guaranteed last check</span> before the signature.</p>
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
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">superagent — no hidden risk before you sign</div>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#f08c50] bg-[#f08c50] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ legal scan</span>
              <span className="font-medium">demo · innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-06-signing" label="scenario 06 · before signing" />
    </SenaryoStage>
  );
}
