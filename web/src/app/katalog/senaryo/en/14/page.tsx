"use client";

// ─────────────────────────────────────────────────────────────────
// Scenario 14 — "Twenty-Four Hours" (Legal) — ENGLISH VERSION
// Senior counsel, 22:14 · 3,000 pages of testimony · 09:00 hearing.
// Case law search + precedent + risk map + draft defense.
// ─────────────────────────────────────────────────────────────────

import { SenaryoPlayer, type ScheduleFn } from "../../_lib/SenaryoPlayer";
import { SenaryoStage } from "../../_lib/SenaryoStage";
import { bell, gain, heartbeat, lfo, masterEnv, NOTES, osc, pad } from "../../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0,3],[3,3],[6,3],[9,6],[15,3],[18,4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.F2, NOTES.C4, NOTES.F4], [
    [0, 0], [2, 0.024], [9, 0.022], [14, 0.027], [17, 0.034], [20, 0.022], [21.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.15, 0.005, TOTAL, t0);
  [1.8, 3.8, 5.8, 7.8, 9.8, 11.8, 13.8, 15.6, 17.4, 19.4, 20.8].forEach((t, i) => {
    heartbeat(ctx, master, t0 + t, i % 3 === 0 ? 0.24 : 0.14);
  });
  bell(ctx, master, t0 + 0.4, NOTES.F4, 0.10, 2.4);
  bell(ctx, master, t0 + 1.2, NOTES.C4, 0.08, 2.0);
  bell(ctx, master, t0 + 3.2, NOTES.F4, 0.10, 1.6);
  bell(ctx, master, t0 + 4.0, NOTES.A4, 0.08, 1.4);
  bell(ctx, master, t0 + 4.8, NOTES.C5, 0.08, 1.4);
  [6.2, 6.6, 7.0, 7.4, 7.8].forEach((t) => {
    bell(ctx, master, t0 + t, NOTES.G5 + Math.random() * 30, 0.05, 0.4);
  });
  bell(ctx, master, t0 + 8.6, NOTES.F4, 0.10, 1.4);
  [
    [9.5, NOTES.F4],
    [10.7, NOTES.A4],
    [11.9, NOTES.C5],
    [13.1, NOTES.F4 * 2],
  ].forEach(([t, f]) => {
    bell(ctx, master, t0 + (t as number), f as number, 0.11, 1.6);
  });
  bell(ctx, master, t0 + 15.4, NOTES.F4, 0.10, 1.4);
  bell(ctx, master, t0 + 16.2, NOTES.C5, 0.10, 1.4);
  [NOTES.F4, NOTES.A4, NOTES.C5, NOTES.F4 * 2].forEach((f, i) => {
    bell(ctx, master, t0 + 18.2 + i * 0.26, f, 0.13, 1.8);
  });
  const finalOsc = osc(ctx, NOTES.F2, "sine");
  const finalG = gain(ctx, 0);
  finalOsc.connect(finalG).connect(master);
  finalG.gain.setValueAtTime(0, t0 + 18);
  finalG.gain.linearRampToValueAtTime(0.05, t0 + 18.4);
  finalG.gain.linearRampToValueAtTime(0.04, t0 + 21);
  finalG.gain.exponentialRampToValueAtTime(0.0001, t0 + 22);
  finalOsc.start(t0 + 18);
  finalOsc.stop(t0 + 22.1);
};

export default function Senaryo14EnPage() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus + altaris legal · scenario 14 · twenty-four hours"
      timeline={["the file", "question", "altaris", "risk map", "time", "legal intelligence"]}
      accentColors={{ from: "#c98090", via: "#8a4858", to: "#5a2838" }}
    >
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ senior counsel · 22:14 · 09:00 hearing tomorrow</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
              Three thousand pages of testimony.<br />
              <span className="text-[#7a7166]">Eleven hours left.</span>
            </h1>
            <div className="mt-12 grid grid-cols-2 gap-4 max-w-xl">
              <div className="rounded-md border border-[rgba(201,128,144,0.45)] bg-[#100808]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#c98090]">file size</div>
                <div className="mt-1 text-sm text-[#ddd8d0]">3,182 pages · 47 documents</div>
              </div>
              <div className="rounded-md border border-[rgba(201,128,144,0.45)] bg-[#100808]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#c98090]">opposing counsel</div>
                <div className="mt-1 text-sm text-[#ddd8d0]">filed 3 new precedents</div>
              </div>
            </div>
            <p className="mt-8 max-w-xl text-sm leading-relaxed text-[#9b9285]">
              Supreme Court rulings · case files · case-law database · contract archive —
              <span className="text-[#ddd8d0]"> humans can't scan this fast alone</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="scene s2">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <h2 className="text-[clamp(32px,5vw,72px)] font-light leading-[1.15] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">"</span>
              Which precedent helps us?<br />
              <span className="grad-text font-medium">What does opposing counsel rely on</span>?
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-10 text-base text-[#7a7166]">
              Precedent · doctrine · procedural objection · factual divergence —
              <span className="text-[#ddd8d0]"> all of it placed next to the case file</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="scene s3">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">
              <span aria-hidden className="size-1.5 rounded-full bg-[#c98090] animate-pulse" />
              <span>altaris legal · case-law search</span>
              <span className="text-[#3a342d]">·</span>
              <span>court records bridged</span>
            </div>
            <div className="rounded-md border border-[rgba(201,128,144,0.5)] bg-[#100808] p-6">
              <p className="text-base text-[#ddd8d0] font-mono">
                <span className="text-[#c98090]">▸</span> altaris case-analysis
                <span className="text-[#7a7166]"> --file=2026/3742</span>
                <span className="text-[#7a7166]"> --search-precedent</span>
                <span className="text-[#7a7166]"> --risk-map</span>
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">
                <span>3,182 pages indexing</span>
                <span>supreme court 2018-2026</span>
                <span>articles cross-referenced</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-6 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#c98090]">/ risk map · precedent matching</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">2026 / 3742 · commercial dispute</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                {
                  num: "01",
                  label: "4 favorable precedents",
                  metric: "strong",
                  detail: "11th Civ. 2024/14782 · similar facts, ruled for plaintiff. Plus: 23rd Civ. 2023/9117, 11th Civ. 2022/8456, 13th Civ. 2021/4521.",
                  src: ["Court", "Case law", "Doctrine"],
                  color: "green",
                },
                {
                  num: "02",
                  label: "Opponent's footing",
                  metric: "weak",
                  detail: "Of the 3 precedents they filed, 2 cite a different contract type (Code of Obligations 138, not 18). One was struck down by the Constitutional Court.",
                  src: ["Brief", "Constitutional", "Norm review"],
                  color: "warm",
                },
                {
                  num: "03",
                  label: "Procedural objection",
                  metric: "low risk",
                  detail: "4 of plaintiff's exhibits were filed past the deadline. CCP §145 motion to exclude has high success odds.",
                  src: ["Code", "Deadlines", "Evidence"],
                  color: "soft",
                },
                {
                  num: "04",
                  label: "Factual divergence",
                  metric: "critical",
                  detail: "Article 7 of the contract is not as opposing counsel claims — the original copy and their filed version differ in paragraph 2.",
                  src: ["Contract", "Versioning", "Expert"],
                  color: "warm",
                },
              ].map((r) => (
                <div key={r.num} className="relative rounded-md border border-[rgba(201,128,144,0.45)] bg-[#100808] p-4">
                  <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-[#c98090]" />
                  <div className="flex items-start justify-between">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-[#c98090]">/{r.num}</div>
                    <div className={`text-base font-medium ${r.color === "green" ? "text-[#9fd89f]" : r.color === "warm" ? "text-[#ffae6e]" : "text-[#c98090]"}`}>{r.metric}</div>
                  </div>
                  <h4 className="mt-3 text-base font-medium text-[#ddd8d0]">{r.label}</h4>
                  <p className="mt-2 text-[12px] leading-relaxed text-[#bdb4a6]">{r.detail}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[rgba(120,80,50,0.25)] pt-2">
                    {r.src.map((s) => (
                      <span key={s} className="rounded-sm border border-[rgba(201,128,144,0.4)] bg-[#180c10] px-2 py-0.5 text-[9px] uppercase tracking-[0.22em] text-[#9b9285]">{s}</span>
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
          <div className="text-center max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ bar-registered, runs locally, stays in the vault</div>
            <h2 className="mt-8 text-[clamp(36px,5.5vw,80px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              <span className="text-[#7a7166]">Three thousand pages</span> →
              <span className="grad-text font-medium"> eighteen minutes</span>
            </h2>
            <p className="mt-8 text-base text-[#bdb4a6]">
              Precedent matched · risk weighed · defense draft on the table.
              <br />Without the client file ever leaving the vault.
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
            <div className="mt-3 text-[11px] uppercase tracking-[0.32em] text-[#c98090]">
              + altaris legal · court records + case-law database integrated
            </div>
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">
              attorney-client privilege intact · data never leaves the vault
            </div>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#c98090] bg-[#c98090] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ pilot</span>
              <span className="font-medium">demo · innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-14-twenty-four-hours" label="scenario 14 · twenty-four hours" />
    </SenaryoStage>
  );
}
