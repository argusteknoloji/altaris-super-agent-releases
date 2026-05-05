import * as vscode from 'vscode';

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

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Altaris analyzing…',
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: 'Hata Altaris CLI\'a gönderiliyor' });

      const prompt = `fix this error: ${errorMessage}\n\ncode:\n${snippet}`;
      const command = `altaris -p ${escapeForShellSingleQuotes(prompt)}`;

      let terminal = vscode.window.activeTerminal;
      if (!terminal) {
        terminal = vscode.window.createTerminal({ name: 'Altaris Fix' });
      }
      terminal.show(true);
      terminal.sendText(command, true);

      // Stub: gerçek edit roundtrip eklenince burada MCP/openDiff tetiklenecek.
      await new Promise<void>((resolve) => setTimeout(resolve, 5000));
    },
  );

  vscode.window.showInformationMessage(
    'Altaris CLI\'ı kontrol et: kuşlandırılan düzeltme önerisi terminalde hazır.',
  );
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
