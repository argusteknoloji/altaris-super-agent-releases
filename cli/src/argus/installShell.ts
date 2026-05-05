/**
 * `altaris shell-install` — VS Code'un "Install 'code' command in PATH" muadili.
 *
 * Çalışan binary'i (process.execPath) sistem PATH'inde erişilebilir yapar:
 *   - macOS/Linux: /usr/local/bin/altaris symlink (yazılamazsa ~/.local/bin/altaris)
 *   - Windows: %LOCALAPPDATA%\Programs\altaris\altaris.exe + User PATH
 *
 * --with-vscode bayrağı: bundle edilmiş VSIX'i `code --install-extension` ile kurar.
 * (VSIX bundle'ı Faz 3'te eklenecek; o zamana kadar uyarı verir.)
 */

import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

type Result = { ok: boolean; path?: string; message: string };

function getSelfBinaryPath(): string {
  // bun --compile binary'sinde process.execPath kendi binary'imizdir.
  // Dev modda (node dist/cli.mjs) execPath = node, dolayısıyla CLI bundle yolu döner.
  return process.execPath;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function tryWriteSymlink(target: string, linkPath: string): Promise<Result> {
  try {
    if (existsSync(linkPath)) {
      // Aynı yere işaret eden geçerli symlink varsa atla.
      try {
        const cur = await fs.readlink(linkPath);
        if (cur === target) {
          return { ok: true, path: linkPath, message: `Zaten kurulu: ${linkPath}` };
        }
      } catch {
        // Symlink değil — üzerine yazma riski; kullanıcı eski binary tutuyor olabilir.
        return {
          ok: false,
          message: `${linkPath} mevcut ve symlink değil. Manuel kaldır ve tekrar dene.`,
        };
      }
      await fs.unlink(linkPath);
    }
    await fs.mkdir(path.dirname(linkPath), { recursive: true });
    await fs.symlink(target, linkPath);
    return { ok: true, path: linkPath, message: `Symlink oluşturuldu: ${linkPath} → ${target}` };
  } catch (err) {
    return { ok: false, message: `${linkPath}: ${(err as Error).message}` };
  }
}

async function installUnix(target: string): Promise<Result> {
  const candidates = ["/usr/local/bin/altaris", path.join(homedir(), ".local/bin/altaris")];

  for (const linkPath of candidates) {
    const r = await tryWriteSymlink(target, linkPath);
    if (r.ok) {
      // ~/.local/bin PATH'te değilse uyar.
      if (linkPath.includes(".local/bin")) {
        const pathEnv = process.env.PATH ?? "";
        if (!pathEnv.split(":").includes(path.dirname(linkPath))) {
          r.message += `\nUyarı: ${path.dirname(linkPath)} PATH'te değil. Shell rc dosyana ekle:\n  export PATH="$HOME/.local/bin:$PATH"`;
        }
      }
      return r;
    }
  }

  return {
    ok: false,
    message:
      "Hiçbir hedefe yazılamadı. /usr/local/bin için sudo gerekebilir veya ~/.local/bin oluşturulamadı.",
  };
}

async function installWindows(target: string): Promise<Result> {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    return { ok: false, message: "LOCALAPPDATA çevre değişkeni yok." };
  }
  const installDir = path.join(localAppData, "Programs", "altaris");
  const installPath = path.join(installDir, "altaris.exe");

  try {
    await fs.mkdir(installDir, { recursive: true });
    // Windows'ta symlink yetkisi sorun yaratır — kopyalama daha güvenli.
    await fs.copyFile(target, installPath);
  } catch (err) {
    return { ok: false, message: `Kopyalama hatası: ${(err as Error).message}` };
  }

  // User PATH'e ekle (idempotent).
  try {
    const { stdout } = await exec("powershell.exe", [
      "-NoProfile",
      "-Command",
      "[Environment]::GetEnvironmentVariable('Path','User')",
    ]);
    const userPath = (stdout ?? "").trim();
    const parts = userPath.split(";").filter(Boolean);
    if (!parts.some(p => path.normalize(p).toLowerCase() === installDir.toLowerCase())) {
      const newPath = parts.length > 0 ? `${userPath};${installDir}` : installDir;
      await exec("powershell.exe", [
        "-NoProfile",
        "-Command",
        `[Environment]::SetEnvironmentVariable('Path','${newPath.replace(/'/g, "''")}','User')`,
      ]);
      return {
        ok: true,
        path: installPath,
        message: `Kuruldu: ${installPath}\nUser PATH güncellendi. Yeni terminal aç.`,
      };
    }
    return { ok: true, path: installPath, message: `Kuruldu: ${installPath} (PATH zaten içeriyor)` };
  } catch (err) {
    return {
      ok: true,
      path: installPath,
      message: `Kuruldu: ${installPath}\nUyarı: PATH otomatik güncellenemedi: ${(err as Error).message}\nManuel ekle: ${installDir}`,
    };
  }
}

async function findVscodeCommand(): Promise<string | null> {
  const candidates =
    platform() === "win32" ? ["code.cmd", "code"] : ["code", "code-insiders", "cursor", "windsurf"];
  for (const c of candidates) {
    try {
      await exec(c, ["--version"]);
      return c;
    } catch {
      /* not found */
    }
  }
  return null;
}

async function installVsixIfBundled(): Promise<Result> {
  // VSIX bundle yolu: release binary'nin yanında extension/altaris.vsix.
  // Dev modunda repo root'taki vscode-extension/altaris.vsix.
  const exeDir = path.dirname(getSelfBinaryPath());
  const candidates = [
    path.join(exeDir, "extension", "altaris.vsix"),
    path.join(exeDir, "..", "extension", "altaris.vsix"),
    path.join(exeDir, "altaris.vsix"),
    // Dev: cli/bin/altaris → ../../vscode-extension/altaris.vsix
    path.join(exeDir, "..", "..", "vscode-extension", "altaris.vsix"),
    path.join(exeDir, "..", "vscode-extension", "altaris.vsix"),
    path.join(process.cwd(), "vscode-extension", "altaris.vsix"),
    path.join(process.cwd(), "..", "vscode-extension", "altaris.vsix"),
  ];
  const vsix = candidates.find(p => existsSync(p));
  if (!vsix) {
    return {
      ok: false,
      message:
        "VSIX bundle bulunamadı. Bu sürüm henüz extension içermiyor — yeni release çıkana kadar bekle.",
    };
  }
  const code = await findVscodeCommand();
  if (!code) {
    return { ok: false, message: "VS Code (code komutu) bulunamadı. PATH'te değil mi?" };
  }
  try {
    await exec(code, ["--force", "--install-extension", vsix]);
    return { ok: true, path: vsix, message: `VS Code extension kuruldu: ${vsix}` };
  } catch (err) {
    return { ok: false, message: `Extension kurulamadı: ${(err as Error).message}` };
  }
}

export interface InstallShellOptions {
  withVscode?: boolean;
}

export async function altarisInstallShell(opts: InstallShellOptions): Promise<number> {
  const target = getSelfBinaryPath();

  // Dev modu uyarısı: node ile çalışıyorsa dist/cli.mjs'i symlink etmek yanlış olur.
  if (!path.basename(target).toLowerCase().startsWith("altaris") && !path.basename(target).toLowerCase().startsWith("bun")) {
    process.stderr.write(
      `Uyarı: çalışan executable '${target}'. Dev modunda olabilirsin — shell-install sadece release binary üzerinde anlamlıdır.\n`,
    );
  }

  process.stdout.write(`Hedef binary: ${target}\n`);

  const r = platform() === "win32" ? await installWindows(target) : await installUnix(target);
  process.stdout.write(`${r.message}\n`);

  let exitCode = r.ok ? 0 : 1;

  if (opts.withVscode) {
    process.stdout.write("\nVS Code extension kurulumu deneniyor...\n");
    const v = await installVsixIfBundled();
    process.stdout.write(`${v.message}\n`);
    if (!v.ok) exitCode = exitCode || 2;
  } else {
    process.stdout.write("\nİpucu: VS Code entegrasyonu için: altaris shell-install --with-vscode\n");
  }

  return exitCode;
}
