"use client";

// ─────────────────────────────────────────────────────────────────
// Scenario 16 — "Container Delay" (Logistics) — ENGLISH VERSION
// Operations manager · 11:08 · container waiting at Hamburg.
// AIS + port API + customer ERP + alternate vessel — single pane.
// ─────────────────────────────────────────────────────────────────

import { SenaryoPlayer, type ScheduleFn } from "../../_lib/SenaryoPlayer";
import { SenaryoStage } from "../../_lib/SenaryoStage";
import { bell, gain, heartbeat, lfo, masterEnv, NOTES, osc, pad } from "../../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0,3],[3,3],[6,3],[9,6],[15,3],[18,4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });
  const padG = pad(ctx, master, t0, TOTAL, [NOTES.E3, NOTES.B3, NOTES.E4], [
    [0, 0], [2, 0.025], [9, 0.024], [14, 0.029], [17, 0.035], [20, 0.022], [21.6, 0],
  ]);
  lfo(ctx, padG.gain, 0.25, 0.006, TOTAL, t0);
  [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0,
   10.0, 11.0, 12.0, 13.0, 14.0,
   15.0, 16.0, 17.0,
   18.0, 19.0, 20.0, 20.8].forEach((t, i) => {
    heartbeat(ctx, master, t0 + t, i % 5 === 0 ? 0.26 : 0.14);
  });
  bell(ctx, master, t0 + 0.4, NOTES.E5, 0.13, 1.6);
  bell(ctx, master, t0 + 1.2, NOTES.B3, 0.10, 1.4);
  bell(ctx, master, t0 + 3.2, NOTES.B3, 0.10, 1.4);
  bell(ctx, master, t0 + 4.0, NOTES.G4, 0.10, 1.4);
  bell(ctx, master, t0 + 4.8, NOTES.E4, 0.10, 1.4);
  [6.2, 6.5, 6.8, 7.1, 7.4, 7.7, 8.0].forEach((t) => {
    bell(ctx, master, t0 + t, NOTES.A5 + Math.random() * 50, 0.05, 0.4);
  });
  bell(ctx, master, t0 + 8.6, NOTES.E5, 0.10, 1.3);
  [
    [9.5, NOTES.E4],
    [10.7, NOTES.G4],
    [11.9, NOTES.B3 * 2],
    [13.1, NOTES.E5],
  ].forEach(([t, f]) => {
    bell(ctx, master, t0 + (t as number), f as number, 0.11, 1.5);
  });
  [15.0, 15.3, 15.6, 15.9, 16.2].forEach((t) => {
    bell(ctx, master, t0 + t, NOTES.A5, 0.06, 0.5);
  });
  [NOTES.E4, NOTES["G#4"], NOTES.B3 * 2, NOTES.E5].forEach((f, i) => {
    bell(ctx, master, t0 + 18.2 + i * 0.26, f, 0.13, 1.7);
  });
  const finalOsc = osc(ctx, NOTES.E3, "triangle");
  const finalG = gain(ctx, 0);
  finalOsc.connect(finalG).connect(master);
  finalG.gain.setValueAtTime(0, t0 + 18);
  finalG.gain.linearRampToValueAtTime(0.05, t0 + 18.4);
  finalG.gain.linearRampToValueAtTime(0.04, t0 + 21);
  finalG.gain.exponentialRampToValueAtTime(0.0001, t0 + 22);
  finalOsc.start(t0 + 18);
  finalOsc.stop(t0 + 22.1);
};

export default function Senaryo16EnPage() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus + altaris logistics · scenario 16 · container delay"
      timeline={["alarm", "question", "altaris", "ETA + route", "time", "supply chain"]}
      accentColors={{ from: "#f0c878", via: "#d8a050", to: "#704818" }}
    >
      <section className="scene s1">
        <div className="stage">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ operations · 11:08 · port of hamburg</div>
            <h1 className="mt-3 text-[clamp(36px,5vw,72px)] font-light leading-[1.05] tracking-tight text-[#ddd8d0]">
              <span className="text-[#ff8060]">⚠</span> Container delayed.<br />
              <span className="text-[#7a7166]">MSCU 7842310 · 18 hours</span>
            </h1>
            <div className="mt-12 grid grid-cols-2 gap-4 max-w-xl">
              <div className="rounded-md border border-[rgba(240,200,120,0.45)] bg-[#100c08]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#f0c878]">original ETA</div>
                <div className="mt-1 text-sm text-[#ddd8d0]">04 May · 14:00 Istanbul</div>
              </div>
              <div className="rounded-md border border-[rgba(255,140,80,0.45)] bg-[#1a0d08]/85 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#ffae6e]">held at</div>
                <div className="mt-1 text-sm text-[#ffae6e]">Hamburg outer · anchorage</div>
              </div>
            </div>
            <p className="mt-8 max-w-xl text-sm leading-relaxed text-[#9b9285]">
              AIS · port API · sailing schedule · two customers' delivery contracts —
              <span className="text-[#ddd8d0]"> four sources, takes minutes to reconcile</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="scene s2">
        <div className="stage">
          <div className="max-w-4xl text-center">
            <h2 className="text-[clamp(32px,5vw,72px)] font-light leading-[1.15] tracking-tight text-[#ddd8d0]">
              <span className="text-[#5a534a]">"</span>
              What's the new ETA?<br />
              <span className="grad-text font-medium">What do I tell the customer</span>?
              <span className="text-[#5a534a]">"</span>
            </h2>
            <p className="mt-10 text-base text-[#7a7166]">
              Alternate vessel · waiting time · contract penalty · alternate port —
              <span className="text-[#ddd8d0]"> four decisions to send one message</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="scene s3">
        <div className="stage">
          <div className="w-full max-w-3xl">
            <div className="mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[#6b6358]">
              <span aria-hidden className="size-1.5 rounded-full bg-[#f0c878] animate-pulse" />
              <span>altaris logistics · voyage tracking</span>
              <span className="text-[#3a342d]">·</span>
              <span>AIS + port + ERP bridged</span>
            </div>
            <div className="rounded-md border border-[rgba(240,200,120,0.5)] bg-[#100c08] p-6">
              <p className="text-base text-[#ddd8d0] font-mono">
                <span className="text-[#f0c878]">▸</span> altaris container-track
                <span className="text-[#7a7166]"> --container=MSCU7842310</span>
                <span className="text-[#7a7166]"> --eta-refresh</span>
                <span className="text-[#7a7166]"> --customer-notify</span>
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">
                <span>AIS · vessel position</span>
                <span>port wait analysis</span>
                <span>customer contract</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s4">
        <div className="stage">
          <div className="w-full max-w-5xl">
            <div className="mb-6 flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#f0c878]">/ ETA recompute + customer impact</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a7166]">MSCU 7842310 · MSC Bremen</div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  num: "01",
                  label: "New ETA",
                  metric: "06 May · 09:30",
                  detail: "Hamburg anchorage 18h. MSC Bremen sailing 2024-W18, via Constanta to Marmara.",
                  src: ["AIS", "MSC API", "Schedule"],
                  color: "warm",
                },
                {
                  num: "02",
                  label: "Alternate route",
                  metric: "+₺38k · 14h saved",
                  detail: "Discharge MSCU at Hamburg, road to Trieste, transload to Maersk Pacific.",
                  src: ["Maersk", "Road", "Cost"],
                  color: "soft",
                },
                {
                  num: "03",
                  label: "Customer impact",
                  metric: "2 critical · 4 flexible",
                  detail: "TUR-Textile needs 04 May (penalty clause). Other 4 customers tolerate up to 7 days.",
                  src: ["ERP", "Contract", "Customer"],
                  color: "warm",
                },
              ].map((r) => (
                <div key={r.num} className="relative rounded-md border border-[rgba(240,200,120,0.45)] bg-[#100c08] p-4">
                  <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-[#f0c878]" />
                  <div className="flex items-start justify-between">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-[#f0c878]">/{r.num}</div>
                    <div className={`text-base font-medium ${r.color === "warm" ? "text-[#ffae6e]" : "text-[#f0c878]"}`}>{r.metric}</div>
                  </div>
                  <h4 className="mt-3 text-base font-medium text-[#ddd8d0]">{r.label}</h4>
                  <p className="mt-2 text-[12px] leading-relaxed text-[#bdb4a6]">{r.detail}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[rgba(120,80,50,0.25)] pt-2">
                    {r.src.map((s) => (
                      <span key={s} className="rounded-sm border border-[rgba(240,200,120,0.4)] bg-[#180e08] px-2 py-0.5 text-[9px] uppercase tracking-[0.22em] text-[#9b9285]">{s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-md border border-[rgba(240,200,120,0.45)] bg-[#100c08] p-4">
              <div className="text-[10px] uppercase tracking-[0.28em] text-[#f0c878]">recommendation · message ready to send</div>
              <p className="mt-3 text-[13px] leading-relaxed text-[#ddd8d0] italic">
                "Dear TUR-Textile team, your container MSCU 7842310 is delayed at Hamburg due to port congestion.
                New ETA: <span className="text-[#f0c878]">06 May · 09:30</span>. To preserve your contract delivery date,
                we're re-routing via Trieste — extra cost on us. With your sign-off by 14:00, we move today."
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="scene s5">
        <div className="stage">
          <div className="text-center max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#7a7166]">/ container at sea · control at the desk</div>
            <h2 className="mt-8 text-[clamp(36px,5.5vw,80px)] font-light leading-[1.1] tracking-tight text-[#ddd8d0]">
              <span className="text-[#7a7166]">Four sources</span> →
              <span className="grad-text font-medium"> four minutes</span>
            </h2>
            <p className="mt-8 text-base text-[#bdb4a6]">
              ETA recomputed · alternate route picked · customer message drafted.
              <br />Before the customer asks — the answer is already in hand.
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
            <div className="mt-3 text-[11px] uppercase tracking-[0.32em] text-[#f0c878]">
              + altaris logistics · AIS + port API + ERP integrated
            </div>
            <div className="mt-4 text-[11px] uppercase tracking-[0.32em] text-[#f08c50]">
              supply chain · visibility + decision side by side
            </div>
            <div className="mx-auto mt-12 inline-flex items-center gap-4 rounded-md border border-[#f0c878] bg-[#f0c878] px-7 py-4 text-[#0a0908]">
              <span className="text-[10px] uppercase tracking-[0.32em]">/ pilot</span>
              <span className="font-medium">demo · innovahub@argusteknoloji.com.tr</span>
            </div>
          </div>
        </div>
      </section>

      <SenaryoPlayer schedule={schedule} durationSec={TOTAL} filenamePrefix="senaryo-16-container-delay" label="scenario 16 · container delay" />
    </SenaryoStage>
  );
}
