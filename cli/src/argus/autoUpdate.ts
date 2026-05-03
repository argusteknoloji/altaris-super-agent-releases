/**
 *  Background auto-update for the Altaris CLI.
 *
 *  Akış:
 *    - Her başlangıçta `maybeAutoUpdate()` fire-and-forget çağrılır.
 *    - Son check 24 saatten yakınsa veya kullanıcı kapattıysa skip.
 *    - Yeni release varsa binary indirilir + atomik replace edilir
 *      (Bun-compiled binary'lerin inode'u korunur, çalışan process bozulmaz).
 *    - Sonraki başlangıçta `showAutoUpdateBanner()` küçük bir bildirim gösterir.
 *
 *  Kullanıcı kontrolü:
 *    - Global config'de `autoUpdate: false` setlenince devre dışı.
 *    - `altaris update --force` ile her zaman manuel tetiklenir.
 */

import { performGithubUpdate } from "../utils/githubReleaseUpdater.js";
import { getGlobalConfig, saveGlobalConfig } from "../utils/config.js";

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const STARTUP_DELAY_MS  = 3000;                // 3s — başlangıç UX'ini bozma
const RELEASES_REPO     = "argusteknoloji/altaris-super-agent-releases";

/**
 *  Fire-and-forget — caller `void maybeAutoUpdate()` çağırır, blocklamaz.
 *  Hatalar tamamen sessiz; kullanıcı bunu fark etmemeli.
 */
export function maybeAutoUpdate(currentVersion: string): void {
  setTimeout(() => { void runCheck(currentVersion); }, STARTUP_DELAY_MS);
}

async function runCheck(currentVersion: string): Promise<void> {
  try {
    const config = getGlobalConfig() as Record<string, unknown>;
    if (config.autoUpdate === false) return;
    const last = (config.autoUpdateLastCheckMs as number | undefined) ?? 0;
    const now = Date.now();
    if (now - last < CHECK_INTERVAL_MS) return;

    // Sadece release tag check — binary download'a gitmeden önce hızlı eleme
    const tagRes = await fetch(
      `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`,
      { headers: { Accept: "application/vnd.github+json", "User-Agent": "altaris-cli-autoupdate" } }
    ).catch(() => null);
    if (!tagRes || !tagRes.ok) return;
    const meta = await tagRes.json().catch(() => null);
    if (!meta || typeof meta.tag_name !== "string") return;

    // Last check'i SET et (network ulaştı)
    saveGlobalConfig(c => ({ ...c, autoUpdateLastCheckMs: now } as Record<string, unknown>));

    // Tag'in normalize edilmiş hali ile current'i karşılaştır
    const remoteVer = meta.tag_name.replace(/^v/, "");
    const localVer  = currentVersion.replace(/^v/, "");
    if (remoteVer === localVer) return; // güncel

    // Yeni versiyon var → indirme + replace
    const result = await performGithubUpdate(currentVersion);
    if (result.kind === "updated") {
      saveGlobalConfig(c => ({
        ...c,
        autoUpdateNotice: { from: result.from, to: result.to, ts: now },
      } as Record<string, unknown>));
    }
  } catch {
    // Sessizce yut — auto-update asla user-visible hata vermemeli
  }
}

/**
 *  Önceki çalıştırmada auto-update yapıldıysa kullanıcıya kısa bilgi gösterir.
 *  Bayrak gösterildikten sonra silinir.
 */
export function showAutoUpdateBanner(): void {
  try {
    const config = getGlobalConfig() as Record<string, unknown>;
    const notice = config.autoUpdateNotice as { from: string; to: string } | undefined;
    if (!notice) return;
    process.stdout.write(`\n  ✓ Altaris ${notice.from} → ${notice.to} otomatik güncellendi\n\n`);
    saveGlobalConfig(c => {
      const cc = { ...c } as Record<string, unknown>;
      delete cc.autoUpdateNotice;
      return cc;
    });
  } catch { /* ignore */ }
}
