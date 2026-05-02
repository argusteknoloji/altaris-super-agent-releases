"use client";

// ──────────────────────────────────────────────────────────────────────────
// Senaryo player + soundtrack + in-browser recorder.
//
// Üç düğme:
//   ▸ Oynat        — sahneleri ve sesi başlatır (sayfada izle)
//   🎬 Kaydet      — getDisplayMedia + MediaRecorder, 22.5 sn webm indir
//   ↻ Yeniden     — bir tur bittikten sonra
//
// Çıktı: webm (VP9 + Opus). WhatsApp / Telegram doğrudan kabul eder; mp4
// gerekirse `ffmpeg -i in.webm -c copy out.mp4` ile yeniden konteynerle.
//
// Animasyonlar `[data-play="1"]` selector'una bağlı — yani CSS keyframe'leri
// state set edilene kadar tetiklenmez. Böylece kayıt baştan yakalanır.
// ──────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";

const D_FREQ = 73.42;
const A_FREQ = 110.0;
const F_FREQ = 87.31;
const HIGH_C = 523.25;
const HIGH_E = 659.25;
const HIGH_G = 783.99;

const TOTAL_S = 22;
const RECORD_BUFFER_MS = 600; // küçük buffer — son sahne netçe biter

type Phase = "idle" | "playing" | "recording" | "done";

function osc(ctx: AudioContext, freq: number, type: OscillatorType = "sine") {
  const o = ctx.createOscillator();
  o.frequency.value = freq;
  o.type = type;
  return o;
}
function gain(ctx: AudioContext, value = 0) {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

/**
 * Tüm 22sn sentezini bir kez planlar. Master gain hem hoparlöre hem (varsa)
 * kayıt destination'ına bağlanır.
 */
function scheduleSoundtrack(
  ctx: AudioContext,
  recordDest: MediaStreamAudioDestinationNode | null,
) {
  const t0 = ctx.currentTime;
  const master = gain(ctx, 0);
  master.connect(ctx.destination);
  if (recordDest) master.connect(recordDest);
  master.gain.setValueAtTime(0, t0);
  master.gain.linearRampToValueAtTime(0.5, t0 + 0.6);

  const padFilter = ctx.createBiquadFilter();
  padFilter.type = "lowpass";
  padFilter.frequency.setValueAtTime(420, t0);
  padFilter.frequency.linearRampToValueAtTime(900, t0 + 9);
  padFilter.frequency.linearRampToValueAtTime(1600, t0 + 15);
  padFilter.frequency.linearRampToValueAtTime(2400, t0 + 18);
  padFilter.Q.value = 1.4;
  padFilter.connect(master);

  [D_FREQ, A_FREQ, D_FREQ * 2, F_FREQ * 2].forEach((f, i) => {
    const o = osc(ctx, f, i % 2 === 0 ? "sawtooth" : "triangle");
    const g = gain(ctx, 0);
    o.connect(g).connect(padFilter);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.06, t0 + 1);
    g.gain.linearRampToValueAtTime(0.04, t0 + 9);
    g.gain.linearRampToValueAtTime(0.025, t0 + 15);
    g.gain.linearRampToValueAtTime(0.05, t0 + 18);
    g.gain.linearRampToValueAtTime(0, t0 + 21.6);
    o.start(t0);
    o.stop(t0 + 22);
  });

  // Sahne 2 — soru tick'leri
  [3.0, 3.6, 4.4, 5.4].forEach((t) => {
    const o = osc(ctx, 880, "sine");
    const g = gain(ctx, 0);
    o.connect(g).connect(master);
    const at = t0 + t;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.08, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
    o.start(at);
    o.stop(at + 0.7);
  });

  // Sahne 3 — typing tick'leri
  for (let i = 0; i < 18; i++) {
    const at = t0 + 6.6 + i * 0.085;
    const o = osc(ctx, 1400 + Math.random() * 600, "square");
    const g = gain(ctx, 0);
    o.connect(g).connect(master);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.018, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    o.start(at);
    o.stop(at + 0.06);
  }

  // Brain pulse boom
  const brainAt = t0 + 8.3;
  const brainOsc = osc(ctx, D_FREQ / 2, "sine");
  const brainG = gain(ctx, 0);
  brainOsc.connect(brainG).connect(master);
  brainG.gain.setValueAtTime(0, brainAt);
  brainG.gain.linearRampToValueAtTime(0.4, brainAt + 0.05);
  brainG.gain.exponentialRampToValueAtTime(0.0001, brainAt + 1.4);
  brainOsc.start(brainAt);
  brainOsc.stop(brainAt + 1.5);

  // Sahne 4 — risk pop'ları
  [9.5, 11.0, 12.5].forEach((t, i) => {
    const at = t0 + t;
    const baseFreq = [HIGH_C, HIGH_E, HIGH_G][i];
    const o = osc(ctx, baseFreq, "triangle");
    const o2 = osc(ctx, baseFreq * 2, "sine");
    const g = gain(ctx, 0);
    o.connect(g);
    o2.connect(g);
    g.connect(master);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.12, at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.2);
    o.start(at);
    o2.start(at);
    o.stop(at + 1.3);
    o2.stop(at + 1.3);
  });

  // Sahne 5 — yükselen reveal arpej
  const arpegio = [HIGH_C, HIGH_E, HIGH_G, HIGH_C * 2];
  arpegio.forEach((freq, i) => {
    const at = t0 + 15.4 + i * 0.18;
    const o = osc(ctx, freq, "sine");
    const g = gain(ctx, 0);
    o.connect(g).connect(master);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.1, at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);
    o.start(at);
    o.stop(at + 0.75);
  });

  // ── ALTARIS theme motif (D-major pentatonic ascending) ──────────
  const themeNotes = [293.66, 369.99, 440.0, 587.33];
  const playTheme = (
    startAt: number,
    peakGain: number,
    voice: OscillatorType = "triangle",
  ) => {
    themeNotes.forEach((freq, i) => {
      const at = startAt + i * 0.22;
      const o = osc(ctx, freq, voice);
      const o2 = osc(ctx, freq * 2, "sine");
      const g = gain(ctx, 0);
      o.connect(g);
      o2.connect(g);
      g.connect(master);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(peakGain, at + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.85);
      o.start(at);
      o2.start(at);
      o.stop(at + 0.9);
      o2.stop(at + 0.9);
    });
  };
  playTheme(t0 + 0.4, 0.04, "sine");
  playTheme(t0 + 18.1, 0.13, "triangle");

  // Sahne 6 — warm chord pad
  const resolveAt = t0 + 18;
  const chord = [D_FREQ * 2, F_FREQ * 2 + 12, A_FREQ * 2];
  chord.forEach((freq) => {
    const o = osc(ctx, freq, "sine");
    const g = gain(ctx, 0);
    o.connect(g).connect(master);
    g.gain.setValueAtTime(0, resolveAt);
    g.gain.linearRampToValueAtTime(0.05, resolveAt + 0.5);
    g.gain.linearRampToValueAtTime(0.04, resolveAt + 3);
    g.gain.exponentialRampToValueAtTime(0.0001, resolveAt + 4);
    o.start(resolveAt);
    o.stop(resolveAt + 4.1);
  });

  // Master fadeout
  master.gain.setValueAtTime(0.5, t0 + 21);
  master.gain.linearRampToValueAtTime(0, t0 + 22);
}

export function Soundtrack() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);

  // Sahnelerin animation'ı body[data-play="1"] selector'una bağlı.
  // Phase değiştikçe DOM'u senkronize et.
  useEffect(() => {
    const root = document.documentElement;
    if (phase === "playing" || phase === "recording") {
      root.setAttribute("data-play", "1");
    } else {
      root.removeAttribute("data-play");
    }
  }, [phase]);

  // İlerleme barı (sadece visual feedback)
  useEffect(() => {
    if (phase !== "playing" && phase !== "recording") return;
    const start = performance.now();
    let raf: number;
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      setProgress(Math.min(1, elapsed / TOTAL_S));
      if (elapsed < TOTAL_S + 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  function newAudioContext(): AudioContext {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    return new Ctor();
  }

  async function startPreview() {
    if (ctxRef.current) {
      await ctxRef.current.close();
      ctxRef.current = null;
    }
    const ctx = newAudioContext();
    await ctx.resume();
    ctxRef.current = ctx;
    scheduleSoundtrack(ctx, null);
    setPhase("playing");
    setTimeout(() => setPhase("done"), TOTAL_S * 1000 + 500);
  }

  async function startRecording() {
    // 1. Tarayıcıdan ekran/sekme paylaşma izni
    let display: MediaStream;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
        // @ts-expect-error preferCurrentTab eski bir Chrome flag'i; düşse de çalışır
        preferCurrentTab: true,
      });
    } catch (err) {
      alert("Ekran paylaşımı iptal edildi. Lütfen tekrar dene ve bu sekmeyi seç.");
      return;
    }

    // 2. AudioContext + recording destination
    if (ctxRef.current) {
      await ctxRef.current.close();
      ctxRef.current = null;
    }
    const ctx = newAudioContext();
    await ctx.resume();
    ctxRef.current = ctx;
    const recDest = ctx.createMediaStreamDestination();
    scheduleSoundtrack(ctx, recDest);

    // 3. Video + audio stream'leri birleştir
    const audioTrack = recDest.stream.getAudioTracks()[0];
    const videoTrack = display.getVideoTracks()[0];
    const combined = new MediaStream([videoTrack, audioTrack]);

    // 4. MediaRecorder
    const mimeType = "video/webm;codecs=vp9,opus";
    const recorder = new MediaRecorder(combined, {
      mimeType,
      videoBitsPerSecond: 4_000_000,
      audioBitsPerSecond: 192_000,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `altaris-senaryo-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.webm`;
      a.click();
      display.getTracks().forEach((t) => t.stop());
      setPhase("done");
    };
    recorder.start(250); // 250ms timeslice — ondataavailable sürekli tetiklenir

    setPhase("recording");

    // 5. Auto-stop
    setTimeout(() => {
      try { recorder.stop(); } catch { /* already stopped */ }
    }, TOTAL_S * 1000 + RECORD_BUFFER_MS);
  }

  function reset() {
    void ctxRef.current?.close();
    ctxRef.current = null;
    setPhase("idle");
    setProgress(0);
  }

  // ── UI ──────────────────────────────────────────────────────────
  if (phase === "playing" || phase === "recording") {
    return (
      <div className="pointer-events-none fixed bottom-12 left-1/2 z-30 -translate-x-1/2">
        <div className="flex items-center gap-3 rounded-full border border-[rgba(120,80,50,0.4)] bg-[#0d0b0a]/85 px-4 py-2 backdrop-blur">
          <span aria-hidden className={`size-2 rounded-full ${phase === "recording" ? "animate-pulse bg-[#ff5a5a]" : "bg-[#9bd07e]"}`} />
          <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-[#bdb4a6]">
            {phase === "recording" ? "kaydediliyor" : "oynatılıyor"}
          </span>
          <span aria-hidden className="ml-2 h-1 w-32 rounded-full bg-[#3a342d]">
            <span className="block h-full rounded-full bg-[#f08c50]" style={{ width: `${progress * 100}%` }} />
          </span>
          <span className="font-mono text-[10px] tabular-nums text-[#7a7166]">
            {Math.floor(progress * TOTAL_S)} / {TOTAL_S}s
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-12 left-1/2 z-30 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-md border border-[rgba(120,80,50,0.4)] bg-[#0d0b0a]/90 p-1.5 backdrop-blur shadow-[0_8px_30px_-8px_rgba(240,140,80,0.4)]">
        <button
          type="button"
          onClick={startPreview}
          className="rounded-sm px-4 py-2 font-mono text-[10px] uppercase tracking-[0.32em] text-[#ddd8d0] transition-colors hover:bg-[#1a1612] hover:text-[#ffb464]"
        >
          ▸ oynat · 22 sn
        </button>
        <span aria-hidden className="h-5 w-px bg-[rgba(120,80,50,0.4)]" />
        <button
          type="button"
          onClick={startRecording}
          className="group rounded-sm bg-[#f08c50] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.32em] text-[#0a0908] transition-colors hover:bg-[#ffb464]"
          title="Tarayıcı 'paylaşılacak içerik' soracak — bu sekmeyi seç"
        >
          🎬 video kaydet → webm
        </button>
        {phase === "done" && (
          <>
            <span aria-hidden className="h-5 w-px bg-[rgba(120,80,50,0.4)]" />
            <button
              type="button"
              onClick={reset}
              className="rounded-sm px-3 py-2 font-mono text-[10px] uppercase tracking-[0.32em] text-[#7a7166] transition-colors hover:text-[#ddd8d0]"
            >
              ↻ tekrar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
