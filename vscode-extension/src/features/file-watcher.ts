import * as vscode from 'vscode';

type SendToCli = (method: string, params: Record<string, unknown>) => void;

const THROTTLE_MS = 1000;
const UNSAVED_DEBOUNCE_MS = 500;

function isWatchableUri(uri: vscode.Uri): boolean {
    if (uri.scheme !== 'file') {
        return false;
    }
    const path = uri.fsPath;
    if (path.includes(`${'/'}.git${'/'}`) || path.endsWith('/.git')) {
        return false;
    }
    if (path.includes(`${'/'}node_modules${'/'}`)) {
        return false;
    }
    // Cross-platform: also tolerate backslash separators on Windows.
    if (path.includes('\\.git\\') || path.includes('\\node_modules\\')) {
        return false;
    }
    return true;
}

function buildPayload(doc: vscode.TextDocument, kind: 'saved' | 'unsaved'): Record<string, unknown> {
    return {
        uri: doc.uri.toString(),
        language: doc.languageId,
        lineCount: doc.lineCount,
        kind,
        timestamp: Date.now(),
    };
}

/**
 * Bridge VS Code workspace file events into the Altaris MCP server so the CLI
 * can keep its live context view fresh.
 *
 * - `onDidSaveTextDocument` → always forwarded (subject to throttle).
 * - `onDidChangeTextDocument` → forwarded only when
 *   `altaris.fileWatcher.includeUnsaved` is `true`, debounced 500ms per uri.
 *
 * Per-uri throttle (1s) prevents bursty saves (e.g. format-on-save chains)
 * from flooding the websocket.
 */
export function registerFileWatcher(
    context: vscode.ExtensionContext,
    sendToCli: SendToCli,
): vscode.Disposable[] {
    const lastSentAt = new Map<string, number>();
    const debounceTimers = new Map<string, NodeJS.Timeout>();

    const emit = (doc: vscode.TextDocument, kind: 'saved' | 'unsaved'): void => {
        if (!isWatchableUri(doc.uri)) {
            return;
        }
        const key = doc.uri.toString();
        const now = Date.now();
        const last = lastSentAt.get(key) ?? 0;
        if (now - last < THROTTLE_MS) {
            return;
        }
        lastSentAt.set(key, now);
        try {
            sendToCli('notifications/altaris/fileChanged', buildPayload(doc, kind));
        } catch (err) {
            // Never let a transport hiccup take down the workspace listener.
            console.error('[altaris.fileWatcher] sendToCli failed', err);
        }
    };

    const saveSub = vscode.workspace.onDidSaveTextDocument((doc) => {
        emit(doc, 'saved');
    });

    const changeSub = vscode.workspace.onDidChangeTextDocument((event) => {
        const includeUnsaved = vscode.workspace
            .getConfiguration('altaris.fileWatcher')
            .get<boolean>('includeUnsaved', false);
        if (!includeUnsaved) {
            return;
        }
        const doc = event.document;
        if (!isWatchableUri(doc.uri)) {
            return;
        }
        const key = doc.uri.toString();
        const existing = debounceTimers.get(key);
        if (existing) {
            clearTimeout(existing);
        }
        const handle = setTimeout(() => {
            debounceTimers.delete(key);
            emit(doc, 'unsaved');
        }, UNSAVED_DEBOUNCE_MS);
        debounceTimers.set(key, handle);
    });

    const cleanup = new vscode.Disposable(() => {
        for (const t of debounceTimers.values()) {
            clearTimeout(t);
        }
        debounceTimers.clear();
        lastSentAt.clear();
    });

    const disposables: vscode.Disposable[] = [saveSub, changeSub, cleanup];
    context.subscriptions.push(...disposables);
    return disposables;
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
