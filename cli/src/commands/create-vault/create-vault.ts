import type { LocalCommandCall } from '../../types/command.js'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CREDS_PATH = join(homedir(), '.altaris', 'credentials.json')
const API_BASE   = process.env.ALTARIS_API_BASE ?? 'http://localhost:5050'

/** Minimal token reader — vaults.ts'taki ile aynı pattern, dependency yok. */
async function getToken(): Promise<string | null> {
  try {
    const c = JSON.parse(await readFile(CREDS_PATH, 'utf8')) as { access_token?: string; expires_at?: number }
    if (typeof c.expires_at === 'number' && Date.now() > c.expires_at) return null
    return c.access_token ?? null
  } catch { return null }
}

/** "slug \"Görünür Ad\" --no-sync" → { slug, name?, sync? } */
function parseArgs(raw: string): { slug?: string; name?: string; sync: boolean; help: boolean } {
  const tokens: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (c === '"') { inQ = !inQ; continue }
    if (!inQ && /\s/.test(c)) { if (cur) { tokens.push(cur); cur = '' } continue }
    cur += c
  }
  if (cur) tokens.push(cur)

  let sync = true
  let slug: string | undefined
  let name: string | undefined
  let help = false
  for (const t of tokens) {
    if (t === '--no-sync') sync = false
    else if (t === '-h' || t === '--help') help = true
    else if (!slug) slug = t
    else if (!name) name = t
  }
  return { slug, name, sync, help }
}

export const call: LocalCommandCall = async (args, _context) => {
  const p = parseArgs(args ?? '')

  if (p.help || !p.slug) {
    return { type: 'text', value:
      'Kullanım: /create-vault <slug> ["Görünür Ad"] [--no-sync]\n' +
      'Örnek:   /create-vault proje-alpha "Proje Alpha"\n' +
      '         /create-vault scratch --no-sync'
    }
  }

  const token = await getToken()
  if (!token) return { type: 'text', value: 'Önce: altaris login (token bulunamadı)' }

  const slug = p.slug.toLowerCase().replace(/[^a-z0-9_-]/g, '')
  const name = (p.name ?? slug).trim()
  if (!slug) return { type: 'text', value: 'Geçersiz slug (sadece a-z, 0-9, -, _).' }

  let res: Response
  try {
    res = await fetch(`${API_BASE}/api/v1/vaults`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, name }),
    })
  } catch (e) {
    return { type: 'text', value: `API'ye ulaşılamadı: ${(e as Error).message}` }
  }

  if (!res.ok) {
    const text = await res.text()
    return { type: 'text', value: `Vault oluşturulamadı (HTTP ${res.status}): ${text}` }
  }

  const created = await res.json() as { slug: string; fileCount: number; byteSize: number }
  const webBase = process.env.ALTARIS_WEB_BASE ?? 'http://localhost:3000'

  let line = `✓ kasa oluşturuldu: ${created.slug} · ${created.fileCount} dosya\n` +
             `  Web:   ${webBase}/vaults/${created.slug}\n`
  if (p.sync) {
    line += `  Lokal mirror için:  altaris vault sync ${created.slug}\n` +
            `  Vault'ta çalış:     altaris vault use ${created.slug}\n`
  } else {
    line += `  (--no-sync) Lokal mirror atlandı.\n`
  }
  return { type: 'text', value: line }
}
