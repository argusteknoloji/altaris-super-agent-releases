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
import { registerStatusBar, StatusBarHandle } from "./features/status-bar";
import { registerInlineEdit } from "./features/inline-edit";
import { registerQuickFix } from "./features/quick-fix";
import { registerNotifications, NotificationManager } from "./features/notifications";
import { registerCodeLens } from "./features/code-lens";
import { registerFileWatcher } from "./features/file-watcher";

let server: McpServer | undefined;
let lockfilePath: string | undefined;
let statusBarHandle: StatusBarHandle | undefined;
let notifs: NotificationManager | undefined;
const output = vscode.window.createOutputChannel("Altaris");

const log = (msg: string) => {
  const ts = new Date().toISOString();
  output.appendLine(`[${ts}] ${msg}`);
};

async function start(): Promise<void> {
  await stop();

  const authToken = generateAuthToken();
  server = await startMcpServer(authToken, log, {
    onModel: m => statusBarHandle?.setModel(m),
    onTokens: (input, output) => statusBarHandle?.setTokens({ input, output }),
    onConnection: (state, servers) => statusBarHandle?.setConnection({ state, servers }),
    onTaskStart: (id, title, cancellable) => notifs?.start(id, title, cancellable),
    onTaskUpdate: (id, progress, detail) => notifs?.update(id, progress ?? 0, detail),
    onTaskComplete: (id, title, detail, actions) => notifs?.complete(id, title, detail, actions),
    onTaskError: (id, title, detail) => notifs?.error(id, title, detail),
  });

  lockfilePath = await writeLockfile(server.port, {
    pid: process.pid,
    workspaceFolders: getWorkspaceFolders(),
    ideName: getIdeName(),
    transport: "ws",
    authToken,
    runningInWindows: os.platform() === "win32",
  });

  log(`Lockfile: ${lockfilePath}`);
  statusBarHandle?.setConnection({ state: "connected", servers: 1 });
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
  statusBarHandle?.setConnection({ state: "disconnected", servers: 0 });
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  log("Altaris extension activating");

  // ── Status bar (model · tokens · connection) ────────────────────────────
  statusBarHandle = registerStatusBar(context);
  context.subscriptions.push(statusBarHandle);

  // ── Notifications (long-running task progress + completion) ──────────────
  notifs = registerNotifications(context);
  notifs.onAction((id, actionId) => {
    // CLI'a kullanıcı action seçimini geri gönder
    server?.broadcast("notifications/altaris/taskAction", { id, actionId });
  });

  // ── Feature registrations ────────────────────────────────────────────────
  registerInlineEdit(context).forEach(d => context.subscriptions.push(d));
  context.subscriptions.push(registerQuickFix(context));
  context.subscriptions.push(registerCodeLens(context));
  registerFileWatcher(context, (method, params) => server?.broadcast(method, params)).forEach(d =>
    context.subscriptions.push(d),
  );

  // ── Terminal profile + altaris ikonu ─────────────────────────────────────
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

  // ── Commands ─────────────────────────────────────────────────────────────
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
    vscode.commands.registerCommand("altaris.restartBridge", async () => {
      // status-bar quick pick'inde kullanılan alias
      await vscode.commands.executeCommand("altaris.restart");
    }),
    vscode.commands.registerCommand("altaris.showOutput", () => output.show(true)),
    vscode.commands.registerCommand("altaris.openTerminal", openAltarisTerminal),
    vscode.commands.registerCommand("altaris.switchModel", async (model?: string) => {
      // Stub: status bar'dan tetiklenir; ileride CLI'a switch broadcast edilecek.
      if (model) {
        statusBarHandle?.setModel(model);
        server?.broadcast("notifications/altaris/switchModel", { model });
      }
    }),
  );

  // ── Workspace folder değişiminde restart ─────────────────────────────────
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
