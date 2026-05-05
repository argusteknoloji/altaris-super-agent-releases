import * as vscode from 'vscode';

/**
 * Altaris inline edit (Cursor/Copilot Cmd+I tarzı).
 *
 * MVP davranışı:
 *   1. Aktif editordeki seçimi alır (yoksa uyarı).
 *   2. Kullanıcıdan prompt ister ("make async", "rename to X" ...).
 *   3. Progress notification ile "Altaris'a bağlanıyor..." gösterir.
 *   4. STUB: gerçek MCP roundtrip yerine seçili kodu prompt'la sarmalayan
 *      bir öneri üretir, kullanıcıya kabul/red sorar.
 *   5. Kabul ederse seçili aralığı WorkspaceEdit ile değiştirir.
 *
 * Gerçek model çağrısı için ileride server.ts'e "altaris.invokePrompt"
 * reverse-RPC eklenecek (TODO Faz 11.1) — bu dosyada `callAltaris()` stub'ı
 * yerine onun client'ı çağrılacak.
 */

const COMMAND_ID = 'altaris.inlineEdit';

interface AltarisInlineResult {
  readonly newText: string;
  readonly note?: string;
}

/**
 * Stub: gerçekte CLI'a (MCP/HTTP) request atacak. Şimdilik seçimi
 * prompt ile sarmalayan deterministik bir placeholder döndürür.
 */
async function callAltaris(
  prompt: string,
  selection: string,
  languageId: string,
): Promise<AltarisInlineResult> {
  // TODO(faz-11.1): server.ts -> "altaris.invokePrompt" reverse-RPC çağrısı.
  // Şimdilik sadece UI scaffolding için stub.
  const commentToken = pickCommentToken(languageId);
  const newText =
    `${commentToken} altaris-inline-edit prompt: ${prompt}\n` +
    `${commentToken} TODO: replace with altaris result\n` +
    selection;
  return { newText, note: 'stub (MCP roundtrip henüz bağlanmadı)' };
}

function pickCommentToken(languageId: string): string {
  switch (languageId) {
    case 'python':
    case 'shellscript':
    case 'yaml':
    case 'ruby':
      return '#';
    case 'sql':
      return '--';
    case 'html':
    case 'xml':
      return '<!--';
    default:
      return '//';
  }
}

async function runInlineEdit(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage('Altaris: aktif editor yok.');
    return;
  }

  const { selection, document } = editor;
  if (selection.isEmpty) {
    void vscode.window.showWarningMessage(
      'Altaris: önce düzenlenecek bir kod parçası seç.',
    );
    return;
  }

  const selectedText = document.getText(selection);

  const prompt = await vscode.window.showInputBox({
    prompt: "Altaris'a ne yapsın?",
    placeHolder: 'make async, rename to X, add tests...',
    ignoreFocusOut: true,
  });
  if (!prompt || prompt.trim().length === 0) {
    return;
  }

  const result = await vscode.window.withProgress<AltarisInlineResult | undefined>(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Altaris'a bağlanıyor...",
      cancellable: false,
    },
    async () => {
      try {
        return await callAltaris(prompt, selectedText, document.languageId);
      } catch (err) {
        void vscode.window.showErrorMessage(
          `Altaris inline edit hatası: ${(err as Error).message}`,
        );
        return undefined;
      }
    },
  );

  if (!result) {
    return;
  }

  const choice = await vscode.window.showInformationMessage(
    `Altaris öneri hazır${result.note ? ` (${result.note})` : ''}. Uygula?`,
    { modal: true },
    'Uygula',
    'İptal',
  );
  if (choice !== 'Uygula') {
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, selection, result.newText);
  const ok = await vscode.workspace.applyEdit(edit);
  if (!ok) {
    void vscode.window.showErrorMessage(
      'Altaris: düzenleme uygulanamadı (workspace edit reddedildi).',
    );
    return;
  }

  void vscode.window.setStatusBarMessage('Altaris: inline edit uygulandı', 3000);
}

export function registerInlineEdit(
  _context: vscode.ExtensionContext,
): vscode.Disposable[] {
  const cmd = vscode.commands.registerCommand(COMMAND_ID, () => {
    void runInlineEdit();
  });
  return [cmd];
}

/* INTEGRATION_NOTES:
 * - extension.ts activate(): registerInlineEdit(context).forEach(d => context.subscriptions.push(d))
 * - package.json contributes.commands: { "command": "altaris.inlineEdit", "title": "Altaris: Inline edit" }
 * - package.json contributes.keybindings:
 *   { "command": "altaris.inlineEdit", "key": "cmd+i", "mac": "cmd+i", "win": "ctrl+i", "when": "editorTextFocus" }
 * - Gerçek MCP roundtrip için server.ts'e "altaris.invokePrompt" reverse-RPC gerekir (TODO Faz 11.1)
 */
