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

import { mkdir, readFile, writeFile, stat, readdir } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { join, dirname, resolve as resolvePath, relative as relPath, sep as PSEP } from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import type { Command } from "commander";
import { scaffoldVaultLocally } from "./vaultLocalScaffold.js";

const CREDS_PATH = join(homedir(), ".altaris", "credentials.json");
const FALLBACK_API_BASE = process.env.ALTARIS_API_BASE ?? "http://localhost:5050";
const LOCAL_ROOT = join(homedir(), ".altaris", "vaults");

interface Creds { access_token: string; expires_at: number; api_base?: string; }

let cachedCreds: Creds | null = null;
async function readCreds(): Promise<Creds | null> {
  if (cachedCreds) return cachedCreds;
  try {
    cachedCreds = JSON.parse(await readFile(CREDS_PATH, "utf8")) as Creds;
    return cachedCreds;
  } catch { return null; }
}

async function getToken(): Promise<string | null> {
  const c = await readCreds();
  if (!c) return null;
  if (typeof c.expires_at === "number" && Date.now() > c.expires_at) return null;
  return c.access_token ?? null;
}

async function getApiBase(): Promise<string> {
  // Env > credentials.json (login sırasında yazılıyor) > localhost fallback
  if (process.env.ALTARIS_API_BASE) return process.env.ALTARIS_API_BASE;
  const c = await readCreds();
  if (c?.api_base) return c.api_base.replace(/\/$/, "");
  return FALLBACK_API_BASE;
}

async function api<T = unknown>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const base = await getApiBase();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    // Backend'in friendly hata yapısını kullan (403 → missing_capability vb.).
    // Throw eden generic "HTTP 403" yerine actionable mesaj.
    const { describeApiError } = await import("./apiErrors.js");
    const friendly = await describeApiError(res);
    const detail   = friendly ? friendly.message : `HTTP ${res.status}`;
    throw new Error(`${method} ${path} → ${detail}`);
  }

  const text = await res.text();
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

async function cmdCreate(
  slug: string,
  opts: { name?: string; sync?: boolean; here?: boolean; into?: string; legacyMirror?: boolean }
): Promise<number> {
  const t = await getToken();
  if (!t) { process.stderr.write("Önce: altaris login\n"); return 1; }
  const name = (opts.name ?? slug).trim();
  try {
    const created = await api<VaultRow>(t, "POST", "/api/v1/vaults", { slug, name });
    process.stdout.write(`✓ kasa oluşturuldu: ${created.slug} · ${created.fileCount} dosya · ${fmtBytes(created.byteSize)}\n`);
    process.stdout.write(`  Web: ${process.env.ALTARIS_WEB_BASE ?? "http://localhost:3000"}/vaults/${created.slug}\n`);

    // --no-sync: sadece sunucuda yarat
    if (opts.sync === false) {
      process.stdout.write(`  Lokal scaffold için: altaris vault sync ${created.slug}\n`);
      return 0;
    }

    // Hedef dizin seçimi: --into <dir>  >  --here  >  default cwd/<slug>
    let targetDir: string;
    if (opts.into) {
      targetDir = resolvePath(opts.into);
    } else if (opts.here) {
      targetDir = process.cwd();
    } else {
      targetDir = join(process.cwd(), created.slug);
    }

    // Yeni akış: lokal scaffold cwd-tabanlı
    const apiBase = await getApiBase();
    const result = await scaffoldVaultLocally({
      slug: created.slug,
      targetDir,
      api: apiBase,
      token: t
    });

    process.stdout.write(`✓ Vault \`${created.slug}\` lokalde hazır: ${targetDir}\n`);
    process.stdout.write(`  ${result.written} dosya yazıldı${result.skipped ? `, ${result.skipped} atlandı` : ""}.\n`);
    process.stdout.write(`  Aç:   cd ${targetDir} && altaris\n`);
    process.stdout.write(`  Sync: altaris vault use ${created.slug}  (daemon başlatır)\n`);

    // Opsiyonel: eski ~/.altaris/vaults/<slug>/ aynası
    if (opts.legacyMirror) {
      try {
        await syncOne(t, created.slug);
        process.stdout.write(`  Legacy mirror: ${join(LOCAL_ROOT, created.slug)}\n`);
      } catch (e) {
        process.stderr.write(`  ⚠ legacy mirror başarısız: ${(e as Error).message}\n`);
      }
    }

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

/** Tek bir vault'u indir; cmdCreate de bunu çağırıyor. */
async function syncOne(token: string, slug: string): Promise<{ pulled: number; skipped: number }> {
  const localDir = join(LOCAL_ROOT, slug);
  await mkdir(localDir, { recursive: true });
  const tree = await api<TreeEntry[]>(token, "GET", `/api/v1/vaults/${encodeURIComponent(slug)}/tree`);
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
      token, "GET",
      `/api/v1/vaults/${encodeURIComponent(slug)}/file?path=${encodeURIComponent(f.path)}`
    );
    await mkdir(dirname(localPath), { recursive: true });
    await writeFile(localPath, fileResp.content, "utf8");
    pulled++;
  }
  return { pulled, skipped };
}

/**
 * `altaris vault sync [slug]` —
 *   slug verilirse sadece o kasa, verilmezse kullanıcının erişebildiği
 *   tüm kasalar tek seferde indirilir.
 */
async function cmdSync(slug?: string): Promise<number> {
  const t = await getToken();
  if (!t) { process.stderr.write("Önce: altaris login\n"); return 1; }

  if (slug) {
    const r = await syncOne(t, slug);
    process.stdout.write(`✓ ${slug} · ${r.pulled} indirildi · ${r.skipped} aynı · ${join(LOCAL_ROOT, slug)}\n`);
    return 0;
  }

  // Slug yok: tüm kasaları çek
  const rows = await api<VaultRow[]>(t, "GET", "/api/v1/vaults");
  if (rows.length === 0) {
    process.stdout.write("Çekilecek kasa yok.\n");
    return 0;
  }
  let totalPulled = 0; let totalSkipped = 0;
  for (const v of rows) {
    process.stderr.write(`▸ ${v.slug}…\n`);
    try {
      const r = await syncOne(t, v.slug);
      totalPulled += r.pulled; totalSkipped += r.skipped;
      process.stdout.write(`  ✓ ${v.slug} · ${r.pulled} indirildi · ${r.skipped} aynı\n`);
    } catch (e) {
      process.stderr.write(`  ✗ ${v.slug} · ${(e as Error).message}\n`);
    }
  }
  process.stdout.write(`\n✓ ${rows.length} kasa · ${totalPulled} dosya indirildi · ${totalSkipped} aynı · kök ${LOCAL_ROOT}\n`);
  return 0;
}

// ─── PUSH (lokal → server) — checksum + conflict detection ──────────────────

interface ManifestEntry { path: string; bytes: number; modifiedUtc: string; sha256: string; }

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Lokal vault dizinini gez, posix yollu rölatif dosya listesini döndür. */
async function walkLocal(root: string): Promise<string[]> {
  const out: string[] = [];
  async function rec(dir: string) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      // .obsidian/ ve .git/ scaffold dosyaları lokalde tutulur ama push edilmez
      if (e.name.startsWith(".") && e.name !== ".gitkeep") continue;
      // .conflict-* dosyaları lokal-only conflict snapshot'ları, push etme
      if (e.name.endsWith(".conflict.md") || e.name.includes(".conflict-")) continue;
      if (e.isDirectory()) await rec(p);
      else if (e.isFile()) out.push(relPath(root, p).split(PSEP).join("/"));
    }
  }
  await rec(root);
  return out;
}

interface PushResult { uploaded: number; unchanged: number; conflicts: string[]; deleted: number; }

async function pushOne(token: string, slug: string, opts: { dryRun?: boolean; deleteRemote?: boolean }): Promise<PushResult> {
  const localDir = join(LOCAL_ROOT, slug);
  try { await stat(localDir); }
  catch { throw new Error(`lokal mirror yok: ${localDir} (önce: altaris vault sync ${slug})`); }

  const manifest = await api<ManifestEntry[]>(token, "GET", `/api/v1/vaults/${encodeURIComponent(slug)}/manifest`);
  const remoteByPath = new Map(manifest.map(m => [m.path, m]));
  const localPaths   = await walkLocal(localDir);

  const result: PushResult = { uploaded: 0, unchanged: 0, conflicts: [], deleted: 0 };

  for (const rel of localPaths) {
    const localFull = join(localDir, rel);
    const text = await readFile(localFull, "utf8");
    const localHash = sha256(text);
    const remote = remoteByPath.get(rel);

    if (remote && remote.sha256 === localHash) { result.unchanged++; continue; }

    if (opts.dryRun) {
      process.stdout.write(`  [dry] ${remote ? "↑" : "+"} ${rel}\n`);
      result.uploaded++;
      continue;
    }

    // PUT with parentChecksum so server can flag conflicts.
    try {
      await api(token, "PUT", `/api/v1/vaults/${encodeURIComponent(slug)}/file`, {
        path: rel,
        content: text,
        parentChecksum: remote?.sha256 ?? ""
      });
      result.uploaded++;
    } catch (e) {
      const msg = (e as Error).message;
      // 409 Conflict — server has a newer version. Save server snapshot as
      // .conflict.md sidecar so the user can merge by hand without losing work.
      if (msg.includes("HTTP 409")) {
        try {
          const serverFresh = await api<{ path: string; content: string }>(
            token, "GET",
            `/api/v1/vaults/${encodeURIComponent(slug)}/file?path=${encodeURIComponent(rel)}`
          );
          const sidecar = localFull.replace(/\.md$/, "") + `.conflict-${Date.now()}.md`;
          await writeFile(sidecar, serverFresh.content, "utf8");
          process.stderr.write(`  ⚠ conflict ${rel} — server kopyası: ${sidecar}\n`);
          result.conflicts.push(rel);
        } catch (inner) {
          process.stderr.write(`  ⚠ conflict ${rel} — snapshot alınamadı: ${(inner as Error).message}\n`);
          result.conflicts.push(rel);
        }
      } else {
        process.stderr.write(`  ✗ ${rel}: ${msg}\n`);
      }
    }
  }

  // Optional: server'da olup lokalde olmayan dosyaları sil (push --delete)
  if (opts.deleteRemote) {
    const localSet = new Set(localPaths);
    for (const r of manifest) {
      if (localSet.has(r.path)) continue;
      if (opts.dryRun) {
        process.stdout.write(`  [dry] − ${r.path}\n`);
        result.deleted++;
        continue;
      }
      try {
        await api(token, "DELETE", `/api/v1/vaults/${encodeURIComponent(slug)}/file?path=${encodeURIComponent(r.path)}`);
        result.deleted++;
      } catch (e) {
        process.stderr.write(`  ✗ delete ${r.path}: ${(e as Error).message}\n`);
      }
    }
  }

  return result;
}

async function cmdPush(slug: string | undefined, opts: { dryRun?: boolean; delete?: boolean }): Promise<number> {
  const t = await getToken();
  if (!t) { process.stderr.write("Önce: altaris login\n"); return 1; }

  const slugs = slug
    ? [slug]
    : (await api<VaultRow[]>(t, "GET", "/api/v1/vaults")).map(v => v.slug);

  if (slugs.length === 0) { process.stdout.write("Push edilecek kasa yok.\n"); return 0; }

  let totalUp = 0, totalSame = 0, totalConflict = 0, totalDel = 0;
  for (const s of slugs) {
    process.stderr.write(`▸ push ${s}…\n`);
    try {
      const r = await pushOne(t, s, { dryRun: opts.dryRun, deleteRemote: opts.delete });
      totalUp += r.uploaded; totalSame += r.unchanged;
      totalConflict += r.conflicts.length; totalDel += r.deleted;
      const sumLine = `  ✓ ${s} · ${r.uploaded} ↑ · ${r.unchanged} = · ${r.deleted} − · ${r.conflicts.length} ⚠`;
      process.stdout.write(`${sumLine}${opts.dryRun ? "  (dry-run)" : ""}\n`);
    } catch (e) {
      process.stderr.write(`  ✗ ${s}: ${(e as Error).message}\n`);
    }
  }
  process.stdout.write(`\n${slugs.length} kasa · ${totalUp} push · ${totalSame} aynı · ${totalDel} sil · ${totalConflict} conflict\n`);
  if (totalConflict > 0) {
    process.stdout.write(`\n⚠ Conflict'ler için: ilgili klasörde *.conflict-*.md dosyalarını manuel merge edip tekrar push.\n`);
    return 3;
  }
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

/**
 * `altaris vault use <slug>` — vault'u "aç" akışı:
 *   1. Server'dan lokale sync (yeni dosyalar inerse alır)
 *   2. cwd'yi vault dizinine kaydır
 *   3. Yeni bir `altaris` interactive child spawn et (stdio inherit)
 *   4. Child exit edince parent kapanır
 *
 * --remote-control geçirilirse child'a forward edilir → otomatik yayına alır.
 */
async function cmdUse(slug: string, opts: { remoteControl?: boolean; sync?: boolean; daemon?: boolean }): Promise<number> {
  const wantSync = opts.sync !== false;   // default true
  const wantDaemon = opts.daemon !== false; // default true

  // Vault local dir resolution:
  //  1. cwd/<slug>  (Faz 23B scaffold lokasyonu)
  //  2. cwd kendisi (eğer kullanıcı zaten vault root'unda ise — .altaris/ var mı diye kontrol)
  //  3. ~/.altaris/vaults/<slug> (legacy mirror)
  const candidates = [
    join(process.cwd(), slug),
    process.cwd(),
    join(LOCAL_ROOT, slug),
  ];
  let localDir: string | null = null;
  for (const c of candidates) {
    try {
      const s = await stat(c);
      if (s.isDirectory()) {
        // .altaris/ varsa veya wiki/ varsa vault dir kabul et
        try {
          await stat(join(c, ".altaris"));
          localDir = c; break;
        } catch { /* deneme devam */ }
        try {
          await stat(join(c, "wiki"));
          localDir = c; break;
        } catch { /* deneme devam */ }
      }
    } catch { /* deneme devam */ }
  }

  if (wantSync && !localDir) {
    process.stderr.write(`▸ sync ${slug}…\n`);
    const code = await cmdSync(slug);
    if (code !== 0) return code;
    localDir = join(LOCAL_ROOT, slug);
  }

  if (!localDir) {
    process.stderr.write(`Lokal vault dizini bulunamadı (cwd, cwd/${slug}, ~/.altaris/vaults/${slug}).\n`);
    return 1;
  }

  // Daemon başlat (arka planda, file watcher + SSE)
  let daemonHandle: { stop(): Promise<void> } | null = null;
  if (wantDaemon) {
    try {
      const { startVaultDaemon } = await import("./vaultDaemon.js");
      daemonHandle = await startVaultDaemon({
        slug,
        localDir,
        // Conflict'lerde MVP: sidecar fallback (skip) — interactive prompt
        // PTY-aware bir UI gerekli, sonra eklenecek (Faz 23E).
        resolveConflict: async () => "skip",
      });
    } catch (e) {
      process.stderr.write(`▸ daemon başlatılamadı: ${(e as Error).message}\n`);
    }
  }

  // process.argv[1] genelde altaris binary'sinin gerçek path'i
  const altarisBin = process.argv[1];
  const childArgs: string[] = [];
  if (opts.remoteControl) childArgs.push("--remote-control");

  process.stderr.write(`▸ vault: ${slug} · ${localDir}\n`);
  process.stderr.write(`▸ exec: ${altarisBin} ${childArgs.join(" ")}\n`);

  const child = spawn(altarisBin, childArgs, {
    cwd: localDir,
    stdio: "inherit",
    env: {
      ...process.env,
      ALTARIS_VAULT: slug,
      ALTARIS_VAULT_DIR: localDir
    }
  });

  const code = await new Promise<number>(resolve => {
    child.on("exit", code => resolve(code ?? 0));
    child.on("error", err => {
      process.stderr.write(`spawn error: ${err.message}\n`);
      resolve(1);
    });
  });

  if (daemonHandle) {
    await daemonHandle.stop().catch(() => { /* ignore */ });
  }
  return code;
}

// ─── Commander wiring ────────────────────────────────────────────────────────

export function registerVaultCommands(program: Command): void {
  const vault = program.command("vault").description("Argus knowledge vault (Obsidian-uyumlu) yönetimi");

  vault.command("list").description("Kasaları listele").action(async () => process.exit(await cmdList()));

  vault.command("create <slug>")
    .description("Yeni kasa oluştur (server scaffold + cwd lokal scaffold)")
    .option("-n, --name <name>", "Görünür ad (varsayılan slug)")
    .option("--no-sync", "Sadece sunucuda yarat, lokal scaffold yapma")
    .option("--here", "Lokal scaffold'u cwd'nin kendisine yaz (boş olmalı)")
    .option("--into <dir>", "Lokal scaffold için özel hedef dizin")
    .option("--legacy-mirror", "Eski ~/.altaris/vaults/<slug>/ aynasını da kur")
    .action(async (
      slug: string,
      opts: { name?: string; sync?: boolean; here?: boolean; into?: string; legacyMirror?: boolean }
    ) => process.exit(await cmdCreate(slug, opts)));

  vault.command("delete <slug>").description("Kasayı sil (sahibi)").action(async (slug: string) => process.exit(await cmdDelete(slug)));

  vault.command("sync [slug]")
    .description("Sunucudan lokale indir. Slug yoksa tüm kasalarımı çek.")
    .action(async (slug?: string) => process.exit(await cmdSync(slug)));

  vault.command("push [slug]")
    .description("Lokal değişiklikleri server'a yolla. Slug yoksa tüm kasalarımı push et. Conflict'lerde server kopyası .conflict-*.md olarak yazılır.")
    .option("--dry-run", "Sadece neyin push edileceğini göster, gerçek upload yapma")
    .option("--delete", "Lokalde olmayan dosyaları server'dan da sil (tehlikeli)")
    .action(async (slug: string | undefined, opts: { dryRun?: boolean; delete?: boolean }) =>
      process.exit(await cmdPush(slug, opts)));

  vault.command("open <slug>").description("Lokal mirror'ı dosya gezgininde aç").action(async (slug: string) => process.exit(await cmdOpen(slug)));

  vault.command("use <slug>")
    .description("Vault'u sync et + o dizinde yeni bir altaris interactive aç (daemon arka planda)")
    .option("--remote-control", "Açılan oturumu Argus Remote Control ile yayına al")
    .option("--no-sync", "Önce sync atlamak için (offline/hızlı)")
    .option("--no-daemon", "Bidirectional sync daemon'ı başlatma (sadece bir kerelik mod)")
    .action(async (slug: string, opts: { remoteControl?: boolean; sync?: boolean; daemon?: boolean }) =>
      process.exit(await cmdUse(slug, opts)));
}
