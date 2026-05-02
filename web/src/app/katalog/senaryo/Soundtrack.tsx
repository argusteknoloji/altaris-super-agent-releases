"use client";

// ──────────────────────────────────────────────────────────────────────────
// Senaryo soundtrack — 22 saniyelik prosedürel cinematic ambient.
// Web Audio API kullanır; harici dosya yok, telif sorunu yok.
//
// Sahnelerle senkron:
//   0–3s   düşük drone (D minor pad) + alçak gerilim
//   3–6s   pad sürer · "tick"ler ("sorular")
//   6–9s   filtre süpürmesi · alçak gizem
//   9–15s  drone azalır · risk kartları için kısa puls'lar
//   15–18s yükselen arpej (reveal)
//   18–22s warm major chord (resolve)
//
// Tarayıcı autoplay politikası: Chrome/Safari tab focused + user gesture
// gerektirir. Playwright `--autoplay-policy=no-user-gesture-required`
// flag'i ile bypass edilir; manuel açılışta bir kez sayfaya tıklamak
// kafidir (hint UI'da gösterilir).
// ──────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";

const D_FREQ = 73.42;          // D2 (kök)
const A_FREQ = 110.0;           // A2 (5'li)
const F_FREQ = 87.31;           // F2 (m3)
const HIGH_C = 523.25;          // C5
const HIGH_E = 659.25;          // E5
const HIGH_G = 783.99;          // G5

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

export function Soundtrack() {
  const [armed, setArmed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  // Once audio context is allowed (after click/keydown), start playing.
  useEffect(() => {
    if (!armed || playing) return;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    ctxRef.current = ctx;

    const t0 = ctx.currentTime;
    const master = gain(ctx, 0);
    master.connect(ctx.destination);
    master.gain.setValueAtTime(0, t0);
    master.gain.linearRampToValueAtTime(0.5, t0 + 0.6);

    // ── 1) Drone pad — sürekli, hafif sweeped lowpass ─────────────────
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

    // ── 2) Sahne 2 — soru tick'leri (3.0s, 3.6s) ─────────────────────
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

    // ── 3) Sahne 3 — typing/keystroke ticks ──────────────────────────
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

    // ── 4) Sahne 3 sonu — brain pulse boom ───────────────────────────
    const brainAt = t0 + 8.3;
    const brainOsc = osc(ctx, D_FREQ / 2, "sine");
    const brainG = gain(ctx, 0);
    brainOsc.connect(brainG).connect(master);
    brainG.gain.setValueAtTime(0, brainAt);
    brainG.gain.linearRampToValueAtTime(0.4, brainAt + 0.05);
    brainG.gain.exponentialRampToValueAtTime(0.0001, brainAt + 1.4);
    brainOsc.start(brainAt);
    brainOsc.stop(brainAt + 1.5);

    // ── 5) Sahne 4 — risk kartı pop (3 ad.) ──────────────────────────
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

    // ── 6) Sahne 5 — yükselen arpej (15.4s) ──────────────────────────
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

    // ── 7) ALTARIS theme motif — kurumsal imza melodisi ─────────────
    // 4 nota, D-major pentatonic, yükselen majör his.
    // Sahne 1'in başında 0.4s'de bir kez "hint" (yumuşak),
    // Sahne 6'da (18s) full forte ile resolve.
    const themeNotes = [293.66, 369.99, 440.0, 587.33]; // D4 · F#4 · A4 · D5
    const playTheme = (startAt: number, peakGain: number, voice: OscillatorType = "triangle") => {
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
    // Hint (sahne 1) — kullanıcı zar zor duyar, ama bilinçaltına yerleşir
    playTheme(t0 + 0.4, 0.04, "sine");
    // Full resolve (sahne 6)
    playTheme(t0 + 18.1, 0.13, "triangle");

    // Warm pad chord under the resolve theme
    const resolveAt = t0 + 18;
    const chord = [D_FREQ * 2, F_FREQ * 2 + 12, A_FREQ * 2]; // D-F#-A approx
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

    // ── master fade out ──────────────────────────────────────────────
    master.gain.setValueAtTime(0.5, t0 + 21);
    master.gain.linearRampToValueAtTime(0, t0 + 22);

    setPlaying(true);

    return () => {
      void ctx.close();
    };
  }, [armed, playing]);

  // Auto-arm on first user interaction (Playwright also dispatches a click).
  useEffect(() => {
    if (armed) return;
    const arm = () => setArmed(true);
    window.addEventListener("click", arm, { once: true });
    window.addEventListener("keydown", arm, { once: true });
    // On Playwright with --autoplay-policy bypass, schedule a programmatic
    // arm shortly after mount so video capture starts cleanly.
    const t = setTimeout(arm, 80);
    return () => {
      window.removeEventListener("click", arm);
      window.removeEventListener("keydown", arm);
      clearTimeout(t);
    };
  }, [armed]);

  if (playing) return null;

  return (
    <button
      type="button"
      onClick={() => setArmed(true)}
      className="fixed bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-full border border-[rgba(120,80,50,0.5)] bg-[#0d0b0a] px-5 py-2 font-mono text-[10px] uppercase tracking-[0.32em] text-[#f08c50] shadow-[0_8px_30px_-8px_rgba(240,140,80,0.4)] transition-colors hover:bg-[#1a1612] hover:text-[#ffb464]"
      aria-label="Sesi aç ve oynat"
    >
      ▸ sesi aç · 22 sn
    </button>
  );
}
