#!/usr/bin/env bun
/**
 * Batch outer loop — her senaryo için ayrı `bun record-one-scenario.ts`
 * process'i spawn eder. State birikimi sıfır, izole.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const VAULT_DIR = "/Users/burakdemirsoy/.claude/vaults/claude-obsidian/videos/altaris_scenarios";
const SCRIPT = "scripts/record-one-scenario.ts";

const SCENARIOS: Array<{ url: string; slug: string; label: string }> = [
  { url: "/katalog/senaryo",    slug: "01-yonetici-sabahi", label: "Yönetici Sabahı" },
  { url: "/katalog/senaryo/2",  slug: "02-gece-krizi",       label: "Gecenin Kontrolü" },
  { url: "/katalog/senaryo/3",  slug: "03-boardroom",         label: "Boardroom" },
  { url: "/katalog/senaryo/4",  slug: "04-ilk-gun",           label: "İlk Gün" },
  { url: "/katalog/senaryo/5",  slug: "05-10dk-kala",         label: "10 Dakika Kala" },
  { url: "/katalog/senaryo/6",  slug: "06-imza-oncesi",       label: "İmza Öncesi" },
  { url: "/katalog/senaryo/7",  slug: "07-sessiz-cikis",      label: "Sessiz Çıkış" },
  { url: "/katalog/senaryo/8",  slug: "08-q4-hedefi",         label: "Q4 Hedefi" },
  { url: "/katalog/senaryo/9",  slug: "09-yatirim-karari",    label: "5 Milyon Dolar" },
  { url: "/katalog/senaryo/10", slug: "10-denetim-hazir",     label: "Denetim Hazır" },
  { url: "/katalog/senaryo/11", slug: "11-yesil-sinir",       label: "Yeşil Sınır · Carbon-Labs" },
  { url: "/katalog/senaryo/12", slug: "12-meb-brifi",          label: "Bakanlık Brifi · İGYS" },
  { url: "/katalog/senaryo/13", slug: "13-yonerge-gecisi",     label: "Yönerge Geçişi · 2247" },
  { url: "/katalog/senaryo/showcase", slug: "00-showcase",      label: "Platform Showcase" },
];

mkdirSync(VAULT_DIR, { recursive: true });

function runOne(s: typeof SCENARIOS[number]): Promise<boolean> {
  return new Promise((resolve) => {
    // Hard timeout — 90 saniye. Sürekli senaryolar için fazlasıyla yeterli.
    // Eğer aşılırsa SIGKILL ile öldür, true dönmesin.
    const child = spawn("bun", ["run", SCRIPT, s.url, s.slug, VAULT_DIR], {
      stdio: "inherit",
      env: { ...process.env },
    });
    const t = setTimeout(() => {
      console.error(`⏱  ${s.slug} — 90s timeout, kill`);
      child.kill("SIGKILL");
      resolve(false);
    }, 90_000);
    child.on("exit", (code) => {
      clearTimeout(t);
      resolve(code === 0);
    });
    child.on("error", () => {
      clearTimeout(t);
      resolve(false);
    });
  });
}

(async () => {
  const skipExisting = !process.argv.includes("--force");
  console.log(`Altaris batch · isolated processes · ${SCENARIOS.length} senaryo\n`);

  // localhost up mu?
  try {
    const r = await fetch("http://localhost:3000");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch {
    console.error("✗ Web sunucusuna ulaşılamadı — docker compose up -d web");
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < SCENARIOS.length; i++) {
    const s = SCENARIOS[i];
    const target = join(VAULT_DIR, `${s.slug}.mp4`);
    if (skipExisting && existsSync(target)) {
      console.log(`✓ [${i + 1}/${SCENARIOS.length}] ${s.label} — atlanıyor (zaten var)`);
      ok++;
      continue;
    }
    console.log(`\n[${i + 1}/${SCENARIOS.length}] ${s.label}`);
    const success = await runOne(s);
    if (success) {
      ok++;
    } else {
      fail++;
      console.error(`✗ ${s.label} başarısız\n`);
    }
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`  ${ok} başarılı · ${fail} başarısız`);
  console.log(`  Çıktı: ${VAULT_DIR}`);
  process.exit(fail > 0 ? 2 : 0);
})();
