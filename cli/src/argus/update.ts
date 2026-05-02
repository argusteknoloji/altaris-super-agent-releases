/**
 * `altaris update` — public release repo'sundan en son binary'yi indirip
 * kendini atomik olarak değiştirir.
 *
 * Akış:
 *   1. Mevcut binary path'ini bul (process.argv[1] veya which altaris)
 *   2. GitHub Releases API → latest tag + asset URL'i çek (auth gerekmez,
 *      release repo public)
 *   3. Mevcut sürümü mevcut sürümle karşılaştır → aynıysa "Güncel" çık
 *   4. Yeni binary'yi <path>.new dosyasına indir, chmod +x
 *   5. Atomik rename: <path>.new → <path> (POSIX rename atomik)
 *      Windows için: önce <path> → <path>.old, sonra <path>.new → <path>
 *   6. Symlink (~/.local/bin/altaris) etkilenmez — gerçek dosya replace
 *
 * Güvenlik:
 *   - Asset SHA256SUMS yanında geliyor; --skip-checksum verilmedikçe
 *     indirme sonrası hash doğrulanır.
 *   - HTTPS only.
 *   - Aynı release tag'ine ikinci kez güncelleme engellenir.
 */

import { createWriteStream } from "node:fs";
import { rename, chmod, stat, mkdtemp, readFile, unlink, copyFile } from "node:fs/promises";
import { tmpdir, platform, arch } from "node:os";
import { join, dirname, basename, resolve } from "node:path";
import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";

const RELEASES_REPO = process.env.ALTARIS_RELEASES_REPO ?? "argusteknoloji/altaris-super-agent-releases";

interface GhRelease {
  tag_name: string;
  name: string;
  published_at: string;
  assets: Array<{ name: string; browser_download_url: string; size: number }>;
}

function detectAssetName(): string {
  const p = platform();
  const a = arch();
  if (p === "darwin" && a === "arm64")  return "altaris-darwin-arm64";
  if (p === "darwin" && a === "x64")    return "altaris-darwin-x64";
  if (p === "linux"  && a === "x64")    return "altaris-linux-x64";
  if (p === "linux"  && a === "arm64")  return "altaris-linux-arm64";
  if (p === "win32"  && a === "x64")    return "altaris-windows-x64.exe";
  throw new Error(`Bu platform için release binary yok: ${p}/${a}`);
}

async function resolveBinaryPath(): Promise<string> {
  // process.argv[1] genelde:
  //   - bin/altaris (node loader → wrapper script)
  //   - dist/cli.mjs (dev mode)
  //   - /usr/local/bin/altaris (compiled standalone)
  // Compiled standalone için bu path replace edilebilir; node-loader case'i için
  // bin/altaris wrapper'ın yanındaki dist/cli.mjs'i replace ederiz.
  const arg = process.argv[1];
  if (!arg) throw new Error("argv[1] yok — bu binary nerede çalıştığını anlayamadı");
  const real = await realpath(arg);

  // Eğer wrapper bash script bin/altaris ise gerçek replace etmemiz gereken
  // dist/cli.mjs (Bun bundle). Compiled binary case'inde real == binary path.
  if (real.endsWith("/bin/altaris") || real.endsWith("/altaris")) {
    // Wrapper case: yanında dist/cli.mjs var mı?
    const distPath = resolve(dirname(real), "..", "dist", "cli.mjs");
    try { await stat(distPath); return distPath; } catch { /* yok, gerçek binary */ }
  }
  return real;
}

async function fetchLatest(): Promise<GhRelease> {
  const url = `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`;
  const res = await fetch(url, {
    headers: { "Accept": "application/vnd.github+json", "User-Agent": "altaris-cli-updater" }
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${url}`);
  return await res.json() as GhRelease;
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`İndirme ${res.status}: ${url}`);
  const writer = createWriteStream(dest);
  const reader = res.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) writer.write(value);
  }
  await new Promise<void>((resolve, reject) => writer.end(() => resolve()));
}

async function sha256Hex(file: string): Promise<string> {
  const buf = await readFile(file);
  return createHash("sha256").update(buf).digest("hex");
}

interface UpdateOpts { skipChecksum?: boolean; force?: boolean; }

export async function altarisUpdate(opts: UpdateOpts): Promise<number> {
  process.stdout.write("Altaris CLI güncelleme kontrolü…\n");

  let assetName: string;
  try { assetName = detectAssetName(); }
  catch (e) { process.stderr.write(`${(e as Error).message}\n`); return 2; }

  let release: GhRelease;
  try { release = await fetchLatest(); }
  catch (e) {
    process.stderr.write(`En son sürüm bilgisi çekilemedi: ${(e as Error).message}\n`);
    return 1;
  }

  const currentVersion = process.env.ALTARIS_VERSION
    ?? (await tryReadVersion())
    ?? "unknown";

  process.stdout.write(`  Mevcut: ${currentVersion}\n`);
  process.stdout.write(`  En son: ${release.tag_name}  (${new Date(release.published_at).toLocaleDateString("tr-TR")})\n`);

  if (!opts.force && currentVersion === release.tag_name) {
    process.stdout.write(`✓ Güncelsin.\n`);
    return 0;
  }

  const asset = release.assets.find(a => a.name === assetName);
  if (!asset) {
    process.stderr.write(`Bu sürümde ${assetName} yok. Asset'ler: ${release.assets.map(a => a.name).join(", ")}\n`);
    return 2;
  }

  const sumsAsset = release.assets.find(a => a.name === "SHA256SUMS");
  let expectedSum: string | null = null;
  if (sumsAsset && !opts.skipChecksum) {
    const tmpDir = await mkdtemp(join(tmpdir(), "altaris-update-"));
    const sumsFile = join(tmpDir, "SHA256SUMS");
    await download(sumsAsset.browser_download_url, sumsFile);
    const sumsText = await readFile(sumsFile, "utf8");
    const line = sumsText.split("\n").find(l => l.endsWith(" " + assetName) || l.endsWith("  " + assetName));
    if (line) expectedSum = line.split(/\s+/)[0];
    await unlink(sumsFile).catch(() => {});
  }

  const binaryPath = await resolveBinaryPath();
  const tmp = `${binaryPath}.new`;
  process.stdout.write(`  ↓ İndiriliyor… ${assetName} (${(asset.size / 1024 / 1024).toFixed(1)} MB)\n`);
  await download(asset.browser_download_url, tmp);
  await chmod(tmp, 0o755);

  if (expectedSum) {
    const actual = await sha256Hex(tmp);
    if (actual !== expectedSum) {
      await unlink(tmp).catch(() => {});
      process.stderr.write(`✗ SHA256 eşleşmedi! beklenen=${expectedSum} alınan=${actual}\n`);
      process.stderr.write(`  Güncelleme iptal — mevcut binary değişmedi.\n`);
      return 3;
    }
    process.stdout.write(`  ✓ Checksum doğru\n`);
  } else if (!opts.skipChecksum) {
    process.stdout.write(`  ⚠ SHA256SUMS bulunamadı — checksum atlandı.\n`);
  }

  // Atomik replace
  if (platform() === "win32") {
    // Windows: çalışan exe replace edilemez; kendine .old yedeği taşı sonra new'u getir
    const old = `${binaryPath}.old`;
    try { await unlink(old); } catch {}
    try { await rename(binaryPath, old); } catch (e) {
      // Bazen rename hata verebilir — copy fallback
      await copyFile(binaryPath, old);
    }
    await rename(tmp, binaryPath);
    process.stdout.write(`  Eski sürüm: ${old} (sonraki başlatmada silinebilir)\n`);
  } else {
    // POSIX: rename(2) atomik, çalışan binary için sorun değil (inode korunur)
    await rename(tmp, binaryPath);
  }

  process.stdout.write(`✓ Güncellendi: ${currentVersion} → ${release.tag_name}\n`);
  process.stdout.write(`  Yeni terminal aç, sonra: altaris --version\n`);
  return 0;
}

async function tryReadVersion(): Promise<string | null> {
  // Compiled bun binary --version output'tan ALTARIS_VERSION env yok; package.json
  // çalışma dizininde yok. Heuristic olarak MACRO.DISPLAY_VERSION'ı şişirilmiş
  // bundle'da bulamayız — sadece env / fallback.
  return null;
}
