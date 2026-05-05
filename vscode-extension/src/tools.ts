/**
 * MCP tool implementations — Altaris CLI bunları JSON-RPC `tools/call` ile çağırır.
 *
 * Sağlanan tool'lar:
 *  - openDiff           → editörde diff açar, kullanıcı kabul/red bekler
 *  - close_tab          → açık diff tab'ını kapat
 *  - getDiagnostics     → editör diagnostics (uri filtresi ile)
 *  - executeCode        → şu an stub (Jupyter entegrasyonu Faz 2.1'de)
 *  - getCurrentSelection → aktif editör seçimi
 *  - getOpenEditors     → açık editör listesi
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

export type McpContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

export interface ToolResult {
  content: McpContent[];
  isError?: boolean;
}

const t = (text: string): McpContent => ({ type: "text", text });

// ─────────────────────────────────────────────────────────────────────────────
// openDiff — editor diff view açıp kullanıcıdan onay bekler.
// ─────────────────────────────────────────────────────────────────────────────

interface OpenDiffArgs {
  old_file_path: string;
  new_file_path: string;
  new_file_contents: string;
  tab_name: string;
}

const activeDiffTabs = new Map<string, vscode.Disposable[]>();

export async function openDiff(args: OpenDiffArgs): Promise<ToolResult> {
  const { old_file_path, new_file_contents, tab_name } = args;

  // Geçici dosya oluştur (yeni içerik için).
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "altaris-diff-"));
  const tmpFile = path.join(tmpDir, path.basename(old_file_path));
  await fs.promises.writeFile(tmpFile, new_file_contents);

  const oldUri = vscode.Uri.file(old_file_path);
  const newUri = vscode.Uri.file(tmpFile);

  await vscode.commands.executeCommand("vscode.diff", oldUri, newUri, tab_name, {
    preview: false,
    preserveFocus: false,
  });

  return new Promise<ToolResult>(resolve => {
    const disposables: vscode.Disposable[] = [];
    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      disposables.forEach(d => d.dispose());
      activeDiffTabs.delete(tab_name);
      fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    };

    // Kullanıcı yeni dosyayı kaydederse → kabul et.
    disposables.push(
      vscode.workspace.onDidSaveTextDocument(async doc => {
        if (doc.uri.fsPath === tmpFile) {
          const saved = doc.getText();
          cleanup();
          resolve({
            content: [t("FILE_SAVED"), t(saved)],
          });
        }
      }),
    );

    // Tab kapatılırsa → red.
    disposables.push(
      vscode.window.tabGroups.onDidChangeTabs(e => {
        for (const closed of e.closed) {
          if (closed.label === tab_name) {
            cleanup();
            resolve({ content: [t("DIFF_REJECTED"), t("Diff rejected")] });
          }
        }
      }),
    );

    activeDiffTabs.set(tab_name, disposables);
  });
}

export async function closeTab(args: { tab_name: string }): Promise<ToolResult> {
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (tab.label === args.tab_name) {
        await vscode.window.tabGroups.close(tab);
      }
    }
  }
  const subs = activeDiffTabs.get(args.tab_name);
  if (subs) {
    subs.forEach(d => d.dispose());
    activeDiffTabs.delete(args.tab_name);
  }
  return { content: [t("TAB_CLOSED")] };
}

// ─────────────────────────────────────────────────────────────────────────────
// getDiagnostics — editör tarafındaki uyarı/hata listesi.
// ─────────────────────────────────────────────────────────────────────────────

export async function getDiagnostics(args: { uri?: string }): Promise<ToolResult> {
  const all = vscode.languages.getDiagnostics();
  const filtered = args.uri ? all.filter(([u]) => u.fsPath === args.uri) : all;

  const out = filtered
    .filter(([, ds]) => ds.length > 0)
    .map(([u, ds]) => ({
      uri: u.fsPath,
      diagnostics: ds.map(d => ({
        message: d.message,
        severity: d.severity,
        source: d.source,
        range: {
          start: { line: d.range.start.line, character: d.range.start.character },
          end: { line: d.range.end.line, character: d.range.end.character },
        },
        code:
          typeof d.code === "object" && d.code !== null
            ? (d.code as { value: unknown }).value
            : d.code,
      })),
    }));

  return { content: [t(JSON.stringify(out, null, 2))] };
}

// ─────────────────────────────────────────────────────────────────────────────
// executeCode — Jupyter notebook'ta cell çalıştır (features/jupyter.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { executeCodeImpl } from "./features/jupyter";
export const executeCode = executeCodeImpl;

// ─────────────────────────────────────────────────────────────────────────────
// getCurrentSelection / getOpenEditors — context tools
// ─────────────────────────────────────────────────────────────────────────────

export async function getCurrentSelection(): Promise<ToolResult> {
  const ed = vscode.window.activeTextEditor;
  if (!ed) return { content: [t(JSON.stringify({ selection: null }))] };
  const sel = ed.selection;
  return {
    content: [
      t(
        JSON.stringify({
          uri: ed.document.uri.fsPath,
          selection: ed.document.getText(sel),
          range: {
            start: { line: sel.start.line, character: sel.start.character },
            end: { line: sel.end.line, character: sel.end.character },
          },
        }),
      ),
    ],
  };
}

export async function getOpenEditors(): Promise<ToolResult> {
  const editors = vscode.window.visibleTextEditors.map(ed => ed.document.uri.fsPath);
  return { content: [t(JSON.stringify({ editors }))] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool registry
// ─────────────────────────────────────────────────────────────────────────────

export const TOOLS = {
  openDiff: {
    description: "VS Code editöründe iki dosya arasında diff aç ve kullanıcı kararını bekle.",
    inputSchema: {
      type: "object",
      properties: {
        old_file_path: { type: "string" },
        new_file_path: { type: "string" },
        new_file_contents: { type: "string" },
        tab_name: { type: "string" },
      },
      required: ["old_file_path", "new_file_contents", "tab_name"],
    },
    handler: openDiff,
  },
  close_tab: {
    description: "Açık bir diff tab'ını kapat.",
    inputSchema: {
      type: "object",
      properties: { tab_name: { type: "string" } },
      required: ["tab_name"],
    },
    handler: closeTab,
  },
  getDiagnostics: {
    description: "Editörden diagnostics (lint/type/error) al.",
    inputSchema: {
      type: "object",
      properties: { uri: { type: "string" } },
    },
    handler: getDiagnostics,
  },
  executeCode: {
    description: "Aktif Jupyter kernel'inde kod çalıştır (henüz desteklenmiyor).",
    inputSchema: {
      type: "object",
      properties: { code: { type: "string" } },
      required: ["code"],
    },
    handler: executeCode,
  },
  getCurrentSelection: {
    description: "Aktif editördeki seçimi getir.",
    inputSchema: { type: "object", properties: {} },
    handler: getCurrentSelection,
  },
  getOpenEditors: {
    description: "Açık editör dosyalarını listele.",
    inputSchema: { type: "object", properties: {} },
    handler: getOpenEditors,
  },
} as const;

export type ToolName = keyof typeof TOOLS;
