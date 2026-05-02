#!/usr/bin/env bun
/**
 * Senaryo kayıt scripti.
 *
 * Akış:
 *   1. Playwright headed Chromium başlatır (--autoplay-policy=no-user-gesture-required)
 *   2. /katalog/senaryo açılır, sayfa 22 sn'lik animasyonu başlatır
 *   3. Page Web Audio API ile cinematic ambient üretir (hoparlöre)
 *   4. ffmpeg avfoundation ile EKRAN + SİSTEM SESİ yakalanır → mp4
 *
 * macOS gereği:
 *   - Sistem sesini ffmpeg'in görmesi için BlackHole 2ch kurulu olmalı:
 *       brew install blackhole-2ch
 *     ardından System Settings → Sound → Output: "Multi-Output Device"
 *     (BlackHole 2ch + hoparlör birleşik), veya direkt BlackHole 2ch.
 *   - ffmpeg `-list_devices true` ile cihaz indekslerini gör:
 *       ffmpeg -f avfoundation -list_devices true -i ""
 *
 * Çıktı: tmp/altaris-senaryo.mp4 (~3-5 MB)
 */

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";

const URL = process.env.SENARYO_URL ?? "http://localhost:3000/katalog/senaryo";
const VIDEO_DEVICE = process.env.AVF_VIDEO ?? "1";        // ekran (Capture screen 0 = "1")
const AUDIO_DEVICE = process.env.AVF_AUDIO ?? "0";        // BlackHole 2ch — `-list_devices` ile teyit et
const DURATION_S = 24;                                     // 22sn animasyon + 2sn buffer
const OUT_DIR = "tmp";
const OUT_FILE = `${OUT_DIR}/altaris-senaryo.mp4`;

// macOS Retina çift çözünürlük; logical 1280x800'a karşılık fiziksel 2560x1600
const FRAME_W = 1280;
const FRAME_H = 800;

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR);

console.log(`[senaryo] kaynak: ${URL}`);
console.log(`[senaryo] çıktı:  ${OUT_FILE}`);
console.log(`[senaryo] ffmpeg avf video=${VIDEO_DEVICE} audio=${AUDIO_DEVICE} · ${DURATION_S}s`);

// ── 1) Tarayıcıyı sahnele ──────────────────────────────────────────
const browser = await chromium.launch({
  headless: false,
  args: [
    "--autoplay-policy=no-user-gesture-required",
    "--disable-features=IsolateOrigins,site-per-process",
    `--window-size=${FRAME_W},${FRAME_H}`,
    "--window-position=0,0",
  ],
});
const ctx = await browser.newContext({
  viewport: { width: FRAME_W, height: FRAME_H },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
// İlk programatik tıklama Web Audio'yu arm eder.
await page.mouse.click(FRAME_W / 2, FRAME_H / 2);
await page.waitForTimeout(150);

// ── 2) ffmpeg ile ekran + ses kaydı (paralel) ─────────────────────
//   -framerate 30
//   -capture_cursor 0
//   -capture_mouse_clicks 0
//   -pix_fmt yuv420p (mp4 uyumu için)
const ff = spawn(
  "ffmpeg",
  [
    "-y",
    "-f", "avfoundation",
    "-framerate", "30",
    "-capture_cursor", "0",
    "-capture_mouse_clicks", "0",
    "-i", `${VIDEO_DEVICE}:${AUDIO_DEVICE}`,
    "-t", String(DURATION_S),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "160k",
    OUT_FILE,
  ],
  { stdio: "inherit" },
);

await new Promise<void>((resolve, reject) => {
  ff.on("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`ffmpeg exited ${code}`));
  });
  ff.on("error", reject);
});

await ctx.close();
await browser.close();

console.log(`\n[senaryo] ✓ tamamlandı: ${OUT_FILE}`);
console.log("[senaryo] dağıtım için:");
console.log("  - WhatsApp/Telegram'a olduğu gibi yolla (mp4 native destekli)");
console.log("  - GIF gerekirse: gifski --fps 18 -o senaryo.gif tmp/altaris-senaryo.mp4");
