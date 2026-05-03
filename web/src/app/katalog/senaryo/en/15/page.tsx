"use client";

// ─────────────────────────────────────────────────────────────────
// Scenario 15 — "Committee Morning" (Banking) — ENGLISH VERSION
// Credit committee · 08:30 · 142 applications
// KYC / AML / sector risk / credit score — single dossier
// ─────────────────────────────────────────────────────────────────

import { SenaryoPlayer, type ScheduleFn } from "../../_lib/SenaryoPlayer";
import { SenaryoStage } from "../../_lib/SenaryoStage";
import { bell, gain, heartbeat, lfo, masterEnv, NOTES, osc, pad } from "../../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0,3],[3,3],[6,3],[9,6],[15,3],[18,4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.C3, NOTES.G3, NOTES.C4], [
    [0, 0], [2, 0.024], [9, 0.022], [14, 0.027], [17, 0.034], [20, 0.022], [21.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.18, 0.005, TOTAL, t0);
  [1.5, 3.0, 4.5, 6.0, 7.5, 9.0, 10.5, 12.0, 13.5, 15.0, 16.5, 18.0, 19.5, 20.8].forEach((t, i) => {
    heartbeat(ctx, master, t0 + t, i % 4 === 0 ? 0.24 : 0.14);
  });
  bell(ctx, master, t0 + 0.4, NOTES.C5, 0.13, 2.4);
  bell(ctx, master, t0 + 1.4, NOTES.G4, 0.10, 2.0);
  bell(ctx, master, t0 + 3.2, NOTES.C4, 0.10, 1.4);
  bell(ctx, master, t0 + 4.0, NOTES.E4, 0.10, 1.4);
  bell(ctx, master, t0 + 4.8, NOTES.G4, 0.10, 1.4);
  [6.2, 6.5, 6.8, 7.1, 7.4, 7.7].forEach((t) => {
    bell(ctx, master, t0 + t, NOTES.A5 + Math.random() * 30, 0.05, 0.4);
  });
  bell(ctx, master, t0 + 8.6, NOTES.C5, 0.10, 1.3);
  [
    [9.5, NOTES.C4],
    [10.5, NOTES.E4],
    [11.5, NOTES.G4],
    [12.5, NOTES.C5],
  ].forEach(([t, f]) => {
    bell(ctx, master, t0 + (t as number), f as number, 0.11, 1.4);
  });
  bell(ctx, master, t0 + 13.4, NOTES["C#4"], 0.10, 1.6);
  [15.0, 15.4, 15.8, 16.2].forEach((t) => {
    bell(ctx, master, t0 + t, NOTES.A5, 0.06, 0.5);
  });
  [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.C5].forEach((f, i) => {
    bell(ctx, master, t0 + 18.2 + i * 0.26, f, 0.13, 1.7);
  });
  const finalOsc = osc(ctx, NOTES.C3, "sine");
  const finalG = gain(ctx, 0);
  finalOsc.connect(finalG).connect(master);
  finalG.gain.setValueAtTime(0, t0 + 18);
  finalG.gain.linearRampToValueAtTime(0.05, t0 + 18.4);
  finalG.gain.linearRampToValueAtTime(0.04, t0 + 21);
  finalG.gain.exponentialRampToValueAtTime(0.0001, t0 + 22);
  finalOsc.start(t0 + 18);
  finalOsc.stop(t0 + 22.1);
};

export default function Senaryo15EnPage() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus + altaris finance · scenario 15 · committee morning"
      timeline={["committee", "question", "altaris", "risk dossier", "time", "compliance"]}
      accentColors={{ from: "#d8c890", via: "#9a8a50", to: "#5a4828" }}
    >
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ credit committee · 08:30 · headquarters</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
              <span className="text-[#d8c890]">142</span> applications.<br />
              <span className="text-[#7a7166]">Two hours to decide.</span>
            </h1>
            <div className="mt-12 grid grid-cols-3 gap-3 max-w-2xl">
              <div className="rounded-md border border-[rgba(216,200,144,0.45)] bg-[#0d0c08]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#d8c890]">commercial</div>
                <div className="mt-1 text-[12px] text-[#ddd8d0]">87 apps · ₺1.4 bn</div>
              </div>
              <div className="rounded-md border border-[rgba(216,200,144,0.45)] bg-[#0d0c08]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#d8c890]">corporate</div>
                <div className="mt-1 text-[12px] text-[#ddd8d0]">32 apps · ₺2.1 bn</div>
              </div>
              <div className="rounded-md border border-[rgba(216,200,144,0.45)] bg-[#0d0c08]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#d8c890]">SME</div>
                <div className="mt-1 text-[12px] text-[#ddd8d0]">23 apps · ₺184 mn</div>
              </div>
            </div>
            <p className="mt-8 max-w-xl text-sm leading-relaxed text-[#9b9285]">
              Credit bureau score · AML check · sector risk · financials · collateral —
              <span className="text-[#ddd8d0]"> every file from five separate screens</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="scene s2">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <h2 className="text-[clamp(32px,5vw,72px)] font-light leading-[1.15] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">"</span>
              KYC clear? AML clean?<br />
              <span className="grad-text font-medium">Risk score aligned with the call</span>?
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-10 text-base text-[#7a7166]">
              Credit bureau · AML watchlist · shareholders · UBO · sector volatility · contract load —
              <span className="text-[#ddd8d0]"> a separate run for every file</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="scene s3">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">
              <span aria-hidden className="size-1.5 rounded-full bg-[#d8c890] animate-pulse" />
              <span>altaris finance · committee dossier</span>
              <span className="text-[#3a342d]">·</span>
              <span>core banking bridged</span>
            </div>
            <div className="rounded-md border border-[rgba(216,200,144,0.5)] bg-[#0d0c08] p-6">
              <p className="text-base text-[#ddd8d0] font-mono">
                <span className="text-[#d8c890]">▸</span> altaris committee-pack
                <span className="text-[#7a7166]"> --day=2026-05-03</span>
                <span className="text-[#7a7166]"> --kyc-aml-risk</span>
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">
                <span>142 files pulled</span>
                <span>aml + bureau queried</span>
                <span>sector risk benchmarked</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-6 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#d8c890]">/ committee dossier · summary panel</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">142 files · 38 min runtime</div>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              {[
                {
                  num: "01",
                  label: "KYC + UBO",
                  metric: "138 / 142",
                  detail: "4 files missing UBO, returned to relationship manager. Should not reach committee.",
                  color: "warm",
                },
                {
                  num: "02",
                  label: "AML / watchlist",
                  metric: "2 flags",
                  detail: "Two files with PEP-adjacent shareholders. Enhanced due diligence auto-triggered.",
                  color: "warm",
                },
                {
                  num: "03",
                  label: "Risk score",
                  metric: "avg 7.3 / 10",
                  detail: "121 files in green band. 17 amber, 2 red — sector benchmark in the table below.",
                  color: "green",
                },
                {
                  num: "04",
                  label: "Anomalies",
                  metric: "4 cases",
                  detail: "Same beneficial owner across 3 separate corporate applications. Linkage detected, files consolidated.",
                  color: "warm",
                },
              ].map((r) => (
                <div key={r.num} className="relative rounded-md border border-[rgba(216,200,144,0.45)] bg-[#0d0c08] p-4">
                  <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-[#d8c890]" />
                  <div className="flex items-start justify-between">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-[#d8c890]">/{r.num}</div>
                    <div className={`text-base font-medium ${r.color === "green" ? "text-[#9fd89f]" : r.color === "warm" ? "text-[#ffae6e]" : "text-[#d8c890]"}`}>{r.metric}</div>
                  </div>
                  <h4 className="mt-3 text-base font-medium text-[#ddd8d0]">{r.label}</h4>
                  <p className="mt-2 text-[12px] leading-relaxed text-[#bdb4a6]">{r.detail}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-md border border-[rgba(216,200,144,0.45)] bg-[#0d0c08] p-4">
              <div className="text-[10px] uppercase tracking-[0.28em] text-[#d8c890]">recommended ordering · for committee agenda</div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-[12px]">
                <div><span className="text-[#9fd89f]">▸ Fast approve (87)</span><br /><span className="text-[#bdb4a6]">Score 8+, KYC clean, low-risk sector.</span></div>
                <div><span className="text-[#d8c890]">▸ Discuss (49)</span><br /><span className="text-[#bdb4a6]">Sector or collateral question; committee call needed.</span></div>
                <div><span className="text-[#ffae6e]">▸ Return / DD (6)</span><br /><span className="text-[#bdb4a6]">Missing UBO, PEP, anomaly — back to origination.</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s5">
        <div className="stage">
          <div className="text-center max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ bank data stays in the bank · nothing leaves</div>
            <h2 className="mt-8 text-[clamp(36px,5.5vw,80px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              <span className="text-[#7a7166]">142 files</span> →
              <span className="grad-text font-medium"> 38 minutes</span>
            </h2>
            <p className="mt-8 text-base text-[#bdb4a6]">
              KYC scanned · AML cleared · risk scored · anomalies caught.
              <br />When the committee starts — the dossier is on the table.
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
            <div className="mt-3 text-[11px] uppercase tracking-[0.32em] text-[#d8c890]">
              + altaris finance · core banking + bureau + AML bridged
            </div>
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">
              customer data on-prem · regulatory + GDPR aligned · audit trail
            </div>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#d8c890] bg-[#d8c890] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ pilot</span>
              <span className="font-medium">demo · innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-15-committee-morning" label="scenario 15 · committee morning" />
    </SenaryoStage>
  );
}
