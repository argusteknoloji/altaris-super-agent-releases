#!/usr/bin/env bun
/**
 * Tek senaryo kaydı — isolated process.
 * Outer loop her senaryo için bu script'i spawn eder, sıfır state birikimi.
 *
 * Kullanım:
 *   bun run scripts/record-one-scenario.ts <url> <slug> <vault_dir>
 */

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, copyFileSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";

const [, , URL_PATH, SLUG, VAULT_DIR, LANG_RAW] = process.argv;
if (!URL_PATH || !SLUG || !VAULT_DIR) {
  console.error("usage: bun record-one-scenario.ts <url-path> <slug> <vault-dir> [lang]");
  console.error("  lang: 'tr' (default) or 'en' — affects public/scenarios subdirectory and vault filename suffix");
  process.exit(2);
}
const LANG = (LANG_RAW === "en" ? "en" : "tr") as "tr" | "en";

const BASE = process.env.SENARYO_BASE ?? "http://localhost:3000";
const WIDTH = parseInt(process.env.WIDTH ?? "1920", 10);
const HEIGHT = parseInt(process.env.HEIGHT ?? "1080", 10);
const RECORD_S = parseFloat(process.env.RECORD_S ?? "22.5");

const tmpDir = `/tmp/altaris-record-${SLUG}-${Date.now()}`;
mkdirSync(tmpDir, { recursive: true });

function muxToMp4(silent: string, audio: string, out: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-y",
      "-i", silent, "-i", audio,
      "-c:v", "libx264",
      "-preset", "slow",
      "-crf", "16",
      "-pix_fmt", "yuv420p",
      "-tune", "film",
      "-x264-params", "keyint=60:min-keyint=60",
      "-c:a", "aac", "-b:a", "256k",
      "-shortest",
      "-movflags", "+faststart",
      out,
    ], { stdio: "inherit" });
    ff.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))));
    ff.on("error", reject);
  });
}

(async () => {
  const t0 = Date.now();
  console.log(`▸ ${SLUG}  (${URL_PATH})`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
    recordVideo: { dir: tmpDir, size: { width: WIDTH, height: HEIGHT } },
  });
  const page = await context.newPage();

  // Render hatalarını yakala
  page.on("pageerror", (e) => console.error("page error:", e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error("console error:", msg.text());
  });

  await page.goto(`${BASE}${URL_PATH}?autoplay=1`, { waitUntil: "networkidle", timeout: 30000 });
  await page.mouse.click(WIDTH / 2, HEIGHT / 2);
  await page.waitForTimeout(150);

  console.log(`  ⏱  ${RECORD_S}sn animasyon`);
  await page.waitForTimeout(RECORD_S * 1000);

  // Audio render — büyük base64 transfer'i bypass etmek için window'a tek
  // string field expose edip o'nu polling ile getValue() ile çekelim. Burada
  // direkt evaluate kullanıyoruz; senaryo başına ~5 MB string transfer.
  console.log(`  🎵 audio render...`);
  // 60 saniye limit — daha uzunsa sonsuz döngü demektir
  const renderPromise = page.evaluate(async () => {
    const fn = (window as unknown as { __altarisRenderAudio?: () => Promise<string> }).__altarisRenderAudio;
    if (!fn) throw new Error("__altarisRenderAudio yok");
    return await fn();
  });
  const audioBase64 = await Promise.race([
    renderPromise,
    new Promise<string>((_, rej) => setTimeout(() => rej(new Error("audio render timeout 60s")), 60_000)),
  ]);

  const wavPath = join(tmpDir, "audio.wav");
  writeFileSync(wavPath, Buffer.from(audioBase64, "base64"));
  console.log(`  ✓ wav (${(Buffer.byteLength(audioBase64, "base64") / 1024 / 1024).toFixed(2)} MB)`);

  await page.close();
  await context.close();
  await browser.close();

  const videoFile = readdirSync(tmpDir).find((f) => f.endsWith(".webm"));
  if (!videoFile) throw new Error("video webm bulunamadı");
  const silentPath = join(tmpDir, videoFile);

  const mp4Local = join(tmpDir, `${SLUG}.mp4`);
  console.log(`  🎬 mux → mp4`);
  await muxToMp4(silentPath, wavPath, mp4Local);

  // Vault: TR is "<slug>.mp4", EN is "<slug>-en.mp4" (avoid overwriting TR)
  const vaultName = LANG === "en" ? `${SLUG}-en.mp4` : `${SLUG}.mp4`;
  const mp4Vault = join(VAULT_DIR, vaultName);
  copyFileSync(mp4Local, mp4Vault);

  // Repo public assets — TR: public/scenarios/<slug>.mp4
  //                       EN: public/scenarios/en/<slug>.mp4
  const publicSubdir = LANG === "en" ? join("public", "scenarios", "en") : join("public", "scenarios");
  mkdirSync(publicSubdir, { recursive: true });
  const mp4Public = join(publicSubdir, `${SLUG}.mp4`);
  try {
    copyFileSync(mp4Local, mp4Public);
    console.log(`  ✓ ${mp4Public}`);
  } catch (e) {
    console.warn(`  ⚠ public copy skipped: ${(e as Error).message}`);
  }

  // cleanup
  rmSync(tmpDir, { recursive: true, force: true });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  ✓ ${mp4Vault} (${elapsed}s)\n`);
  process.exit(0);
})().catch((e) => {
  console.error(`✗ ${SLUG}: ${e.message}`);
  // Cleanup
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  process.exit(1);
});
