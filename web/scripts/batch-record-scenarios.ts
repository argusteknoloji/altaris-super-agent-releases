#!/usr/bin/env bun
/**
 * Batch scenario recorder.
 *
 * Her senaryo için:
 *   1. Playwright Chromium aç (recordVideo: true), URL'e ?autoplay=1 ekle
 *   2. Sayfa açılır, otomatik animasyon başlar (kayıt da başlar)
 *   3. 23 saniye bekle (22sn animasyon + 1sn buffer)
 *   4. window.__altarisRenderAudio() çağır → base64 WAV al
 *   5. Page kapat → Playwright sessiz webm video kaydeder
 *   6. ffmpeg ile silent video + WAV → MP4 (H.264 + AAC) mux
 *   7. Çıktıyı vault'a kopyala
 *
 * Çıktı dizini:
 *   ~/.claude/vaults/claude-obsidian/videos/altaris_scenarios/
 */

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, copyFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.SENARYO_BASE ?? "http://localhost:3000";
const VAULT_DIR = "/Users/burakdemirsoy/.claude/vaults/claude-obsidian/videos/altaris_scenarios";
const TMP_DIR = "tmp/batch-recordings";
const RECORD_S = 22.5;
const RENDER_TIMEOUT_S = 26;
const WIDTH = parseInt(process.env.WIDTH ?? "1920", 10);
const HEIGHT = parseInt(process.env.HEIGHT ?? "1080", 10);

const SCENARIOS: Array<{ url: string; slug: string; label: string }> = [
  { url: "/katalog/senaryo",     slug: "01-yonetici-sabahi", label: "Yönetici Sabahı" },
  { url: "/katalog/senaryo/2",   slug: "02-gece-krizi",       label: "Gecenin Kontrolü" },
  { url: "/katalog/senaryo/3",   slug: "03-boardroom",         label: "Boardroom" },
  { url: "/katalog/senaryo/4",   slug: "04-ilk-gun",           label: "İlk Gün" },
  { url: "/katalog/senaryo/5",   slug: "05-10dk-kala",         label: "10 Dakika Kala" },
  { url: "/katalog/senaryo/6",   slug: "06-imza-oncesi",       label: "İmza Öncesi" },
  { url: "/katalog/senaryo/7",   slug: "07-sessiz-cikis",      label: "Sessiz Çıkış" },
  { url: "/katalog/senaryo/8",   slug: "08-q4-hedefi",         label: "Q4 Hedefi" },
  { url: "/katalog/senaryo/9",   slug: "09-yatirim-karari",    label: "5 Milyon Dolar" },
  { url: "/katalog/senaryo/10",  slug: "10-denetim-hazir",     label: "Denetim Hazır" },
  { url: "/katalog/senaryo/11",  slug: "11-yesil-sinir",       label: "Yeşil Sınır · Carbon-Labs" },
  { url: "/katalog/senaryo/12",  slug: "12-aksam-vardiyasi",   label: "Akşam Vardiyası · Sağlık" },
  { url: "/katalog/senaryo/13",  slug: "13-hat-durusu",        label: "Hat Duruşu · Üretim" },
  { url: "/katalog/senaryo/14",  slug: "14-davaya-24-saat",    label: "Davaya 24 Saat · Hukuk" },
  { url: "/katalog/senaryo/15",  slug: "15-komite-sabahi",     label: "Komite Sabahı · Bankacılık" },
  { url: "/katalog/senaryo/16",  slug: "16-konteyner-gecikmesi", label: "Konteyner Gecikmesi · Lojistik" },
];

mkdirSync(TMP_DIR, { recursive: true });
mkdirSync(VAULT_DIR, { recursive: true });

function muxToMp4(silentVideoPath: string, audioWavPath: string, mp4Path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i", silentVideoPath,
      "-i", audioWavPath,
      "-c:v", "libx264",
      "-preset", "slow",                // daha yavaş encode, daha küçük + daha kaliteli
      "-crf", "16",                      // 20 → 16: daha az kayıp (visually lossless)
      "-pix_fmt", "yuv420p",
      "-tune", "film",                   // animasyon içerik için optimize
      "-x264-params", "keyint=60:min-keyint=60",  // saniyede 1 keyframe
      "-c:a", "aac",
      "-b:a", "256k",                    // 192k → 256k
      "-shortest",
      "-movflags", "+faststart",
      mp4Path,
    ];
    const ff = spawn("ffmpeg", args, { stdio: "inherit" });
    ff.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))));
    ff.on("error", reject);
  });
}

async function recordOne(scenario: { url: string; slug: string; label: string }, idx: number, total: number): Promise<void> {
  const start = Date.now();
  console.log(`\n[${idx}/${total}] ▸ ${scenario.label}`);

  // Her senaryo için ayrı tmp alt-dizin → video dosya pick'i deterministik
  const sceneTmp = join(TMP_DIR, scenario.slug);
  mkdirSync(sceneTmp, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    // Retina rendering — sayfa 2x içeride render edilir, video output normal
    // boyuta downsample edilir → metin/ince çizgiler keskin, anti-aliased.
    deviceScaleFactor: 2,
    recordVideo: {
      dir: sceneTmp,
      size: { width: WIDTH, height: HEIGHT },
    },
  });
  const page = await context.newPage();

  const fullUrl = `${BASE}${scenario.url}?autoplay=1`;
  await page.goto(fullUrl, { waitUntil: "networkidle" });
  await page.mouse.click(WIDTH / 2, HEIGHT / 2);
  await page.waitForTimeout(150);

  console.log(`     ⏱  ${RECORD_S}sn animasyon...`);
  await page.waitForTimeout(RECORD_S * 1000);

  console.log(`     🎵 audio render...`);
  const audioBase64 = await page.evaluate(async () => {
    const fn = (window as unknown as { __altarisRenderAudio?: () => Promise<string> }).__altarisRenderAudio;
    if (!fn) throw new Error("__altarisRenderAudio yok — sayfa hatası");
    return await fn();
  }, { timeout: RENDER_TIMEOUT_S * 1000 });

  const wavPath = join(sceneTmp, "audio.wav");
  writeFileSync(wavPath, Buffer.from(audioBase64, "base64"));

  await page.close();
  await context.close();
  await browser.close();

  // Bu senaryonun dizininde tek bir webm var
  const videoFiles = readdirSync(sceneTmp).filter((f) => f.endsWith(".webm"));
  if (videoFiles.length === 0) throw new Error("video webm bulunamadı");
  const silentPath = join(sceneTmp, videoFiles[0]);

  const mp4Path = join(sceneTmp, `${scenario.slug}.mp4`);
  console.log(`     🎬 mux → mp4...`);
  await muxToMp4(silentPath, wavPath, mp4Path);

  const vaultPath = join(VAULT_DIR, `${scenario.slug}.mp4`);
  copyFileSync(mp4Path, vaultPath);

  // Repo public asset directory — bu sayede commit + push videoyu da içerir
  const publicPath = join("public", "scenarios", `${scenario.slug}.mp4`);
  copyFileSync(mp4Path, publicPath);

  // Cleanup — geçici webm + wav'ı sil, mp4 vault'ta zaten var
  rmSync(sceneTmp, { recursive: true, force: true });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`     ✓ ${vaultPath} (${elapsed}s)`);
}

(async () => {
  const skipExisting = !process.argv.includes("--force");
  console.log(`Altaris senaryo batch recorder · headless · ${WIDTH}x${HEIGHT}`);
  console.log(`Hedef: ${VAULT_DIR}`);
  console.log(`Web base: ${BASE}`);

  // Eski tmp dosyalarını temizle
  if (existsSync(TMP_DIR)) {
    rmSync(TMP_DIR, { recursive: true, force: true });
  }
  mkdirSync(TMP_DIR, { recursive: true });

  // localhost up mu?
  try {
    const r = await fetch(BASE);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch {
    console.error(`\n✗ Web sunucusuna ulaşılamadı (${BASE})`);
    console.error(`  Önce çalıştır: docker compose --profile local up -d web`);
    process.exit(1);
  }

  // Skip-existing: vault'ta zaten mp4 varsa atla (--force ile bypass)
  const todo = SCENARIOS.filter((s) => {
    const vp = join(VAULT_DIR, `${s.slug}.mp4`);
    if (skipExisting && existsSync(vp)) {
      console.log(`✓ ${s.slug} — zaten var, atlanıyor`);
      return false;
    }
    return true;
  });
  console.log(`${todo.length} / ${SCENARIOS.length} senaryo kaydedilecek\n`);

  for (let i = 0; i < todo.length; i++) {
    try {
      await recordOne(todo[i], i + 1, todo.length);
    } catch (err) {
      console.error(`✗ ${todo[i].slug}: ${(err as Error).message}`);
    }
  }

  console.log(`\n✓ Tamamlandı. Çıktı: ${VAULT_DIR}`);
  // Final tmp cleanup
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
  process.exit(0);
})();
