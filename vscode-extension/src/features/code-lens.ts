import * as vscode from 'vscode';

/**
 * AltarisCodeLensProvider
 *
 * Adds three small action lenses ("Explain · Test · Refactor") above every
 * function / method in the active document. The lenses are produced from the
 * VS Code symbol provider so we get language-agnostic coverage (TS, Python,
 * C#, Go, Rust, …) without writing per-language regexes.
 *
 * Clicking a lens dispatches a command that forwards the selected code
 * snippet to the Altaris CLI through the active integrated terminal.
 */
export class AltarisCodeLensProvider implements vscode.CodeLensProvider {
    private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor() {
        // Re-render lenses when the user toggles the setting or edits the doc.
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('altaris.codeLens')) {
                this._onDidChangeCodeLenses.fire();
            }
        });
        vscode.workspace.onDidChangeTextDocument(() => {
            this._onDidChangeCodeLenses.fire();
        });
    }

    public async provideCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken,
    ): Promise<vscode.CodeLens[]> {
        const enabled = vscode.workspace
            .getConfiguration('altaris.codeLens')
            .get<boolean>('enabled', true);
        if (!enabled) {
            return [];
        }

        let symbols: vscode.DocumentSymbol[] | undefined;
        try {
            symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri,
            );
        } catch {
            return [];
        }
        if (!symbols || symbols.length === 0 || token.isCancellationRequested) {
            return [];
        }

        const lenses: vscode.CodeLens[] = [];
        const visit = (nodes: vscode.DocumentSymbol[]): void => {
            for (const node of nodes) {
                if (
                    node.kind === vscode.SymbolKind.Function ||
                    node.kind === vscode.SymbolKind.Method
                ) {
                    const range = new vscode.Range(node.range.start, node.range.start);
                    const args = [document.uri, node.range, node.name];
                    lenses.push(
                        new vscode.CodeLens(range, {
                            title: '$(sparkle) Explain',
                            command: 'altaris.lens.explain',
                            arguments: args,
                        }),
                        new vscode.CodeLens(range, {
                            title: '$(beaker) Test',
                            command: 'altaris.lens.test',
                            arguments: args,
                        }),
                        new vscode.CodeLens(range, {
                            title: '$(wand) Refactor',
                            command: 'altaris.lens.refactor',
                            arguments: args,
                        }),
                    );
                }
                if (node.children && node.children.length > 0) {
                    visit(node.children);
                }
            }
        };
        visit(symbols);
        return lenses;
    }
}

type LensAction = 'explain' | 'test' | 'refactor';

function buildPrompt(action: LensAction, name: string, code: string): string {
    switch (action) {
        case 'explain':
            return `explain function ${name}: ${code}`;
        case 'test':
            return `write unit tests for function ${name}: ${code}`;
        case 'refactor':
            return `refactor function ${name} for clarity & performance: ${code}`;
    }
}

function getOrCreateAltarisTerminal(): vscode.Terminal {
    const existing = vscode.window.terminals.find((t) => t.name === 'Altaris');
    if (existing) {
        return existing;
    }
    return vscode.window.createTerminal({ name: 'Altaris' });
}

async function dispatch(
    action: LensAction,
    uri: vscode.Uri,
    range: vscode.Range,
    symbolName: string,
): Promise<void> {
    let code = '';
    try {
        const doc = await vscode.workspace.openTextDocument(uri);
        code = doc.getText(range);
    } catch {
        // best-effort: fall back to symbol name only
    }

    // Single-line + escape double quotes so the shell doesn't choke.
    const flat = code.replace(/\s+/g, ' ').replace(/"/g, '\\"').trim();
    const prompt = buildPrompt(action, symbolName, flat);
    const terminal = getOrCreateAltarisTerminal();
    terminal.show(true);
    terminal.sendText(`altaris -p "${prompt}"`, true);
}

/**
 * Wire the code lens provider + the three lens command handlers into the
 * extension lifecycle. Returns a Disposable that the caller is expected to
 * push onto `context.subscriptions`.
 */
export function registerCodeLens(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new AltarisCodeLensProvider();

    const providerDisposable = vscode.languages.registerCodeLensProvider(
        { scheme: 'file' },
        provider,
    );

    const explainDisposable = vscode.commands.registerCommand(
        'altaris.lens.explain',
        (uri: vscode.Uri, range: vscode.Range, symbolName: string) =>
            dispatch('explain', uri, range, symbolName),
    );
    const testDisposable = vscode.commands.registerCommand(
        'altaris.lens.test',
        (uri: vscode.Uri, range: vscode.Range, symbolName: string) =>
            dispatch('test', uri, range, symbolName),
    );
    const refactorDisposable = vscode.commands.registerCommand(
        'altaris.lens.refactor',
        (uri: vscode.Uri, range: vscode.Range, symbolName: string) =>
            dispatch('refactor', uri, range, symbolName),
    );

    const composite = vscode.Disposable.from(
        providerDisposable,
        explainDisposable,
        testDisposable,
        refactorDisposable,
    );
    context.subscriptions.push(composite);
    return composite;
}

/* INTEGRATION_NOTES:
 * code-lens.ts:
 * - extension.ts: context.subscriptions.push(registerCodeLens(context))
 * - package.json contributes.commands: altaris.lens.{explain,test,refactor}
 * - package.json contributes.configuration: "altaris.codeLens.enabled": boolean default true
 *
 * file-watcher.ts:
 * - extension.ts: const dispose = registerFileWatcher(context, (m,p) => server.broadcast(m,p))
 * - server.ts'e "broadcast(method, params)" helper ekle: tüm bağlı ws clientlara JSON-RPC notification gönder
 * - package.json contributes.configuration: "altaris.fileWatcher.includeUnsaved": boolean default false
 */
