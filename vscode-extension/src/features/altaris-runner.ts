/**
 * altaris CLI'ı headless modda (`altaris -p "<prompt>"`) çalıştıran ortak helper.
 *
 * inline-edit, quick-fix, code-lens stub'larının CLI'a gerçek model çağrısı
 * yapabilmesi için ortak nokta. CLI stdin'e prompt gitmez — argv ile gider
 * (`-p` non-interactive print mode). Çıktı stdout'tan toplanır.
 *
 * altaris binary'sinin PATH'te olması gerek (kullanıcı `altaris shell-install`
 * çalıştırmış olmalı). Bulamazsa anlamlı bir hata gösterir.
 */

import * as vscode from "vscode";
import { spawn } from "child_process";

export interface RunOptions {
  /** Çalışma dizini (varsayılan: workspace root) */
  cwd?: string;
  /** Cancellation token (kullanıcı withProgress'i iptal ederse) */
  signal?: AbortSignal;
  /** Streaming progress callback (her stdout chunk'ı için tetiklenir) */
  onChunk?: (chunk: string) => void;
  /** Maks bekleme süresi (default 120 sn) */
  timeoutMs?: number;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Workspace root'u bul. Tek workspace varsa onu, çoklu workspace'te ilkini döner.
 * Hiç workspace yoksa undefined.
 */
function defaultCwd(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) return folders[0].uri.fsPath;
  return undefined;
}

/**
 * altaris binary'sini bul. PATH'te 'altaris' bekliyoruz; bulunamazsa
 * common kurulum yollarını da dene.
 */
function resolveAltarisBinary(): string {
  // child_process.spawn 'altaris' ismini PATH'te arar — most cases yeter.
  // Spawn ENOENT atarsa caller hata mesajı gösterir.
  return "altaris";
}

/**
 * altaris CLI'ı çağırıp stdout'u topla. Hata durumunda exitCode != 0 döner;
 * spawn ENOENT (binary yok) durumunda Error fırlatır.
 */
export async function runAltaris(prompt: string, opts: RunOptions = {}): Promise<RunResult> {
  const cwd = opts.cwd ?? defaultCwd();
  const timeoutMs = opts.timeoutMs ?? 120_000;

  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(resolveAltarisBinary(), ["-p", prompt], {
      cwd,
      env: {
        ...process.env,
        // Print modunda terminal/TTY check yapmasın, telemetri/auto-update
        // gibi background prefetch'leri atlasın → daha hızlı + temiz exit kodu.
        FORCE_COLOR: "0",
        NO_COLOR: "1",
        TERM: "dumb",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result: RunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { child.kill("SIGTERM"); } catch { /* ignore */ }
      reject(err);
    };

    const timer = setTimeout(() => {
      fail(new Error(`altaris timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    if (opts.signal) {
      opts.signal.addEventListener("abort", () => {
        fail(new Error("altaris iptal edildi"));
      });
    }

    child.stdout?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      opts.onChunk?.(chunk);
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        fail(new Error(
          "'altaris' komutu PATH'te bulunamadı. Önce 'altaris shell-install' ile kur.",
        ));
      } else {
        fail(err);
      }
    });

    child.on("close", (code: number | null) => {
      finish({ stdout, stderr, exitCode: code ?? -1 });
    });
  });
}

/**
 * Code-fenced (```lang ... ```) blokları çıkar. CLI cevabında genelde tek bir
 * fenced block olur (model "buyrun" edip kod bloğu basıyor).
 */
export function extractCodeBlock(text: string): string | null {
  const match = text.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
  return match?.[1] ?? null;
}

/**
 * RunResult'tan kullanıcıya gösterilecek anlamlı hata mesajı üret.
 * stderr boşsa stdout'u inceleyip provider/auth ipuçları ekler.
 */
export function formatAltarisError(result: RunResult): string {
  const parts: string[] = [];
  parts.push(`altaris exit ${result.exitCode}`);

  // Common errors → human-readable hint
  const all = `${result.stderr}\n${result.stdout}`.toLowerCase();
  if (all.includes("provider") && (all.includes("yetkilen") || all.includes("authoriz") || all.includes("not configured"))) {
    parts.push("Provider yetkilendirmesi yok — `altaris login` veya `ANTHROPIC_API_KEY` set et.");
  } else if (all.includes("model") && all.includes("not available")) {
    parts.push("Aktif model erişilebilir değil — `/model` ile farklı model seç.");
  } else if (all.includes("rate limit") || all.includes("429")) {
    parts.push("Rate limit — biraz bekle.");
  } else if (all.includes("network") || all.includes("econnrefused") || all.includes("enotfound")) {
    parts.push("Ağ hatası — internet bağlantını kontrol et.");
  }

  // Add stderr/stdout snippets (truncated)
  const stderr = result.stderr.trim().slice(0, 300);
  const stdout = result.stdout.trim().slice(0, 300);
  if (stderr) parts.push(`stderr: ${stderr}`);
  if (!stderr && stdout) parts.push(`stdout: ${stdout}`);
  if (!stderr && !stdout) parts.push("(stdout + stderr boş — `altaris -p \"test\"` terminalden manuel çalıştırıp deneyin)");

  return parts.join("\n");
}

/**
 * CLI'a withProgress'li bir çağrı yap; sonuç stdout'unu döner.
 * Çağıran taraf code block extraction'ı kendi yapar (ya extractCodeBlock ile
 * ya regex'le ya raw stdout'u alır).
 */
export async function runWithProgress(
  title: string,
  prompt: string,
  opts: RunOptions = {},
): Promise<RunResult> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: true,
    },
    async (progress, token) => {
      const ac = new AbortController();
      token.onCancellationRequested(() => ac.abort());
      let lastReport = Date.now();
      return runAltaris(prompt, {
        ...opts,
        signal: ac.signal,
        onChunk: chunk => {
          // Throttle progress reports to 200ms; show last line as progress message.
          const now = Date.now();
          if (now - lastReport > 200) {
            const lines = chunk.split("\n").filter(l => l.trim().length > 0);
            const last = lines[lines.length - 1];
            if (last) progress.report({ message: last.slice(0, 80) });
            lastReport = now;
          }
        },
      });
    },
  );
}
