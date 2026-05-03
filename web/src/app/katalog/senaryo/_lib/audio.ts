// ──────────────────────────────────────────────────────────────────
// Senaryo audio primitives — paylaşılan Web Audio yardımcıları.
// Her senaryo kendi `schedule(ctx, master)` fonksiyonunu yazar; bu
// dosyadaki helper'ları çağırarak kolayca müzik kurar.
// ──────────────────────────────────────────────────────────────────

export function osc(ctx: AudioContext, freq: number, type: OscillatorType = "sine") {
  const o = ctx.createOscillator();
  o.frequency.value = freq;
  o.type = type;
  return o;
}

export function gain(ctx: AudioContext, value = 0) {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

/** 808-tarzı sub-kick — 130Hz→50Hz pitch envelope, hızlı decay. */
export function heartbeat(
  ctx: AudioContext,
  master: AudioNode,
  at: number,
  peak: number,
  pitchFrom = 130,
  pitchTo = 50,
  decay = 0.32,
) {
  const o = osc(ctx, pitchFrom, "sine");
  const g = gain(ctx, 0);
  o.connect(g).connect(master);
  o.frequency.setValueAtTime(pitchFrom, at);
  o.frequency.exponentialRampToValueAtTime(pitchTo, at + 0.12);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  o.start(at);
  o.stop(at + decay + 0.05);
}

/** Piano-bell hit (sin + 2nd harmonic, exponential decay). */
export function bell(
  ctx: AudioContext,
  master: AudioNode,
  at: number,
  freq: number,
  peak: number,
  decay: number,
  harmonic2Mix = 0.3,
) {
  const o = osc(ctx, freq, "sine");
  const o2 = osc(ctx, freq * 2, "sine");
  const o2g = gain(ctx, harmonic2Mix);
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
}

/** Sustained pad — multi-voice sine, gain envelope ile şekillenir. */
export function pad(
  ctx: AudioContext,
  master: AudioNode,
  at: number,
  duration: number,
  freqs: number[],
  envelope: Array<[number, number]>, // [zaman_saniye, gain] noktaları
  type: OscillatorType = "sine",
): GainNode {
  const padG = gain(ctx, 0);
  padG.connect(master);
  freqs.forEach((freq) => {
    const o = osc(ctx, freq, type);
    o.connect(padG);
    o.start(at);
    o.stop(at + duration);
  });
  envelope.forEach(([t, v], i) => {
    if (i === 0) padG.gain.setValueAtTime(v, at + t);
    else padG.gain.linearRampToValueAtTime(v, at + t);
  });
  return padG;
}

/** White noise → bandpass sweep (tension build). */
export function sweep(
  ctx: AudioContext,
  master: AudioNode,
  at: number,
  duration: number,
  fromHz: number,
  toHz: number,
  peak: number,
  Q = 3,
) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * (duration + 0.3), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = Q;
  f.frequency.setValueAtTime(fromHz, at);
  f.frequency.exponentialRampToValueAtTime(toHz, at + duration);
  const g = gain(ctx, 0);
  src.connect(f).connect(g).connect(master);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + duration * 0.7);
  g.gain.linearRampToValueAtTime(0.0001, at + duration);
  src.start(at);
  src.stop(at + duration + 0.1);
}

/** Slow LFO modulation on a target AudioParam. */
export function lfo(
  ctx: AudioContext,
  target: AudioParam,
  freq: number,
  amplitude: number,
  duration: number,
  startAt: number,
) {
  const o = osc(ctx, freq, "sine");
  const a = gain(ctx, amplitude);
  o.connect(a).connect(target);
  o.start(startAt);
  o.stop(startAt + duration);
}

/** Master gain helper — fade in + fade out timing. */
export function masterEnv(
  ctx: AudioContext,
  recordDest: MediaStreamAudioDestinationNode | null,
  opts: {
    peak: number;
    fadeInSec?: number;
    holdUntilSec?: number;
    fadeOutSec?: number;
    totalDur: number;
  },
): GainNode {
  const t0 = ctx.currentTime;
  const m = gain(ctx, 0);
  m.connect(ctx.destination);
  if (recordDest) m.connect(recordDest);
  const fadeIn = opts.fadeInSec ?? 0.5;
  const holdUntil = opts.holdUntilSec ?? opts.totalDur - 1;
  const fadeOut = opts.fadeOutSec ?? 1;
  m.gain.setValueAtTime(0, t0);
  m.gain.linearRampToValueAtTime(opts.peak, t0 + fadeIn);
  m.gain.setValueAtTime(opts.peak, t0 + holdUntil);
  m.gain.linearRampToValueAtTime(0, t0 + holdUntil + fadeOut);
  return m;
}

export const NOTES = {
  // D minor / D major reference
  D2: 73.42, A2: 110.00, F2: 87.31,
  D3: 146.83, A3: 220.00, F3: 174.61, E3: 164.81, C3: 130.81, G3: 196.00, B2: 123.47,
  C4: 261.63, D4: 293.66, F4: 349.23, A4: 440.00, G4: 392.00, "F#4": 369.99, "C#4": 277.18, "G#4": 415.30, "D#4": 311.13, B3: 246.94, E4: 329.63,
  D5: 587.33, A5: 880.00, C5: 523.25, E5: 659.25, G5: 783.99, "F#5": 739.99,
  D6: 1174.66, C6: 1046.50,
};
