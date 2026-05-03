"use client";

// ──────────────────────────────────────────────────────────────────
// Generic player + in-browser recorder — paylaşılan kontrol paneli.
// Her senaryo kendi `schedule` fonksiyonunu prop olarak geçer; bu
// component play/record state machine'i ve MediaRecorder işini yapar.
// ──────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "playing" | "recording" | "done";

/** AudioBuffer → 16-bit PCM stereo WAV → base64 string. Batch recording için. */
function audioBufferToWavBase64(buf: AudioBuffer): string {
  const numCh = buf.numberOfChannels;
  const sr = buf.sampleRate;
  const length = buf.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const byteRate = sr * blockAlign;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  const w = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  w(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  w(8, "WAVE");
  w(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);            // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);           // bits per sample
  w(36, "data");
  view.setUint32(40, dataSize, true);

  const channelData: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) channelData.push(buf.getChannelData(c));

  let offset = headerSize;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numCh; c++) {
      const sample = Math.max(-1, Math.min(1, channelData[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  // ArrayBuffer → base64
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export type ScheduleFn = (
  ctx: AudioContext,
  recordDest: MediaStreamAudioDestinationNode | null,
) => void;

interface Props {
  /** Her senaryonun kendi schedule fonksiyonu (audio compose). */
  schedule: ScheduleFn;
  /** Toplam süre (saniye). Animasyon CSS keyframe'leriyle senkron olmalı. */
  durationSec: number;
  /** Webm dosya adı prefix'i (örn. "altaris-gece-krizi"). */
  filenamePrefix: string;
  /** Buton üstünde çıkacak küçük metin (örn. "senaryo 02 · gece krizi"). */
  label?: string;
}

export function SenaryoPlayer({
  schedule,
  durationSec,
  filenamePrefix,
  label,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);

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

  useEffect(() => {
    if (phase !== "playing" && phase !== "recording") return;
    const start = performance.now();
    let raf: number;
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      setProgress(Math.min(1, elapsed / durationSec));
      if (elapsed < durationSec + 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, durationSec]);

  function newCtx(): AudioContext {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    return new Ctor();
  }

  // Batch recording için: ?autoplay=1 paramı ile sayfa açılınca animasyon
  // otomatik başlasın. Ayrıca window.__altarisRender* fonksiyonları Playwright
  // tarafından çağrılarak offline audio rendering yapılabilir.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1) Window'a render API'leri expose et
    (window as unknown as { __altarisRenderAudio?: () => Promise<string> }).__altarisRenderAudio = async () => {
      // OfflineAudioContext ile aynı schedule fn'i headless şekilde render
      const sr = 44100;
      const off = new OfflineAudioContext({
        numberOfChannels: 2,
        sampleRate: sr,
        length: Math.ceil(sr * (durationSec + 0.5)),
      });
      // recordDest yerine offline ctx'in destination'ı kullanılır
      schedule(off as unknown as AudioContext, null);
      const buf = await off.startRendering();
      // 16-bit PCM stereo WAV'a paketle
      return audioBufferToWavBase64(buf);
    };
    (window as unknown as { __altarisDuration?: number }).__altarisDuration = durationSec;

    // 2) Autoplay param ile başla
    const params = new URLSearchParams(window.location.search);
    if (params.get("autoplay") === "1") {
      const t = setTimeout(() => {
        void startPreview();
      }, 200);
      return () => clearTimeout(t);
    }
  }, [schedule, durationSec]);

  async function startPreview() {
    if (ctxRef.current) {
      await ctxRef.current.close();
      ctxRef.current = null;
    }
    const ctx = newCtx();
    await ctx.resume();
    ctxRef.current = ctx;
    document.documentElement.setAttribute("data-play", "1");
    schedule(ctx, null);
    setPhase("playing");
    setTimeout(() => setPhase("done"), durationSec * 1000 + 500);
  }

  async function startRecording() {
    let display: MediaStream;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
        // @ts-expect-error preferCurrentTab is a Chrome flag
        preferCurrentTab: true,
      });
    } catch {
      alert("Ekran paylaşımı iptal edildi. Tekrar dene ve bu sekmeyi seç.");
      return;
    }

    if (ctxRef.current) {
      await ctxRef.current.close();
      ctxRef.current = null;
    }
    const ctx = newCtx();
    await ctx.resume();
    ctxRef.current = ctx;
    const recDest = ctx.createMediaStreamDestination();

    const audioTrack = recDest.stream.getAudioTracks()[0];
    const videoTrack = display.getVideoTracks()[0];
    const combined = new MediaStream([videoTrack, audioTrack]);

    const recorder = new MediaRecorder(combined, {
      mimeType: "video/webm;codecs=vp9,opus",
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
      a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.webm`;
      a.click();
      display.getTracks().forEach((t) => t.stop());
      setPhase("done");
    };

    document.documentElement.setAttribute("data-play", "1");
    document.documentElement.setAttribute("data-recording", "1");
    recorder.start(250);
    schedule(ctx, recDest);
    setPhase("recording");

    setTimeout(() => {
      try { recorder.stop(); } catch { /* already stopped */ }
    }, durationSec * 1000 + 600);
  }

  function reset() {
    void ctxRef.current?.close();
    ctxRef.current = null;
    setPhase("idle");
    setProgress(0);
  }

  // Fullscreen toggle — mobile + desktop. iOS Safari div fullscreen'i sınırlı
  // destekler; o nedenle bir CSS fallback class'ı (data-pseudo-fullscreen)
  // ekliyoruz: viewport'u tam dolduran fixed pozisyonlu mod.
  async function toggleFullscreen() {
    const root = document.documentElement;
    // Önce native API'yi dene
    const isFs = !!document.fullscreenElement ||
      !!(document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement;
    try {
      if (!isFs) {
        if (root.requestFullscreen) {
          await root.requestFullscreen();
        } else {
          const wk = root as unknown as { webkitRequestFullscreen?: () => Promise<void> };
          if (wk.webkitRequestFullscreen) await wk.webkitRequestFullscreen();
          else throw new Error("not supported");
        }
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else {
          const wk = document as unknown as { webkitExitFullscreen?: () => Promise<void> };
          if (wk.webkitExitFullscreen) await wk.webkitExitFullscreen();
        }
      }
    } catch {
      // iOS Safari fallback — pseudo-fullscreen via CSS attribute
      const cur = root.getAttribute("data-pseudo-fullscreen");
      if (cur === "1") root.removeAttribute("data-pseudo-fullscreen");
      else root.setAttribute("data-pseudo-fullscreen", "1");
    }
  }

  if (phase === "recording") return null;

  if (phase === "playing") {
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
            {Math.floor(progress * durationSec)} / {durationSec}s
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-12 left-1/2 z-30 -translate-x-1/2 max-w-[95vw]">
      <div className="flex flex-col items-center gap-2">
        {label && (
          <div className="font-mono text-[9px] uppercase tracking-[0.32em] text-[#7a7166]">
            {label}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-md border border-[rgba(120,80,50,0.4)] bg-[#0d0b0a]/90 p-1.5 backdrop-blur shadow-[0_8px_30px_-8px_rgba(240,140,80,0.4)]">
          <button
            type="button"
            onClick={startPreview}
            className="rounded-sm px-4 py-2 font-mono text-[10px] uppercase tracking-[0.32em] text-[#ddd8d0] transition-colors hover:bg-[#1a1612] hover:text-[#ffb464]"
          >
            ▸ oynat · {durationSec}sn
          </button>
          <span aria-hidden className="h-5 w-px bg-[rgba(120,80,50,0.4)]" />
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-sm px-3 py-2 font-mono text-[10px] uppercase tracking-[0.32em] text-[#bdb4a6] transition-colors hover:bg-[#1a1612] hover:text-[#ffb464]"
            aria-label="Tam ekran"
            title="Tam ekran"
          >
            ⛶ tam ekran
          </button>
          <span aria-hidden className="hidden h-5 w-px bg-[rgba(120,80,50,0.4)] sm:block" />
          <button
            type="button"
            onClick={startRecording}
            className="group rounded-sm bg-[#f08c50] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.32em] text-[#0a0908] transition-colors hover:bg-[#ffb464]"
            title="Tarayıcı 'paylaşılacak içerik' soracak — bu sekmeyi seç"
          >
            🎬 video kaydet
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
    </div>
  );
}
