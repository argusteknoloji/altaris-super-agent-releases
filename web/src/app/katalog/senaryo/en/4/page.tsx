"use client";

// Scenario 04 — "First Day" — ENGLISH VERSION

import { SenaryoPlayer, type ScheduleFn } from "../../_lib/SenaryoPlayer";
import { SenaryoStage } from "../../_lib/SenaryoStage";
import { bell, heartbeat, lfo, masterEnv, NOTES, pad } from "../../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0,3],[3,3],[6,3],[9,6],[15,3],[18,4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.C5/2, NOTES.E5/2, NOTES.G5/2], [
    [0, 0], [2, 0.022], [9, 0.020], [14, 0.026], [17, 0.030], [20, 0.020], [21.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.2, 0.006, TOTAL, t0);
  [1.2, 3.2, 5.4, 7.4, 9.2, 11.5, 13.5, 15.8, 18.0, 20.2].forEach((t) => heartbeat(ctx, master, t0 + t, 0.18));
  bell(ctx, master, t0 + 0.3, NOTES.C5, 0.10, 1.6);
  bell(ctx, master, t0 + 6.2, NOTES.E5, 0.12, 1.8);
  [9.2, 9.5, 9.8].forEach((t, i) => bell(ctx, master, t0 + t, [NOTES.C5, NOTES.E5, NOTES.G5][i], 0.10, 1.4));
  [10.8, 12.0, 13.2].forEach((t, i) => bell(ctx, master, t0 + t, [NOTES.G5, NOTES.E5, NOTES.C5*2][i], 0.085, 1.0));
  [NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C5*2].forEach((f, i) => bell(ctx, master, t0 + 15.4 + i*0.18, f, 0.10, 1.0));
  [NOTES.C5/2, NOTES.E5/2, NOTES.G5/2, NOTES.C5].forEach((f, i) => bell(ctx, master, t0 + 18.2 + i*0.26, f, 0.13, 1.7));
};

export default function Senaryo4EnPage() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus teknoloji · scenario 04 · first day"
      timeline={["09:00", "question", "altaris", "memory", "30 min", "ready"]}
      accentColors={{ from: "#ffd28a", via: "#f0a060", to: "#c87a3a" }}
    >
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ monday · 09:00 · first day</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
              New manager.<br />
              <span className="text-[#7a7166]">New desk. New team.</span>
            </h1>
            <div className="mt-12 grid grid-cols-3 gap-4 max-w-xl">
              {["12-person team", "23-customer portfolio", "3 years of product history"].map((t) => (
                <div key={t} className="rounded-md border border-[rgba(120,80,50,0.4)] bg-[#0d0b0a]/85 px-3 py-2.5">
                  <div className="text-[11px] text-[#bdb4a6]">{t}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="scene s2">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ first thought</div>
            <h2 className="mt-6 text-[clamp(36px,5vw,72px)] font-light leading-[1.15] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">"</span>
              How do I get to know<br />
              <span className="grad-text font-medium">this team, these customers</span>?
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-10 text-base text-[#7a7166]">The previous manager left. The knowledge was in their head. <span className="text-[#ddd8d0]">Now it's gone.</span></p>
          </div>
        </div>
      </section>

      <section className="scene s3">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">altaris · institutional memory opening</div>
            <div className="rounded-md border border-[rgba(120,80,50,0.32)] bg-[#0d0b0a] p-6">
              <p className="text-base text-[#ddd8d0]">
                <span className="text-[#f08c50]">▸</span> Summarize the last 3 years of this team
              </p>
              <div className="mt-4 text-[11px] uppercase tracking-[0.22em] text-[#7a7166]">
                email · meeting notes · contracts · project reports · conflict logs
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-6 text-[11px] uppercase tracking-[0.32em] text-[#9bd07e]">/ 3 years · summary brief</div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  num: "01",
                  metric: "Key decision",
                  title: "2024 — Q3 portfolio cut",
                  detail: "5 customers dropped, consolidated to 2 majors. Margin 32% → 46%.",
                },
                {
                  num: "02",
                  metric: "Team dynamic",
                  title: "2 seniors at odds",
                  detail: "Aylin · Mehmet have been in conflict for a while. Be deliberate when assigning roles.",
                },
                {
                  num: "03",
                  metric: "Customer pattern",
                  title: "Acme — Q4 complaints every year",
                  detail: "Delivery issues every November for 3 years. Plan early.",
                },
              ].map((r) => (
                <div key={r.num} className="rounded-md border border-[rgba(255,180,100,0.4)] bg-[#0d0b0a] p-4">
                  <div className="flex items-start justify-between">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-[#ffb464]">/{r.num}</div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">{r.metric}</div>
                  </div>
                  <h4 className="mt-3 text-base font-medium text-[#ddd8d0]">{r.title}</h4>
                  <p className="mt-2 text-[12px] leading-relaxed text-[#bdb4a6]">{r.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="scene s5">
        <div className="stage">
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ classic onboarding</div>
            <div className="mt-6 flex items-center justify-center gap-8">
              <div className="text-[clamp(56px,8vw,128px)] font-light leading-none text-[#7a7166] line-through decoration-[#7a7166]/40">3 weeks</div>
              <div className="text-[#f08c50]">→</div>
              <div className="text-[clamp(72px,11vw,160px)] font-light leading-none">
                <span className="grad-text font-medium">30 min</span>
              </div>
            </div>
            <p className="mt-8 text-base text-[#bdb4a6]">By midmorning of day one you <span className="text-[#ddd8d0]">already know the team</span>.</p>
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
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">superagent — your institutional memory, always at hand</div>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#f08c50] bg-[#f08c50] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ onboarding</span>
              <span className="font-medium">demo · innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-04-first-day" label="scenario 04 · first day" />
    </SenaryoStage>
  );
}
