/**
 * GitHub Releases tabanlı self-update — Altaris CLI Bun-compiled standalone
 * binary olarak `argusteknoloji/altaris-super-agent-releases` üzerinden dağıtılır.
 * npm registry kullanılmaz.
 *
 * Akış:
 *   1) GET /repos/.../releases/latest → en son release tag + assets
 *   2) Mevcut process.platform + process.arch → asset adıyla eşle
 *   3) Asset'i temp dosyaya indir, executable yap
 *   4) Atomic move: mevcut binary'yi .bak'a taşı, yeniyi yerine koy
 *   5) Kullanıcıya "altaris çalıştır" de
 */
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { createWriteStream } from 'node:fs'

const RELEASES_REPO = 'argusteknoloji/altaris-super-agent-releases'

export type GhUpdateResult =
  | { kind: 'up_to_date'; version: string }
  | { kind: 'updated'; from: string; to: string; binaryPath: string }
  | { kind: 'no_asset'; tag: string; expected: string }
  | { kind: 'error'; message: string }

/** GitHub asset adını mevcut platform/arch'a göre üret. release.yml ile eşleşmeli. */
export function expectedAssetName(): string {
  // CLI release tags binary naming pattern: altaris-{os}-{arch}[.exe]
  const platform = process.platform
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  if (platform === 'darwin') return `altaris-darwin-${arch}`
  if (platform === 'linux')  return `altaris-linux-${arch}`
  if (platform === 'win32')  return `altaris-windows-${arch}.exe`
  throw new Error(`Unsupported platform: ${platform}/${arch}`)
}

/** Çalıştırılan binary'nin path'i — Bun-compiled standalone'da process.execPath. */
export function currentBinaryPath(): string {
  // Bun --compile binary'sinde process.execPath = binary'nin kendisi.
  // Node ile çalışırken process.execPath = node interpreter (binary değil).
  // Calling code dev build'i öncesinde elemiş olmalı.
  return process.execPath
}

interface GhRelease {
  tag_name: string
  name?: string
  assets: Array<{ name: string; browser_download_url: string; size: number }>
}

async function fetchLatestRelease(): Promise<GhRelease> {
  const url = `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`
  const r = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'altaris-cli-updater',
    },
  })
  if (!r.ok) throw new Error(`GitHub API ${r.status} ${r.statusText}`)
  return await r.json() as GhRelease
}

export async function checkLatestVersion(): Promise<string | null> {
  try {
    const rel = await fetchLatestRelease()
    return rel.tag_name.replace(/^v/, '')
  } catch {
    return null
  }
}

/**
 * Self-update flow. Mevcut binary'yi yenisiyle değiştirir; başarılıysa
 * kullanıcıya restart söylemek caller'ın işi (binary file handle açıkken
 * çalıştırma sürdüğü için bu process eski kodu çalıştırmaya devam eder).
 */
export async function performGithubUpdate(currentVersion: string): Promise<GhUpdateResult> {
  let rel: GhRelease
  try {
    rel = await fetchLatestRelease()
  } catch (e) {
    return { kind: 'error', message: `GitHub release sorgulanamadı: ${e instanceof Error ? e.message : String(e)}` }
  }

  const latestVersion = rel.tag_name.replace(/^v/, '')
  // Tag '0.1.0-beta.7' formatında olabilir; basit string karşılaştırma yeterli.
  if (latestVersion === currentVersion) {
    return { kind: 'up_to_date', version: latestVersion }
  }

  const assetName = expectedAssetName()
  const asset = rel.assets.find(a => a.name === assetName)
  if (!asset) {
    return { kind: 'no_asset', tag: rel.tag_name, expected: assetName }
  }

  // İndir → temp → atomic move
  const binaryPath = currentBinaryPath()
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'altaris-update-'))
  const tmpBin = path.join(tmpDir, assetName)

  try {
    const dl = await fetch(asset.browser_download_url, {
      headers: { 'User-Agent': 'altaris-cli-updater' },
    })
    if (!dl.ok || !dl.body) {
      return { kind: 'error', message: `İndirme başarısız: HTTP ${dl.status}` }
    }
    // Stream to disk
    const file = createWriteStream(tmpBin)
    const reader = dl.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        await new Promise<void>((res, rej) => file.write(value, err => err ? rej(err) : res()))
      }
    }
    await new Promise<void>(res => file.end(res))

    if (process.platform !== 'win32') {
      await fs.chmod(tmpBin, 0o755)
    }

    // Backup mevcut binary
    const bakPath = `${binaryPath}.bak-${Date.now()}`
    await fs.rename(binaryPath, bakPath)
    try {
      await fs.rename(tmpBin, binaryPath)
    } catch (renameErr) {
      // Cross-device rename fail → copy + unlink fallback
      await fs.copyFile(tmpBin, binaryPath)
      if (process.platform !== 'win32') await fs.chmod(binaryPath, 0o755)
      await fs.unlink(tmpBin).catch(() => {})
    }
    // Eski .bak dosyasını arkada bırak — sorun olursa user manuel restore eder
    setTimeout(() => fs.unlink(bakPath).catch(() => {}), 5000)

    return { kind: 'updated', from: currentVersion, to: latestVersion, binaryPath }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { kind: 'error', message: `Update kuruldu olamadı: ${msg}` }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}
