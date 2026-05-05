import * as vscode from 'vscode';

/**
 * DiffActionTracker
 * -----------------
 * Active diff tab'larını izleyip kullanıcıya inline (toast + CodeLens) "Accept / Reject"
 * butonları gösterir. Save (kabul) / Tab kapat (red) fallback'i extension.ts +
 * tools.ts tarafında korunmaya devam eder; bu modül sadece "tek tıkla" UX katmanıdır.
 */

type DiffCallbacks = {
    onAccept: () => void;
    onReject: () => void;
    onEdit?: () => void;
};

type TrackedEntry = {
    tabName: string;
    callbacks: DiffCallbacks;
    /** Toast şu anda açık mı (yarış koşullarını önlemek için). */
    toastOpen: boolean;
};

/** vscode.diff komutuyla açılan tab'ları best-effort olarak teşhis eder. */
function isDiffTab(tab: vscode.Tab): boolean {
    return tab.input instanceof vscode.TabInputTextDiff;
}

/** Tab.label bizim track ettiğimiz tabName ile eşleşiyor mu? */
function tabMatches(tab: vscode.Tab, tabName: string): boolean {
    if (!isDiffTab(tab)) {
        return false;
    }
    // Direkt label eşleşmesi (en yaygın senaryo).
    if (tab.label === tabName) {
        return true;
    }
    // Bazı VS Code sürümleri label'a "(Working Tree)" gibi sufiks ekleyebilir.
    if (tab.label.startsWith(tabName)) {
        return true;
    }
    return false;
}

export class DiffActionTracker implements vscode.Disposable {
    private readonly entries = new Map<string, TrackedEntry>();
    private readonly disposables: vscode.Disposable[] = [];
    private codeLensEmitter = new vscode.EventEmitter<void>();

    constructor(private readonly context: vscode.ExtensionContext) {
        this.disposables.push(
            vscode.window.tabGroups.onDidChangeTabs((e) => {
                // Yeni açılan veya odaklanan tab'larda toast tetikle.
                for (const tab of e.opened) {
                    this.maybeShowToastForTab(tab);
                }
                for (const tab of e.changed) {
                    if (tab.isActive) {
                        this.maybeShowToastForTab(tab);
                    }
                }
                // Kapatılan tab'lar için reject default davranışı SAĞLANMAZ; bu fallback
                // tools.ts'in kendi onDidCloseTab handler'ında çalışıyor. Burada sadece
                // entry'yi temizleyebilmek için izleriz.
                for (const tab of e.closed) {
                    for (const [name, entry] of this.entries) {
                        if (tabMatches(tab, entry.tabName)) {
                            // Kullanıcı kapattı — toast hâlâ açıksa kapansın (no-op; toast
                            // VS Code tarafında otomatik kapanır), sadece map'ten sil.
                            this.entries.delete(name);
                            this.codeLensEmitter.fire();
                            break;
                        }
                    }
                }
            })
        );

        // Komutlar: command palette ve keybinding üzerinden de erişilebilir.
        this.disposables.push(
            vscode.commands.registerCommand('altaris.diff.accept', () => {
                this.triggerActive('accept');
            })
        );
        this.disposables.push(
            vscode.commands.registerCommand('altaris.diff.reject', () => {
                this.triggerActive('reject');
            })
        );

        // CodeLens: diff'in HER İKİ tarafının üst satırına Accept/Reject lens'i koyar.
        // Karmaşıklığı düşük tutmak için sadece satır 0'a, evrensel pattern olarak.
        const lensProvider: vscode.CodeLensProvider = {
            onDidChangeCodeLenses: this.codeLensEmitter.event,
            provideCodeLenses: (document) => {
                if (!this.isDocumentInTrackedDiff(document)) {
                    return [];
                }
                const range = new vscode.Range(0, 0, 0, 0);
                return [
                    new vscode.CodeLens(range, {
                        title: '$(check) Accept',
                        command: 'altaris.diff.accept',
                        tooltip: 'Altaris: bu diff değişikliğini kabul et',
                    }),
                    new vscode.CodeLens(range, {
                        title: '$(x) Reject',
                        command: 'altaris.diff.reject',
                        tooltip: 'Altaris: bu diff değişikliğini reddet',
                    }),
                ];
            },
        };
        this.disposables.push(
            vscode.languages.registerCodeLensProvider({ scheme: 'file' }, lensProvider),
            vscode.languages.registerCodeLensProvider({ scheme: 'untitled' }, lensProvider)
        );

        this.context.subscriptions.push(this);
    }

    /** Public API: diff açıldığında çağrılır. */
    public track(tabName: string, callbacks: DiffCallbacks): void {
        this.entries.set(tabName, { tabName, callbacks, toastOpen: false });
        this.codeLensEmitter.fire();

        // Eğer çağrı anında tab zaten aktifse hemen toast göster.
        const active = vscode.window.tabGroups.activeTabGroup.activeTab;
        if (active && tabMatches(active, tabName)) {
            void this.showToast(tabName);
        }
    }

    /** Public API: callback artık çalışmamalı (caller başka yoldan resolve etti). */
    public untrack(tabName: string): void {
        this.entries.delete(tabName);
        this.codeLensEmitter.fire();
    }

    public dispose(): void {
        for (const d of this.disposables) {
            try {
                d.dispose();
            } catch {
                // best-effort
            }
        }
        this.disposables.length = 0;
        this.entries.clear();
        this.codeLensEmitter.dispose();
    }

    // ---- internals ----

    private maybeShowToastForTab(tab: vscode.Tab): void {
        if (!isDiffTab(tab)) {
            return;
        }
        const entry = this.findEntryForTab(tab);
        if (!entry) {
            return;
        }
        void this.showToast(entry.tabName);
    }

    private findEntryForTab(tab: vscode.Tab): TrackedEntry | undefined {
        for (const entry of this.entries.values()) {
            if (tabMatches(tab, entry.tabName)) {
                return entry;
            }
        }
        return undefined;
    }

    private async showToast(tabName: string): Promise<void> {
        const entry = this.entries.get(tabName);
        if (!entry || entry.toastOpen) {
            return;
        }
        entry.toastOpen = true;

        const ACCEPT = '$(check) Accept';
        const REJECT = '$(x) Reject';
        const EDIT = 'Düzenle';

        try {
            const items: string[] = [ACCEPT, REJECT];
            if (entry.callbacks.onEdit) {
                items.push(EDIT);
            }
            // Modal değil — sıradan bilgi mesajı; kullanıcı toast'u göz ardı edebilir
            // ve save/close fallback'i hâlâ çalışır.
            const choice = await vscode.window.showInformationMessage(
                `Altaris değişiklik önerdi: ${tabName}`,
                ...items
            );
            // Kullanıcı toast'u kapattıysa (choice === undefined) hiçbir şey yapma —
            // save/close fallback devreye girer.
            if (choice === ACCEPT) {
                this.fire(tabName, 'accept');
            } else if (choice === REJECT) {
                this.fire(tabName, 'reject');
            } else if (choice === EDIT && entry.callbacks.onEdit) {
                try {
                    entry.callbacks.onEdit();
                } catch {
                    // sessizce yut — UX akışını bozma
                }
            }
        } finally {
            const stillThere = this.entries.get(tabName);
            if (stillThere) {
                stillThere.toastOpen = false;
            }
        }
    }

    private triggerActive(kind: 'accept' | 'reject'): void {
        const active = vscode.window.tabGroups.activeTabGroup.activeTab;
        if (!active) {
            void vscode.window.showWarningMessage('Altaris: aktif diff tab\'ı bulunamadı.');
            return;
        }
        const entry = this.findEntryForTab(active);
        if (!entry) {
            void vscode.window.showWarningMessage('Altaris: aktif tab izlenen bir diff değil.');
            return;
        }
        this.fire(entry.tabName, kind);
    }

    private fire(tabName: string, kind: 'accept' | 'reject'): void {
        const entry = this.entries.get(tabName);
        if (!entry) {
            return;
        }
        // Map'ten sil ki callback iki kez tetiklenmesin (örn. toast + lens).
        this.entries.delete(tabName);
        this.codeLensEmitter.fire();
        try {
            if (kind === 'accept') {
                entry.callbacks.onAccept();
            } else {
                entry.callbacks.onReject();
            }
        } catch (err) {
            // Telemetri yok — sadece kullanıcıya bildir.
            void vscode.window.showErrorMessage(
                `Altaris diff aksiyon hatası: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }

    private isDocumentInTrackedDiff(document: vscode.TextDocument): boolean {
        if (this.entries.size === 0) {
            return false;
        }
        for (const group of vscode.window.tabGroups.all) {
            for (const tab of group.tabs) {
                if (!isDiffTab(tab)) {
                    continue;
                }
                const input = tab.input as vscode.TabInputTextDiff;
                const docUri = document.uri.toString();
                if (
                    input.original.toString() === docUri ||
                    input.modified.toString() === docUri
                ) {
                    if (this.findEntryForTab(tab)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}

/* INTEGRATION_NOTES:
 * - extension.ts:
 *     const diffTracker = new DiffActionTracker(context)
 *     // tools.ts openDiff'i bu tracker'a bağla:
 *     setDiffActionTracker(diffTracker)  // tools.ts'e static setter eklenmeli
 * - tools.ts openDiff: tab açtıktan sonra diffTracker.track(tab_name, {onAccept, onReject})
 *   onAccept = save event'ini sentetik olarak tetikle veya promise resolve et
 *   onReject = mevcut "tab kapatıldı" reject path'ini çağır
 *   ÖNEMLİ: tab_name'i deterministik yapmak için openDiff'te "Altaris: <basename>"
 *   gibi sabit prefix kullanılması önerilir; bu modül best-effort label match yapar
 *   ama prefix konursa eşleşme %100 olur (tabMatches helper'ı startsWith fallback'iyle
 *   bunu zaten destekliyor).
 * - package.json contributes.commands: altaris.diff.{accept,reject}
 *     örn:
 *     { "command": "altaris.diff.accept", "title": "Altaris: Accept Diff" }
 *     { "command": "altaris.diff.reject", "title": "Altaris: Reject Diff" }
 *   İsteğe bağlı keybinding: ctrl+enter / ctrl+backspace (when: textCompareEditorVisible)
 */
