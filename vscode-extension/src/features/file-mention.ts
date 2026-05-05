import * as vscode from 'vscode';
import * as path from 'path';

interface FileQuickPickItem extends vscode.QuickPickItem {
  relPath: string;
  recencyRank: number;
}

const FIND_GLOB = '**/*';
const EXCLUDE_GLOB = '**/{node_modules,dist,build,.git,out,.next}/**';
const MAX_FILES = 5000;

/**
 * Collect URIs of files that are currently or were recently open in any tab
 * group. Items closer to the front of the list are considered more recent.
 */
function collectRecentlyOpenedUris(): vscode.Uri[] {
  const uris: vscode.Uri[] = [];
  const seen = new Set<string>();

  for (const group of vscode.window.tabGroups.all) {
    // Active tab first within each group, then the rest in declaration order.
    const ordered: vscode.Tab[] = [];
    if (group.activeTab) {
      ordered.push(group.activeTab);
    }
    for (const tab of group.tabs) {
      if (tab !== group.activeTab) {
        ordered.push(tab);
      }
    }

    for (const tab of ordered) {
      const input = tab.input as { uri?: vscode.Uri } | undefined;
      const uri = input?.uri;
      if (!uri) {
        continue;
      }
      const key = uri.toString();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      uris.push(uri);
    }
  }

  return uris;
}

/**
 * Convert an absolute file URI to a workspace-root-relative POSIX path.
 * Returns null if the file is outside any open workspace folder.
 */
function toWorkspaceRelative(uri: vscode.Uri): string | null {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) {
    return null;
  }
  const rel = path.relative(folder.uri.fsPath, uri.fsPath);
  if (!rel || rel.startsWith('..')) {
    return null;
  }
  // Normalize to forward slashes for cross-platform mention paths.
  return rel.split(path.sep).join('/');
}

function buildQuickPickItem(relPath: string, recencyRank: number): FileQuickPickItem {
  const parent = path.posix.dirname(relPath);
  return {
    label: relPath,
    description: parent === '.' ? '' : parent,
    relPath,
    recencyRank,
  };
}

async function gatherWorkspaceFiles(
  token: vscode.CancellationToken,
): Promise<FileQuickPickItem[]> {
  const recentUris = collectRecentlyOpenedUris();
  const recencyByRel = new Map<string, number>();
  recentUris.forEach((uri, index) => {
    const rel = toWorkspaceRelative(uri);
    if (rel && !recencyByRel.has(rel)) {
      recencyByRel.set(rel, index);
    }
  });

  const found = await vscode.workspace.findFiles(FIND_GLOB, EXCLUDE_GLOB, MAX_FILES, token);

  const items: FileQuickPickItem[] = [];
  const seen = new Set<string>();

  for (const uri of found) {
    const rel = toWorkspaceRelative(uri);
    if (!rel || seen.has(rel)) {
      continue;
    }
    seen.add(rel);
    const recencyRank = recencyByRel.has(rel)
      ? (recencyByRel.get(rel) as number)
      : Number.POSITIVE_INFINITY;
    items.push(buildQuickPickItem(rel, recencyRank));
  }

  // Make sure recently-opened files that may have been excluded by the glob
  // (e.g. user explicitly opened something inside `dist/`) still appear.
  for (const [rel, rank] of recencyByRel) {
    if (!seen.has(rel)) {
      seen.add(rel);
      items.push(buildQuickPickItem(rel, rank));
    }
  }

  items.sort((a, b) => {
    if (a.recencyRank !== b.recencyRank) {
      return a.recencyRank - b.recencyRank;
    }
    return a.relPath.localeCompare(b.relPath);
  });

  return items;
}

async function insertMention(relPath: string): Promise<void> {
  const mention = `@${relPath}`;

  const terminal = vscode.window.activeTerminal;
  if (terminal) {
    terminal.show(true);
    terminal.sendText(mention, false);
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const selections = editor.selections;
    await editor.edit((editBuilder) => {
      for (const selection of selections) {
        if (selection.isEmpty) {
          editBuilder.insert(selection.active, mention);
        } else {
          editBuilder.replace(selection, mention);
        }
      }
    });
    return;
  }

  await vscode.env.clipboard.writeText(mention);
  void vscode.window.showInformationMessage(
    `Altaris: Aktif terminal/editor yok, "${mention}" panoya kopyalandı.`,
  );
}

export function registerFileMention(
  context: vscode.ExtensionContext,
): vscode.Disposable[] {
  void context;

  const command = vscode.commands.registerCommand(
    'altaris.insertWorkspaceFile',
    async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        void vscode.window.showWarningMessage(
          'Altaris: Açık bir workspace yok, dosya seçilemiyor.',
        );
        return;
      }

      const tokenSource = new vscode.CancellationTokenSource();

      try {
        const items = await vscode.window.withProgress<FileQuickPickItem[]>(
          {
            location: vscode.ProgressLocation.Window,
            title: 'Altaris: Workspace dosyaları taranıyor...',
            cancellable: true,
          },
          async (_progress, progressToken) => {
            progressToken.onCancellationRequested(() => tokenSource.cancel());
            return gatherWorkspaceFiles(tokenSource.token);
          },
        );

        if (tokenSource.token.isCancellationRequested) {
          return;
        }

        if (items.length === 0) {
          void vscode.window.showInformationMessage(
            'Altaris: Workspace içinde uygun dosya bulunamadı.',
          );
          return;
        }

        const picked = await vscode.window.showQuickPick<FileQuickPickItem>(items, {
          matchOnDescription: true,
          matchOnDetail: false,
          placeHolder: 'Mention edilecek dosyayı seç (fuzzy filter)',
          ignoreFocusOut: false,
        });

        if (!picked) {
          return;
        }

        await insertMention(picked.relPath);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(
          `Altaris: Dosya seçici çalıştırılamadı — ${message}`,
        );
      } finally {
        tokenSource.dispose();
      }
    },
  );

  return [command];
}

/* INTEGRATION_NOTES:
 * - extension.ts: registerFileMention(context).forEach(d => context.subscriptions.push(d))
 * - package.json contributes.commands: { "command": "altaris.insertWorkspaceFile", "title": "Altaris: Workspace dosyası ekle (@)" }
 * - package.json contributes.keybindings:
 *     { "command": "altaris.insertWorkspaceFile", "key": "shift+ctrl+2", "mac": "shift+cmd+2" }
 *   (Cmd+Shift+@ yerine Cmd+Shift+2 — VS Code @ keybind'a izin vermiyor)
 */
