/**
 * Altaris Activity Bar sidebar — Cursor / Claude tarzı.
 *
 * Sol activity bar'da turuncu A ikonuna tıklayınca açılan TreeView. Welcome
 * view metni yerine kategorilenmiş aksiyonlar + durum gösterir:
 *
 *   ▾ Durum
 *       Model · claude-opus-4-7
 *       Bağlantı · ✓ port 12345
 *       Köprü · aktif
 *   ▾ Hızlı eylemler
 *       Yeni terminal aç
 *       Inline edit (Cmd+I)
 *       Workspace dosyası ekle (@)
 *       Output panelini aç
 *   ▾ Bakım
 *       Köprüyü yeniden başlat
 *       Bağlantı durumu
 *       Model değiştir
 */

import * as vscode from "vscode";

interface Status {
  model: string;
  connection: "connected" | "disconnected";
  port?: number;
}

class AltarisItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly contextValue: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    iconName?: string,
    command?: vscode.Command,
    description?: string,
  ) {
    super(label, collapsibleState);
    this.contextValue = contextValue;
    if (iconName) this.iconPath = new vscode.ThemeIcon(iconName);
    if (command) this.command = command;
    if (description) this.description = description;
  }
}

export class AltarisSidebarProvider implements vscode.TreeDataProvider<AltarisItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AltarisItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private status: Status = { model: "—", connection: "disconnected" };

  setStatus(s: Partial<Status>): void {
    this.status = { ...this.status, ...s };
    this._onDidChangeTreeData.fire();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(el: AltarisItem): vscode.TreeItem {
    return el;
  }

  getChildren(el?: AltarisItem): AltarisItem[] {
    if (!el) {
      // Root: 3 ana bölüm
      return [
        new AltarisItem("Durum", "section", vscode.TreeItemCollapsibleState.Expanded, "pulse"),
        new AltarisItem("Hızlı eylemler", "section", vscode.TreeItemCollapsibleState.Expanded, "rocket"),
        new AltarisItem("Bakım", "section", vscode.TreeItemCollapsibleState.Collapsed, "tools"),
      ];
    }

    if (el.label === "Durum") {
      const connColor =
        this.status.connection === "connected" ? "testing-passed-icon" : "error";
      return [
        new AltarisItem(
          "Model",
          "status-model",
          vscode.TreeItemCollapsibleState.None,
          "symbol-color",
          undefined,
          this.status.model,
        ),
        new AltarisItem(
          "Bağlantı",
          "status-connection",
          vscode.TreeItemCollapsibleState.None,
          connColor,
          undefined,
          this.status.connection === "connected"
            ? `✓ port ${this.status.port ?? "—"}`
            : "✗ kapalı",
        ),
      ];
    }

    if (el.label === "Hızlı eylemler") {
      return [
        new AltarisItem(
          "Yeni Altaris terminal",
          "action",
          vscode.TreeItemCollapsibleState.None,
          "terminal",
          { command: "altaris.openTerminal", title: "Yeni terminal" },
        ),
        new AltarisItem(
          "Inline edit",
          "action",
          vscode.TreeItemCollapsibleState.None,
          "edit",
          { command: "altaris.inlineEdit", title: "Inline edit" },
          "Cmd+I",
        ),
        new AltarisItem(
          "Workspace dosyası ekle",
          "action",
          vscode.TreeItemCollapsibleState.None,
          "file-symlink-file",
          { command: "altaris.insertWorkspaceFile", title: "File picker" },
          "Cmd+Shift+2",
        ),
        new AltarisItem(
          "Output paneli",
          "action",
          vscode.TreeItemCollapsibleState.None,
          "output",
          { command: "altaris.showOutput", title: "Output" },
        ),
      ];
    }

    if (el.label === "Bakım") {
      return [
        new AltarisItem(
          "Köprüyü yeniden başlat",
          "action",
          vscode.TreeItemCollapsibleState.None,
          "refresh",
          { command: "altaris.restart", title: "Restart bridge" },
        ),
        new AltarisItem(
          "Bağlantı durumu",
          "action",
          vscode.TreeItemCollapsibleState.None,
          "info",
          { command: "altaris.showStatus", title: "Status" },
        ),
        new AltarisItem(
          "Model değiştir",
          "action",
          vscode.TreeItemCollapsibleState.None,
          "list-selection",
          { command: "altaris.statusBar.menu", title: "Switch model" },
        ),
      ];
    }

    return [];
  }
}

export function registerSidebar(context: vscode.ExtensionContext): {
  provider: AltarisSidebarProvider;
  dispose: () => void;
} {
  const provider = new AltarisSidebarProvider();
  const view = vscode.window.createTreeView("altaris.welcome", {
    treeDataProvider: provider,
    showCollapseAll: false,
  });
  context.subscriptions.push(view);
  return {
    provider,
    dispose: () => view.dispose(),
  };
}
