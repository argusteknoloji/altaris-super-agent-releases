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
  // ──────────────────────────────────────────────────────────────────
  // CINEMATIC AMBIENT — Apple / Tesla keynote tarzı
  //
  // Üç katman:
  //   1) Heartbeat sub-kick'ler — yumuşak ritim, 1.7s aralıklarla, tempo
  //      sahne 4 (cevap)'a doğru hızlanır, sahne 6'da yavaşlayıp resolve.
  //   2) Air pad — D3 + A3 saf sinüs, çok düşük gain, yavaş LFO ile nefes.
  //      "Var ama dikkat çekmeyen" arka kat.
  //   3) Tension sweep — sahne 3 → 4 geçişinde bandpass-filtered noise,
  //      "the answer is coming" hissi. Resolve'da theme motif ile biter.
  // ──────────────────────────────────────────────────────────────────
  const t0 = ctx.currentTime;
  const master = gain(ctx, 0);
  master.connect(ctx.destination);
  if (recordDest) master.connect(recordDest);
  master.gain.setValueAtTime(0, t0);
  master.gain.linearRampToValueAtTime(0.5, t0 + 0.5);
  master.gain.setValueAtTime(0.5, t0 + 21);
  master.gain.linearRampToValueAtTime(0, t0 + 22);

  // ── 1) HEARTBEAT — 808-tarzı pitch-modulated sub kick ────────────
  // 130Hz → 50Hz (0.12s'de) + hızlı decay → "thump" hissi.
  // Tüm cihazlarda duyulur (laptop hoparlörü dahil), rahatsız etmez.
  const heartbeat = (atSec: number, peak = 0.22) => {
    const at = t0 + atSec;
    const o = osc(ctx, 130, "sine");
    const g = gain(ctx, 0);
    o.connect(g).connect(master);
    o.frequency.setValueAtTime(130, at);
    o.frequency.exponentialRampToValueAtTime(50, at + 0.12);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
    o.start(at);
    o.stop(at + 0.35);
  };

  // Heartbeat zamanlaması — yavaş başlar, build, accent, resolve
  const heartTimes: Array<[number, number]> = [
    // [time, gain]  -- yavaş kalp atışı
    [0.6,  0.18], [2.4,  0.18],                       // sahne 1 (sakin)
    [3.6,  0.20], [5.4,  0.20],                       // sahne 2 (soru — biraz daha tetikte)
    [6.6,  0.22], [7.8,  0.22],                       // sahne 3 (typing — tension build)
    [9.0,  0.32],                                      // sahne 4 girişi — VURGU (cevap!)
    [10.2, 0.20], [11.5, 0.20], [13.0, 0.20],         // sahne 4 (kart pop'larıyla senkron)
    [15.2, 0.26], [16.4, 0.20],                       // sahne 5 (reveal)
    [17.8, 0.32],                                      // sahne 6 girişi — VURGU (resolve!)
    [20.5, 0.16],                                      // sahne 6 son (yumuşayan)
  ];
  heartTimes.forEach(([t, g]) => heartbeat(t, g));

  // ── 2) AIR PAD — D3 + A3 saf sinüs, LFO ile nefes ────────────────
  const padG = gain(ctx, 0);
  padG.connect(master);
  [146.83, 220.00, 293.66].forEach((freq) => { // D3 · A3 · D4
    const o = osc(ctx, freq, "sine");
    o.connect(padG);
    o.start(t0);
    o.stop(t0 + 22);
  });
  padG.gain.setValueAtTime(0, t0);
  padG.gain.linearRampToValueAtTime(0.022, t0 + 2);     // sahneye yumuşak gir
  padG.gain.linearRampToValueAtTime(0.016, t0 + 9);     // cevap zamanı geri çekil
  padG.gain.linearRampToValueAtTime(0.012, t0 + 13);    // risk kartlarına yer ver
  padG.gain.linearRampToValueAtTime(0.024, t0 + 17);    // resolve'a build
  padG.gain.linearRampToValueAtTime(0.018, t0 + 20);
  padG.gain.linearRampToValueAtTime(0, t0 + 21.8);

  // LFO — pad'e yavaş "breath" hareketi
  const lfo = osc(ctx, 0.18, "sine");
  const lfoAmp = gain(ctx, 0.006);
  lfo.connect(lfoAmp).connect(padG.gain);
  lfo.start(t0);
  lfo.stop(t0 + 22);

  // ── 3) TENSION SWEEP — sahne 3→4 geçişi (7s–9s) ──────────────────
  // White noise → bandpass filter, frekans 200Hz'den 1800Hz'e tarama.
  // "Cevap geliyor" hissi. Yarım saniyelik bir "rush".
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2.5, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;
  const sweepFilter = ctx.createBiquadFilter();
  sweepFilter.type = "bandpass";
  sweepFilter.Q.value = 3;
  sweepFilter.frequency.setValueAtTime(200, t0 + 7);
  sweepFilter.frequency.exponentialRampToValueAtTime(1800, t0 + 9.0);
  const sweepG = gain(ctx, 0);
  noiseSrc.connect(sweepFilter).connect(sweepG).connect(master);
  sweepG.gain.setValueAtTime(0, t0 + 7);
  sweepG.gain.linearRampToValueAtTime(0.08, t0 + 8);
  sweepG.gain.linearRampToValueAtTime(0.0001, t0 + 9.2);
  noiseSrc.start(t0 + 7);
  noiseSrc.stop(t0 + 9.3);

  // ── 4) Sahne accent'leri — yumuşak bell hits ─────────────────────
  const bell = (atSec: number, freq: number, peak: number, decay: number) => {
    const at = t0 + atSec;
    const o = osc(ctx, freq, "sine");
    const o2 = osc(ctx, freq * 2, "sine");
    const o2g = gain(ctx, 0.3);
    const g = gain(ctx, 0);
    o.connect(g);
    o2.connect(o2g).connect(g);
    g.connect(master);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    o.start(at);
    o2.start(at);
    o.stop(at + decay + 0.05);
    o2.stop(at + decay + 0.05);
  };

  // Sadece 3 ana an — fazla "ding" yok
  bell(0.3, 293.66, 0.10, 1.6);   // sahne 1 hint (D4, yumuşak)
  bell(9.05, 587.33, 0.13, 1.6);  // sahne 4 girişi (D5, "answer" parlatma)
  bell(15.3, 659.25, 0.10, 1.4);  // sahne 5 (E5, reveal sparkle)

  // ── 5) Risk kart pop'ları — yumuşak chime, daha az ──────────────
  // 3'lü majör arpej (C-E-G), her kart için tek nota
  [
    { t: 9.5,  freq: HIGH_C },
    { t: 11.0, freq: HIGH_E },
    { t: 12.5, freq: HIGH_G },
  ].forEach(({ t, freq }) => bell(t, freq, 0.085, 1.0));

  // ── 6) ALTARIS theme motif — kapanış imzası ──────────────────────
  // D-major pentatonic ascending: D4 · F#4 · A4 · D5
  const themeNotes = [293.66, 369.99, 440.0, 587.33];
  themeNotes.forEach((freq, i) => {
    bell(18.2 + i * 0.26, freq, 0.13, 1.7);
  });
}

export function Soundtrack() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);

  // Sahnelerin animation'ı html[data-play="1"] selector'una bağlı.
  // Recording sırasında ekstra `data-recording="1"` set edilir → UI chrome
  // (top bar, bottom timeline) CSS ile gizlenir, çıktı temiz olur.
  useEffect(() => {
    const root = document.documentElement;
    if (phase === "playing" || phase === "recording") {
      root.setAttribute("data-play", "1");
    } else {
      root.removeAttribute("data-play");
    }
    if (phase === "recording") {
      root.setAttribute("data-recording", "1");
    } else {
      root.removeAttribute("data-recording");
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

  // Batch recording desteği: ?autoplay=1 ile otomatik başlama + offline
  // audio render API. Detay için _lib/SenaryoPlayer.tsx'e bak.
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as unknown as { __altarisRenderAudio?: () => Promise<string> }).__altarisRenderAudio = async () => {
      const sr = 44100;
      const off = new OfflineAudioContext({
        numberOfChannels: 2,
        sampleRate: sr,
        length: Math.ceil(sr * (TOTAL_S + 0.5)),
      });
      scheduleSoundtrack(off as unknown as AudioContext, null);
      const buf = await off.startRendering();
      // Inline WAV→base64
      const numCh = buf.numberOfChannels;
      const len = buf.length;
      const bytesPerSample = 2;
      const blockAlign = numCh * bytesPerSample;
      const dataSize = len * blockAlign;
      const ab = new ArrayBuffer(44 + dataSize);
      const v = new DataView(ab);
      const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      w(0, "RIFF"); v.setUint32(4, 36 + dataSize, true); w(8, "WAVE");
      w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, numCh, true);
      v.setUint32(24, sr, true); v.setUint32(28, sr * blockAlign, true);
      v.setUint16(32, blockAlign, true); v.setUint16(34, 16, true);
      w(36, "data"); v.setUint32(40, dataSize, true);
      const chs = [buf.getChannelData(0), numCh > 1 ? buf.getChannelData(1) : buf.getChannelData(0)];
      let off2 = 44;
      for (let i = 0; i < len; i++) for (let c = 0; c < numCh; c++) {
        const s = Math.max(-1, Math.min(1, chs[c][i]));
        v.setInt16(off2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        off2 += 2;
      }
      const bytes = new Uint8Array(ab);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    };
    (window as unknown as { __altarisDuration?: number }).__altarisDuration = TOTAL_S;
    const params = new URLSearchParams(window.location.search);
    if (params.get("autoplay") === "1") {
      const t = setTimeout(() => { void startPreview(); }, 200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startPreview() {
    if (ctxRef.current) {
      await ctxRef.current.close();
      ctxRef.current = null;
    }
    const ctx = newAudioContext();
    await ctx.resume();
    ctxRef.current = ctx;
    // Animation ve sesi aynı tick'te başlat — DOM attr'i React'ten önce set
    document.documentElement.setAttribute("data-play", "1");
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
    // (scheduleSoundtrack daha sonra, recorder.start ile aynı tick'te çağrılır)

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
    // 5. Animasyon · recorder · ses planı — hepsi aynı tick içinde başlar.
    //    Sıra: önce chrome'u gizle + animation tetikle, sonra recorder,
    //    sonra ses. Böylece kayıt frame 0'dan, ses 0. saniyeden, ekran
    //    tamamen temiz başlar (top bar, bottom timeline ve status YOK).
    document.documentElement.setAttribute("data-play", "1");
    document.documentElement.setAttribute("data-recording", "1");
    recorder.start(250);
    scheduleSoundtrack(ctx, recDest);

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
  // Kayıt sırasında HİÇBİR overlay yok — temiz video çıktısı.
  // Preview sırasında (sadece kullanıcı izliyor, paylaşılmıyor) progress
  // bar gösterilir ki user "ne kadar kaldı" görsün.
  if (phase === "recording") {
    return null;
  }
  if (phase === "playing") {
    // Preview için progress bar — ui-chrome class'ı YOK çünkü kullanıcının
    // ne kadar kaldığını görmesi gerekiyor. Recording'de zaten null döner.
    return (
      <div className="pointer-events-none fixed bottom-12 left-1/2 z-30 -translate-x-1/2">
        <div className="flex items-center gap-3 rounded-full border border-[rgba(120,80,50,0.4)] bg-[#0d0b0a]/85 px-4 py-2 backdrop-blur">
          <span aria-hidden className="size-2 rounded-full bg-[#9bd07e]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-[#bdb4a6]">
            oynatılıyor
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
