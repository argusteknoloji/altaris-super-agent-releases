/**
 * Altaris Vaults — server-authoritative knowledge vaults with optional
 * local mirror at ~/.altaris/vaults/{slug}/. The CLI surface:
 *
 *   altaris vault list
 *   altaris vault create <slug> --name "Public Name"
 *   altaris vault delete <slug>
 *   altaris vault sync <slug>       # pull server → ~/.altaris/vaults/<slug>/
 *   altaris vault open <slug>       # open the local mirror in $EDITOR / Finder
 *
 * Auth: relies on the same `~/.altaris/credentials.json` token used by the
 * other Argus extensions. If the token is missing/expired we tell the user
 * to run `altaris login`.
 */

import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { join, dirname } from "node:path";
import { spawn } from "node:child_process";
import type { Command } from "commander";

const CREDS_PATH = join(homedir(), ".altaris", "credentials.json");
const API_BASE   = process.env.ALTARIS_API_BASE ?? "http://localhost:5000";
const LOCAL_ROOT = join(homedir(), ".altaris", "vaults");

interface Creds { access_token: string; expires_at: number; }

async function getToken(): Promise<string | null> {
  try {
    const c = JSON.parse(await readFile(CREDS_PATH, "utf8")) as Creds;
    if (typeof c.expires_at === "number" && Date.now() > c.expires_at) return null;
    return c.access_token ?? null;
  } catch { return null; }
}

async function api<T = unknown>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → HTTP ${res.status}${text ? `: ${text}` : ""}`);
  return text ? JSON.parse(text) as T : (undefined as T);
}

interface VaultRow {
  id: string; slug: string; name: string; status: string;
  fileCount: number; byteSize: number;
  createdAt: string; updatedAt: string;
  owner: { id: string; email: string };
}

interface TreeEntry { path: string; bytes: number; modifiedUtc: string; }

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function cmdList(): Promise<number> {
  const t = await getToken();
  if (!t) { process.stderr.write("Önce: altaris login\n"); return 1; }
  const rows = await api<VaultRow[]>(t, "GET", "/api/v1/vaults");
  if (rows.length === 0) {
    process.stdout.write("Henüz kasa yok. Oluşturmak için: altaris vault create <slug> --name '...'\n");
    return 0;
  }
  for (const v of rows) {
    process.stdout.write(
      `${v.slug.padEnd(24)} ${String(v.fileCount).padStart(4)} dosya · ${fmtBytes(v.byteSize).padStart(8)} · ` +
      `${v.owner.email}  — ${v.name}\n`
    );
  }
  return 0;
}

async function cmdCreate(slug: string, opts: { name?: string }): Promise<number> {
  const t = await getToken();
  if (!t) { process.stderr.write("Önce: altaris login\n"); return 1; }
  const name = (opts.name ?? slug).trim();
  try {
    const created = await api<VaultRow>(t, "POST", "/api/v1/vaults", { slug, name });
    process.stdout.write(`✓ kasa oluşturuldu: ${created.slug} · ${created.fileCount} dosya · ${fmtBytes(created.byteSize)}\n`);
    process.stdout.write(`  Web: ${API_BASE.replace(/:5000$/, ":3000")}/vaults/${created.slug}\n`);
    process.stdout.write(`  Lokal mirror: altaris vault sync ${created.slug}\n`);
    return 0;
  } catch (e) {
    process.stderr.write(`hata: ${(e as Error).message}\n`);
    return 2;
  }
}

async function cmdDelete(slug: string): Promise<number> {
  const t = await getToken();
  if (!t) { process.stderr.write("Önce: altaris login\n"); return 1; }
  try {
    await api(t, "DELETE", `/api/v1/vaults/${encodeURIComponent(slug)}`);
    process.stdout.write(`✓ silindi: ${slug}\n`);
    return 0;
  } catch (e) {
    process.stderr.write(`hata: ${(e as Error).message}\n`);
    return 2;
  }
}

async function cmdSync(slug: string): Promise<number> {
  const t = await getToken();
  if (!t) { process.stderr.write("Önce: altaris login\n"); return 1; }
  const localDir = join(LOCAL_ROOT, slug);
  await mkdir(localDir, { recursive: true });

  const tree = await api<TreeEntry[]>(t, "GET", `/api/v1/vaults/${encodeURIComponent(slug)}/tree`);
  let pulled = 0; let skipped = 0;
  for (const f of tree) {
    const localPath = join(localDir, f.path);
    let needs = true;
    try {
      const s = await stat(localPath);
      if (s.size === f.bytes && s.mtime.toISOString() === new Date(f.modifiedUtc).toISOString()) {
        needs = false;
      }
    } catch { /* missing */ }

    if (!needs) { skipped++; continue; }

    const fileResp = await api<{ path: string; content: string }>(
      t, "GET",
      `/api/v1/vaults/${encodeURIComponent(slug)}/file?path=${encodeURIComponent(f.path)}`
    );
    await mkdir(dirname(localPath), { recursive: true });
    await writeFile(localPath, fileResp.content, "utf8");
    pulled++;
  }
  process.stdout.write(`✓ sync tamam · ${pulled} indirildi · ${skipped} aynı · ${localDir}\n`);
  return 0;
}

async function cmdOpen(slug: string): Promise<number> {
  const localDir = join(LOCAL_ROOT, slug);
  try { await stat(localDir); }
  catch {
    process.stderr.write(`Lokal mirror yok. Önce: altaris vault sync ${slug}\n`);
    return 1;
  }
  const opener = platform() === "darwin" ? "open" : platform() === "win32" ? "explorer" : "xdg-open";
  spawn(opener, [localDir], { detached: true, stdio: "ignore" }).unref();
  process.stdout.write(`→ ${localDir}\n`);
  return 0;
}

// ─── Commander wiring ────────────────────────────────────────────────────────

export function registerVaultCommands(program: Command): void {
  const vault = program.command("vault").description("Argus knowledge vault (Obsidian-uyumlu) yönetimi");

  vault.command("list").description("Kasaları listele").action(async () => process.exit(await cmdList()));

  vault.command("create <slug>")
    .description("Yeni kasa oluştur (sunucu tarafında scaffold + DB)")
    .option("-n, --name <name>", "Görünür ad (varsayılan slug)")
    .action(async (slug: string, opts: { name?: string }) => process.exit(await cmdCreate(slug, opts)));

  vault.command("delete <slug>").description("Kasayı sil (sahibi)").action(async (slug: string) => process.exit(await cmdDelete(slug)));

  vault.command("sync <slug>").description("Sunucudan ~/.altaris/vaults/<slug>/'a indir").action(async (slug: string) => process.exit(await cmdSync(slug)));

  vault.command("open <slug>").description("Lokal mirror'ı dosya gezgininde aç").action(async (slug: string) => process.exit(await cmdOpen(slug)));
}
