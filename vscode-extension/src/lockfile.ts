import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import * as vscode from "vscode";

export interface LockfileContent {
  pid: number;
  workspaceFolders: string[];
  ideName: string;
  transport: "ws";
  authToken: string;
  runningInWindows?: boolean;
}

export function getLockfileDir(): string {
  const cfg = vscode.workspace.getConfiguration("altaris").get<string>("lockfileDir");
  if (cfg && cfg.trim().length > 0) return cfg;
  return path.join(os.homedir(), ".altaris", "ide");
}

export function generateAuthToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function writeLockfile(port: number, content: LockfileContent): Promise<string> {
  const dir = getLockfileDir();
  await fs.promises.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${port}.lock`);
  await fs.promises.writeFile(file, JSON.stringify(content, null, 2), { mode: 0o600 });
  return file;
}

export async function removeLockfile(file: string): Promise<void> {
  try {
    await fs.promises.unlink(file);
  } catch {
    /* ignore */
  }
}

export function getIdeName(): string {
  // VS Code, Cursor, Windsurf etc. tüm forklar aynı API'yi kullanıyor.
  return vscode.env.appName ?? "VS Code";
}

export function getWorkspaceFolders(): string[] {
  return (vscode.workspace.workspaceFolders ?? []).map(f => f.uri.fsPath);
}
