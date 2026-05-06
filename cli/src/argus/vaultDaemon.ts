/**
 * Vault Daemon — Bidirectional Sync (Faz 23C)
 *
 * Lokal vault dizinindeki değişiklikleri otomatik server'a push eder
 * (önce pull-check ile conflict önler), AYNI ANDA server'da başkalarının
 * yaptığı değişiklikleri SSE üzerinden alıp lokale yansıtır.
 *
 * Akış:
 *   ┌─────────────────────────────────────────────────────┐
 *   │  fs.watch(localDir, recursive)                      │
 *   │    → debounce 1.5s                                   │
 *   │    → sha256 hesapla                                  │
 *   │    → server manifest'i çek                           │
 *   │    → değişen dosyalar için PUT (parentChecksum)      │
 *   │    → 409 → conflict prompt                           │
 *   └─────────────────────────────────────────────────────┘
 *   ┌─────────────────────────────────────────────────────┐
 *   │  GET /events (SSE)                                   │
 *   │    → "updated"|"created"|"deleted" eventi            │
 *   │    → yerel sha karşılaştır → değişmişse pull         │
 *   │    → yerel modifiye ise prompt                       │
 *   └─────────────────────────────────────────────────────┘
 *
 * Daemon `altaris vault use <slug>` session'ı boyunca arka planda çalışır.
 * SIGINT/exit'te temiz kapanır.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import { dirname, join, relative } from "node:path";
import { getApiBase } from "./apiConfig.js";
import { getAccessToken } from "./login.js";

interface VaultFileEvent {
  type: "created" | "updated" | "deleted";
  path: string;
  sha256?: string | null;
  at: string;
  actorUserId?: string | null;
}

export interface DaemonOptions {
  slug: string;
  localDir: string;
  /** Debounce period for local change → push */
  debounceMs?: number;
  /** Heartbeat reconnect period if SSE drops */
  reconnectMs?: number;
  /** stderr logger override (default: process.stderr.write) */
  log?: (msg: string) => void;
  /** Conflict resolver — caller'a soru sorulduğunda hangi seçim yapılacağını döndürür. Default: "skip" */
  resolveConflict?: (path: string, localHash: string, remoteHash: string) => Promise<"theirs" | "mine" | "skip">;
}

export interface DaemonHandle {
  stop(): Promise<void>;
}

const DEFAULT_DEBOUNCE_MS = 1500;
const DEFAULT_RECONNECT_MS = 5_000;

const IGNORE_PATTERNS = [
  /^\.git\//,
  /^node_modules\//,
  /^\.altaris\/cache\//,
  /\.conflict-\d+\.md$/,
  /\.swp$/,
  /\.tmp$/,
  /^\..*\.swap$/,
];

function shouldIgnore(rel: string): boolean {
  return IGNORE_PATTERNS.some(p => p.test(rel));
}

function sha256Of(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

async function readTextSafe(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

interface ApiCall {
  (method: "GET", path: string): Promise<unknown>;
  (method: "PUT" | "POST" | "DELETE", path: string, body?: unknown): Promise<unknown>;
}

function buildApi(token: string): ApiCall {
  const base = getApiBase();
  return (async (method: string, p: string, body?: unknown) => {
    const r = await fetch(`${base}${p}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText} on ${method} ${p}`);
    const ct = r.headers.get("content-type") ?? "";
    return ct.includes("application/json") ? r.json() : r.text();
  }) as ApiCall;
}

interface ManifestEntry {
  path: string;
  sha256: string;
  bytes: number;
  indexedAt?: string;
}

/**
 * SSE stream'i okur, satır satır parse eder, her event için handler çağırır.
 * Connection drop → reconnect (caller responsibility).
 */
async function consumeSse(
  url: string,
  token: string,
  onEvent: (ev: VaultFileEvent) => void,
  signal: AbortSignal,
  log: (m: string) => void,
): Promise<void> {
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
    },
    signal,
  });
  if (!r.ok || !r.body) {
    throw new Error(`SSE bağlantı hatası: HTTP ${r.status}`);
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const block of events) {
      const lines = block.split("\n").filter(l => l.startsWith("data: "));
      if (lines.length === 0) continue;
      const data = lines.map(l => l.slice(6)).join("\n");
      try {
        const ev = JSON.parse(data) as VaultFileEvent;
        onEvent(ev);
      } catch (err) {
        log(`[daemon] SSE parse error: ${(err as Error).message}\n`);
      }
    }
  }
}

/**
 * Daemon başlat. localDir vault root'u olmalı (içinde wiki/, agents/ vb.).
 */
export async function startVaultDaemon(opts: DaemonOptions): Promise<DaemonHandle> {
  const log = opts.log ?? (m => process.stderr.write(m));
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const reconnectMs = opts.reconnectMs ?? DEFAULT_RECONNECT_MS;
  const resolveConflict = opts.resolveConflict ?? (async () => "skip" as const);

  // Hedef dizin var mı?
  await stat(opts.localDir).catch(() => {
    throw new Error(`Daemon: localDir bulunamadı: ${opts.localDir}`);
  });

  const token = await getAccessToken();
  if (!token) throw new Error("Daemon: oturum yok — `altaris login`.");
  const api = buildApi(token);

  log(`[daemon] başlatıldı · ${opts.slug} · ${opts.localDir}\n`);

  // ── Local push pipeline ────────────────────────────────────────────────
  const dirty = new Set<string>();
  let pushTimer: NodeJS.Timeout | null = null;

  const flushDirty = async () => {
    if (dirty.size === 0) return;
    const paths = [...dirty];
    dirty.clear();

    let manifest: ManifestEntry[];
    try {
      manifest = await api("GET", `/api/v1/vaults/${encodeURIComponent(opts.slug)}/manifest`) as ManifestEntry[];
    } catch (e) {
      log(`[daemon] manifest fetch hatası: ${(e as Error).message}\n`);
      paths.forEach(p => dirty.add(p));
      return;
    }
    const byPath = new Map(manifest.map(m => [m.path, m]));

    for (const rel of paths) {
      const full = join(opts.localDir, rel);
      const text = await readTextSafe(full);
      if (text === null) {
        // Dosya silinmiş — server'da var mı?
        const remote = byPath.get(rel);
        if (remote) {
          try {
            await api("DELETE", `/api/v1/vaults/${encodeURIComponent(opts.slug)}/file?path=${encodeURIComponent(rel)}`);
            log(`[daemon] ↓ deleted ${rel}\n`);
          } catch (e) {
            log(`[daemon] delete fail ${rel}: ${(e as Error).message}\n`);
          }
        }
        continue;
      }

      const localHash = sha256Of(text);
      const remote = byPath.get(rel);
      if (remote && remote.sha256 === localHash) continue; // unchanged

      try {
        await api("PUT", `/api/v1/vaults/${encodeURIComponent(opts.slug)}/file`, {
          path: rel,
          content: text,
          parentChecksum: remote?.sha256 ?? "",
        });
        log(`[daemon] ↑ ${remote ? "updated" : "created"} ${rel}\n`);
      } catch (e) {
        const msg = (e as Error).message;
        if (msg.includes("HTTP 409") && remote) {
          // Conflict — kullanıcıdan resolution iste
          let serverContent = "";
          try {
            const fresh = await api(
              "GET",
              `/api/v1/vaults/${encodeURIComponent(opts.slug)}/file?path=${encodeURIComponent(rel)}`,
            ) as { path: string; content: string };
            serverContent = fresh.content;
          } catch { /* ignore */ }
          const remoteHash = sha256Of(serverContent);
          const choice = await resolveConflict(rel, localHash, remoteHash);
          if (choice === "theirs") {
            await writeFile(full, serverContent, "utf8");
            log(`[daemon] ⊕ conflict ${rel} → theirs (lokal üzerine yazıldı)\n`);
          } else if (choice === "mine") {
            // Force push: parentChecksum'ı yeni server hash'i yap
            try {
              await api("PUT", `/api/v1/vaults/${encodeURIComponent(opts.slug)}/file`, {
                path: rel,
                content: text,
                parentChecksum: remoteHash,
              });
              log(`[daemon] ⊕ conflict ${rel} → mine (üzerine push)\n`);
            } catch (e2) {
              log(`[daemon] mine push fail ${rel}: ${(e2 as Error).message}\n`);
            }
          } else {
            const sidecar = full + `.conflict-${Date.now()}`;
            await writeFile(sidecar, serverContent, "utf8");
            log(`[daemon] ⚠ conflict ${rel} — kapalı (sidecar: ${sidecar})\n`);
          }
        } else {
          log(`[daemon] push fail ${rel}: ${msg}\n`);
        }
      }
    }
  };

  const scheduleFlush = () => {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      void flushDirty();
    }, debounceMs);
  };

  // ── fs.watch — recursive (macOS + Win destekler; Linux fallback)
  let watcher: ReturnType<typeof watch> | null = null;
  try {
    watcher = watch(opts.localDir, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const rel = filename.toString().replace(/\\/g, "/");
      if (shouldIgnore(rel)) return;
      dirty.add(rel);
      scheduleFlush();
    });
  } catch (e) {
    log(`[daemon] fs.watch hatası (Linux'ta recursive desteklenmiyor olabilir): ${(e as Error).message}\n`);
  }

  // ── Remote → Local SSE pipeline ────────────────────────────────────────
  const sseAbort = new AbortController();
  const handleEvent = async (ev: VaultFileEvent) => {
    if (shouldIgnore(ev.path)) return;
    const full = join(opts.localDir, ev.path);

    if (ev.type === "deleted") {
      try {
        const { rm } = await import("node:fs/promises");
        await rm(full, { force: true });
        log(`[daemon] ↓ remote deleted ${ev.path}\n`);
      } catch (e) {
        log(`[daemon] remote delete fail ${ev.path}: ${(e as Error).message}\n`);
      }
      return;
    }

    // created/updated → pull
    try {
      const localText = await readTextSafe(full);
      if (localText !== null && ev.sha256 && sha256Of(localText) === ev.sha256) return; // already match

      const fresh = await api(
        "GET",
        `/api/v1/vaults/${encodeURIComponent(opts.slug)}/file?path=${encodeURIComponent(ev.path)}`,
      ) as { path: string; content: string };

      // Geçici olarak dirty set'inden çıkar (kendi push'umuzu tetiklemesin)
      dirty.delete(ev.path);

      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, fresh.content, "utf8");
      log(`[daemon] ↓ ${ev.type} ${ev.path} (remote → local)\n`);
    } catch (e) {
      log(`[daemon] pull fail ${ev.path}: ${(e as Error).message}\n`);
    }
  };

  // SSE reconnect loop
  let stopped = false;
  const sseLoop = (async () => {
    while (!stopped) {
      try {
        await consumeSse(
          `${getApiBase()}/api/v1/vaults/${encodeURIComponent(opts.slug)}/events`,
          token,
          ev => void handleEvent(ev),
          sseAbort.signal,
          log,
        );
        if (!stopped) {
          log(`[daemon] SSE bağlantısı kapandı, ${reconnectMs}ms sonra yeniden bağlan\n`);
          await new Promise(r => setTimeout(r, reconnectMs));
        }
      } catch (e) {
        if (stopped) return;
        log(`[daemon] SSE hatası: ${(e as Error).message} — ${reconnectMs}ms sonra retry\n`);
        await new Promise(r => setTimeout(r, reconnectMs));
      }
    }
  })();

  return {
    async stop() {
      stopped = true;
      if (pushTimer) clearTimeout(pushTimer);
      if (watcher) watcher.close();
      sseAbort.abort();
      try { await sseLoop; } catch { /* ignore */ }
      log(`[daemon] durduruldu · ${opts.slug}\n`);
    },
  };
}
