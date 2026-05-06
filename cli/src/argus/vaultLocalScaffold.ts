/**
 * Altaris Vaults — local scaffold helper.
 *
 * `altaris vault create <slug>` server'da kasayı yarattıktan sonra cwd'ye
 * (ya da kullanıcının seçtiği dizine) kasanın içeriğini ayna olarak yazar.
 * Eski `~/.altaris/vaults/<slug>/` mirror akışı yerine, kullanıcı vault'unu
 * doğrudan kendi proje klasöründe (örn. `~/notlar/<slug>/`) açar.
 *
 * Aynı zamanda offline kullanım için `.altaris/plugins/vault/` dizinine
 * 10 stub skill markdown'ı kopyalar ve `.altaris/settings.json` içine
 * `vault@builtin` plugin'ini etkinleştirir.
 */

import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

interface TreeEntry { path: string; bytes: number; modifiedUtc: string; }
interface FileResp  { path: string; content: string; }

interface ScaffoldOpts {
  slug: string;
  targetDir: string;
  api: string;   // base URL, e.g. http://localhost:5050
  token: string;
}

interface ScaffoldResult { written: number; skipped: number; }

const BUILTIN_SKILLS = [
  "wiki", "save", "ingest", "query", "lint",
  "canvas", "autoresearch", "defuddle", "obsidian-markdown", "obsidian-bases"
] as const;

async function isDirEmpty(dir: string): Promise<boolean> {
  try {
    const entries = await readdir(dir);
    return entries.length === 0;
  } catch {
    return true; // yok → boş kabul, mkdir aşağıda yapacak
  }
}

async function dirExists(dir: string): Promise<boolean> {
  try { const s = await stat(dir); return s.isDirectory(); }
  catch { return false; }
}

async function fetchTree(api: string, token: string, slug: string): Promise<TreeEntry[]> {
  const url = `${api.replace(/\/$/, "")}/api/v1/vaults/${encodeURIComponent(slug)}/tree`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`tree fetch başarısız: HTTP ${res.status} ${res.statusText}`);
  const text = await res.text();
  return text ? JSON.parse(text) as TreeEntry[] : [];
}

async function fetchFile(api: string, token: string, slug: string, path: string): Promise<string> {
  const url = `${api.replace(/\/$/, "")}/api/v1/vaults/${encodeURIComponent(slug)}/file?path=${encodeURIComponent(path)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text) return "";
  const parsed = JSON.parse(text) as FileResp;
  return parsed.content ?? "";
}

function skillStub(name: string): string {
  return `# vault:${name}\n\n` +
         `Skill is auto-active in this vault.\n\n` +
         `This is a built-in stub for offline use. The full skill body is\n` +
         `delivered by the Argus server when the vault is opened online.\n`;
}

export async function scaffoldVaultLocally(opts: ScaffoldOpts): Promise<ScaffoldResult> {
  const { slug, targetDir, api, token } = opts;

  // 1) Hedef dizin: yoksa yarat, varsa boş olmalı
  const exists = await dirExists(targetDir);
  if (exists) {
    const empty = await isDirEmpty(targetDir);
    if (!empty) {
      throw new Error(`Hedef dizin boş değil: ${targetDir}`);
    }
  } else {
    await mkdir(targetDir, { recursive: true });
  }

  // 2) Server tree (fail → throw)
  const tree = await fetchTree(api, token, slug);

  // 3) Her dosyayı çek + yaz (fetch fail → skip + log)
  let written = 0;
  let skipped = 0;
  for (const entry of tree) {
    const localPath = join(targetDir, entry.path);
    try {
      const content = await fetchFile(api, token, slug, entry.path);
      await mkdir(dirname(localPath), { recursive: true });
      await writeFile(localPath, content, "utf8");
      written++;
    } catch (e) {
      process.stderr.write(`  ⚠ atlandı: ${entry.path} (${(e as Error).message})\n`);
      skipped++;
    }
  }

  // 4) .altaris/plugins/vault/ — 10 skill stub
  const pluginDir = join(targetDir, ".altaris", "plugins", "vault");
  await mkdir(pluginDir, { recursive: true });
  for (const name of BUILTIN_SKILLS) {
    const file = join(pluginDir, `${name}.md`);
    await writeFile(file, skillStub(name), "utf8");
  }

  // 5) .altaris/settings.json
  const settings = { enabledPlugins: { "vault@builtin": true } };
  await writeFile(
    join(targetDir, ".altaris", "settings.json"),
    JSON.stringify(settings, null, 2) + "\n",
    "utf8"
  );

  // 6) .altaris/.gitkeep
  await writeFile(join(targetDir, ".altaris", ".gitkeep"), "", "utf8");

  return { written, skipped };
}
