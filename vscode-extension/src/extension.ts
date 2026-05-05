import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import {
  generateAuthToken,
  getIdeName,
  getWorkspaceFolders,
  removeLockfile,
  writeLockfile,
} from "./lockfile";
import { startMcpServer, McpServer } from "./server";

let server: McpServer | undefined;
let lockfilePath: string | undefined;
let statusBar: vscode.StatusBarItem | undefined;
const output = vscode.window.createOutputChannel("Altaris");

const log = (msg: string) => {
  const ts = new Date().toISOString();
  output.appendLine(`[${ts}] ${msg}`);
};

async function start(): Promise<void> {
  await stop();

  const authToken = generateAuthToken();
  server = await startMcpServer(authToken, log);

  lockfilePath = await writeLockfile(server.port, {
    pid: process.pid,
    workspaceFolders: getWorkspaceFolders(),
    ideName: getIdeName(),
    transport: "ws",
    authToken,
    runningInWindows: os.platform() === "win32",
  });

  log(`Lockfile: ${lockfilePath}`);
  updateStatusBar();
}

async function stop(): Promise<void> {
  if (lockfilePath) {
    await removeLockfile(lockfilePath);
    lockfilePath = undefined;
  }
  if (server) {
    await server.close();
    server = undefined;
  }
  updateStatusBar();
}

function updateStatusBar() {
  if (!statusBar) return;
  if (server) {
    statusBar.text = `$(plug) Altaris :${server.port}`;
    statusBar.tooltip = "Altaris CLI köprüsü aktif. Tıklayarak yeniden başlat.";
  } else {
    statusBar.text = "$(debug-disconnect) Altaris";
    statusBar.tooltip = "Altaris köprüsü kapalı. Tıklayarak başlat.";
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  log("Altaris extension activating");

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = "altaris.restart";
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Terminal profile — "+" dropdown'ında "Altaris" girişi gösterir, altaris ikonuyla yeni terminal açar.
  // `altaris` binary'si install-shell ile PATH'e konmuş olmalı.
  const iconUri = vscode.Uri.file(path.join(context.extensionPath, "media", "altaris.svg"));
  context.subscriptions.push(
    vscode.window.registerTerminalProfileProvider("altaris.terminal-profile", {
      provideTerminalProfile() {
        return new vscode.TerminalProfile({
          name: "Altaris",
          shellPath: "altaris",
          shellArgs: [],
          iconPath: iconUri,
        });
      },
    }),
  );

  const openAltarisTerminal = () => {
    const term = vscode.window.createTerminal({
      name: "Altaris",
      shellPath: "altaris",
      iconPath: iconUri,
    });
    term.show();
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("altaris.showStatus", () => {
      const msg = server
        ? `Altaris köprüsü 127.0.0.1:${server.port} üzerinde dinliyor.`
        : "Altaris köprüsü kapalı.";
      vscode.window.showInformationMessage(msg);
    }),
    vscode.commands.registerCommand("altaris.restart", async () => {
      log("Manual restart");
      try {
        await start();
        vscode.window.showInformationMessage("Altaris köprüsü yeniden başladı.");
      } catch (err) {
        vscode.window.showErrorMessage(
          `Altaris başlatılamadı: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),
    vscode.commands.registerCommand("altaris.openTerminal", openAltarisTerminal),
  );

  // Workspace değişikliklerinde lockfile'ı güncelle (workspaceFolders alanı bayatlamasın).
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      log("Workspace folders changed → restart");
      void start();
    }),
  );

  try {
    await start();
  } catch (err) {
    log(`Failed to start: ${err instanceof Error ? err.message : String(err)}`);
    vscode.window.showErrorMessage(
      `Altaris başlatılamadı: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function deactivate(): Promise<void> {
  log("Altaris extension deactivating");
  await stop();
  output.dispose();
}
