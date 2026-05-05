import * as vscode from "vscode";

type McpContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

export interface ToolResult {
  content: McpContent[];
  isError?: boolean;
}

const TEXT_MIMES = new Set<string>([
  "text/plain",
  "text/markdown",
  "text/html",
  "application/vnd.code.notebook.stdout",
  "application/vnd.code.notebook.stderr",
]);

const IMAGE_MIMES = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const ERROR_MIMES = new Set<string>([
  "application/vnd.code.notebook.error",
  "application/x.notebook.error-traceback",
]);

function decodeText(data: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(data);
  } catch {
    return Buffer.from(data).toString("utf8");
  }
}

function toBase64(data: Uint8Array): string {
  return Buffer.from(data).toString("base64");
}

function mapOutputItem(item: vscode.NotebookCellOutputItem): {
  content: McpContent | null;
  isError: boolean;
} {
  const mime = item.mime;
  if (ERROR_MIMES.has(mime)) {
    let text = decodeText(item.data);
    try {
      const parsed = JSON.parse(text) as {
        name?: string;
        message?: string;
        stack?: string;
      };
      const parts = [parsed.name, parsed.message, parsed.stack].filter(Boolean);
      if (parts.length > 0) text = parts.join("\n");
    } catch {
      // keep raw decoded text
    }
    return { content: { type: "text", text }, isError: true };
  }

  if (IMAGE_MIMES.has(mime)) {
    return {
      content: { type: "image", data: toBase64(item.data), mimeType: mime },
      isError: false,
    };
  }

  if (TEXT_MIMES.has(mime) || mime.startsWith("text/")) {
    return { content: { type: "text", text: decodeText(item.data) }, isError: false };
  }

  if (mime === "application/json" || mime.endsWith("+json")) {
    return { content: { type: "text", text: decodeText(item.data) }, isError: false };
  }

  // Unknown MIME — skip silently
  return { content: null, isError: false };
}

function collectOutputs(outputs: readonly vscode.NotebookCellOutput[]): {
  content: McpContent[];
  isError: boolean;
} {
  const content: McpContent[] = [];
  let isError = false;
  for (const out of outputs) {
    // Prefer richer items first: error > image > text
    const items = [...out.items].sort((a, b) => {
      const score = (m: string) =>
        ERROR_MIMES.has(m) ? 0 : IMAGE_MIMES.has(m) ? 1 : 2;
      return score(a.mime) - score(b.mime);
    });
    for (const item of items) {
      const mapped = mapOutputItem(item);
      if (mapped.isError) isError = true;
      if (mapped.content) content.push(mapped.content);
    }
  }
  return { content, isError };
}

async function findActiveJupyterNotebook(): Promise<vscode.NotebookEditor | undefined> {
  const active = vscode.window.activeNotebookEditor;
  if (active && isJupyterNotebook(active.notebook)) return active;

  for (const editor of vscode.window.visibleNotebookEditors) {
    if (isJupyterNotebook(editor.notebook)) return editor;
  }

  for (const nb of vscode.workspace.notebookDocuments) {
    if (isJupyterNotebook(nb)) {
      try {
        const editor = await vscode.window.showNotebookDocument(nb, {
          preserveFocus: true,
        });
        return editor;
      } catch {
        // ignore
      }
    }
  }
  return undefined;
}

function isJupyterNotebook(nb: vscode.NotebookDocument): boolean {
  return nb.notebookType === "jupyter-notebook" || nb.notebookType === "interactive";
}

async function executeInNotebook(
  editor: vscode.NotebookEditor,
  code: string,
): Promise<ToolResult> {
  const nb = editor.notebook;
  const insertIndex = nb.cellCount;

  const edit = new vscode.WorkspaceEdit();
  const newCell = new vscode.NotebookCellData(
    vscode.NotebookCellKind.Code,
    code,
    detectLanguage(nb),
  );
  edit.set(nb.uri, [
    vscode.NotebookEdit.insertCells(insertIndex, [newCell]),
  ]);
  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    return {
      content: [{ type: "text", text: "Hücre eklenemedi." }],
      isError: true,
    };
  }

  // Execute the freshly-inserted cell
  await vscode.commands.executeCommand("notebook.cell.execute", {
    ranges: [{ start: insertIndex, end: insertIndex + 1 }],
    document: nb.uri,
  });

  const cell = nb.cellAt(insertIndex);
  await waitForExecutionComplete(cell);

  const { content, isError } = collectOutputs(cell.outputs);
  if (content.length === 0) {
    content.push({ type: "text", text: "(no output)" });
  }
  return { content, isError };
}

function detectLanguage(nb: vscode.NotebookDocument): string {
  for (const cell of nb.getCells()) {
    if (cell.kind === vscode.NotebookCellKind.Code) {
      return cell.document.languageId || "python";
    }
  }
  return "python";
}

async function waitForExecutionComplete(
  cell: vscode.NotebookCell,
  timeoutMs = 120_000,
): Promise<void> {
  const start = Date.now();
  // Poll executionSummary until success/failure resolves.
  while (Date.now() - start < timeoutMs) {
    const summary = cell.executionSummary;
    if (summary && summary.success !== undefined && summary.timing?.endTime) {
      return;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

async function executeViaInteractiveWindow(code: string): Promise<ToolResult> {
  try {
    await vscode.commands.executeCommand(
      "jupyter.execSelectionInteractive",
      code,
    );
    return {
      content: [
        {
          type: "text",
          text:
            "Kod aktif Interactive Window'a gönderildi. Çıktılar Interactive Window panelinde görünür (programatik output capture sadece notebook modunda desteklenir).",
        },
      ],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text",
          text: `Interactive Window çalıştırması başarısız: ${msg}`,
        },
      ],
      isError: true,
    };
  }
}

export async function executeCodeImpl(args: { code: string }): Promise<ToolResult> {
  const code = args?.code ?? "";
  if (!code.trim()) {
    return {
      content: [{ type: "text", text: "Boş kod gönderildi." }],
      isError: true,
    };
  }

  try {
    const editor = await findActiveJupyterNotebook();
    if (editor) {
      return await executeInNotebook(editor, code);
    }
    return await executeViaInteractiveWindow(code);
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
    return {
      content: [{ type: "text", text: `executeCode hata: ${msg}` }],
      isError: true,
    };
  }
}

/* INTEGRATION_NOTES:
 * - tools.ts'de mevcut `executeCode` fonksiyonunu sil veya bu modülden import et
 * - package.json'a şu activationEvent ekle: "onNotebook:jupyter-notebook"
 */
