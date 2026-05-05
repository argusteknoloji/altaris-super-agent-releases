import * as vscode from 'vscode';
import { runWithProgress, extractCodeBlock, formatAltarisError } from './altaris-runner';

const FIX_COMMAND_ID = 'altaris.fixWithAi';
const MAX_TITLE_LENGTH = 60;
const SNIPPET_CONTEXT_LINES = 5;

function truncate(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max - 1) + '…';
}

function escapeForShellSingleQuotes(input: string): string {
  // Wrap in single quotes by closing/escaping any embedded single quote.
  return `'${input.replace(/'/g, `'\\''`)}'`;
}

function buildSnippet(document: vscode.TextDocument, range: vscode.Range): string {
  const startLine = Math.max(0, range.start.line - SNIPPET_CONTEXT_LINES);
  const endLine = Math.min(document.lineCount - 1, range.end.line + SNIPPET_CONTEXT_LINES);
  const snippetRange = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
  return document.getText(snippetRange);
}

export class AltarisQuickFixProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken,
  ): vscode.CodeAction[] | undefined {
    if (!context.diagnostics || context.diagnostics.length === 0) {
      return undefined;
    }

    const actions: vscode.CodeAction[] = [];
    for (const diagnostic of context.diagnostics) {
      const title = `Fix with Altaris: ${truncate(diagnostic.message, MAX_TITLE_LENGTH)}`;
      const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
      action.diagnostics = [diagnostic];
      action.isPreferred = false;
      action.command = {
        command: FIX_COMMAND_ID,
        title,
        arguments: [diagnostic, document.uri, range instanceof vscode.Selection
          ? new vscode.Range(range.start, range.end)
          : range],
      };
      actions.push(action);
    }
    return actions;
  }
}

async function runAltarisFix(
  diagnostic: vscode.Diagnostic,
  uri: vscode.Uri,
  range: vscode.Range,
): Promise<void> {
  let document: vscode.TextDocument;
  try {
    document = await vscode.workspace.openTextDocument(uri);
  } catch (err) {
    vscode.window.showErrorMessage(`Altaris: dosya açılamadı (${(err as Error).message})`);
    return;
  }

  const snippet = buildSnippet(document, range);
  const errorMessage = diagnostic.message;
  const language = document.languageId;
  const lineHint = range.start.line + 1;

  const prompt =
    `Aşağıdaki ${language} kodundaki hatayı düzelt. Sadece düzeltilmiş kodu ` +
    `fenced code block içinde döndür, açıklama yazma.\n\n` +
    `Hata (satır ${lineHint}): ${errorMessage}\n\nKod:\n\`\`\`${language}\n${snippet}\n\`\`\``;

  const result = await runWithProgress("Altaris fix önerisi hazırlanıyor…", prompt);
  if (result.exitCode !== 0) {
    vscode.window.showErrorMessage(`Altaris fix hatası:\n${formatAltarisError(result)}`, { modal: false });
    return;
  }

  const fixedCode = extractCodeBlock(result.stdout);
  if (!fixedCode) {
    vscode.window.showWarningMessage(
      "Altaris cevabında fenced code block bulunamadı. Manuel uygula.",
    );
    return;
  }

  const choice = await vscode.window.showInformationMessage(
    "Altaris fix önerisi hazır. Uygula?",
    { modal: true, detail: fixedCode.length > 400 ? fixedCode.slice(0, 400) + "..." : fixedCode },
    "Uygula",
    "Diff göster",
  );

  if (choice === "Uygula") {
    const edit = new vscode.WorkspaceEdit();
    // Snippet ±5 satır aldı; tam aralığı doğru hesaplamak için orijinal range'i
    // genişlet (buildSnippet'e simetrik olarak).
    const startLine = Math.max(0, range.start.line - 5);
    const endLine = Math.min(document.lineCount - 1, range.end.line + 5);
    const fullRange = new vscode.Range(
      new vscode.Position(startLine, 0),
      new vscode.Position(endLine, document.lineAt(endLine).text.length),
    );
    edit.replace(uri, fullRange, fixedCode);
    await vscode.workspace.applyEdit(edit);
    vscode.window.showInformationMessage("Altaris fix uygulandı.");
  } else if (choice === "Diff göster") {
    // Geçici dosya oluştur, vscode.diff ile aç
    const original = document.getText();
    const startLine = Math.max(0, range.start.line - 5);
    const endLine = Math.min(document.lineCount - 1, range.end.line + 5);
    const before = document.getText(new vscode.Range(
      new vscode.Position(startLine, 0),
      new vscode.Position(endLine, document.lineAt(endLine).text.length),
    ));
    const newDoc = original.replace(before, fixedCode);
    const tmpUri = vscode.Uri.parse(`untitled:altaris-fix-${Date.now()}.${language}`);
    const tmpEdit = new vscode.WorkspaceEdit();
    tmpEdit.insert(tmpUri, new vscode.Position(0, 0), newDoc);
    await vscode.workspace.applyEdit(tmpEdit);
    await vscode.commands.executeCommand("vscode.diff", uri, tmpUri, "Altaris Fix");
  }
}

export function registerQuickFix(context: vscode.ExtensionContext): vscode.Disposable {
  const provider = new AltarisQuickFixProvider();

  const providerDisposable = vscode.languages.registerCodeActionsProvider(
    { language: '*' },
    provider,
    {
      providedCodeActionKinds: AltarisQuickFixProvider.providedCodeActionKinds,
    },
  );

  const commandDisposable = vscode.commands.registerCommand(
    FIX_COMMAND_ID,
    async (diagnostic: vscode.Diagnostic, uri: vscode.Uri, range: vscode.Range) => {
      if (!diagnostic || !uri || !range) {
        vscode.window.showWarningMessage('Altaris: quick fix komutu eksik argümanla çağrıldı.');
        return;
      }
      await runAltarisFix(diagnostic, uri, range);
    },
  );

  const aggregate = vscode.Disposable.from(providerDisposable, commandDisposable);
  context.subscriptions.push(aggregate);
  return aggregate;
}

/* INTEGRATION_NOTES:
 * - extension.ts activate(): context.subscriptions.push(registerQuickFix(context))
 * - package.json contributes.commands: { "command": "altaris.fixWithAi", "title": "Altaris: Fix with AI" }
 * - Gerçek edit roundtrip için TODO: openDiff tool'unu reverse-call ile tetikle
 */
