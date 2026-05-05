import * as vscode from "vscode";

/**
 * Altaris status bar feature.
 *
 * Renders three right-aligned status bar items reflecting live state pushed
 * from the CLI bridge over MCP notifications:
 *   - model      (priority 100)
 *   - tokens     (priority 99)
 *   - connection (priority 98, owns the click → quick pick menu)
 *
 * Public API is returned from {@link registerStatusBar} so the rest of the
 * extension can drive it without holding a class reference.
 */

export const STATUS_BAR_MENU_COMMAND = "altaris.statusBar.menu";
export const ALTARIS_OUTPUT_COMMAND = "altaris.showOutput";
export const ALTARIS_RESTART_BRIDGE_COMMAND = "altaris.restartBridge";
export const ALTARIS_SWITCH_MODEL_COMMAND = "altaris.switchModel";

export type ConnectionState = "connected" | "disconnected";

export interface ConnectionInfo {
    state: ConnectionState;
    servers: number;
}

export interface TokenUsage {
    input: number;
    output: number;
}

export interface StatusBarHandle {
    setModel(model: string | undefined): void;
    setTokens(tokens: TokenUsage | undefined): void;
    setConnection(info: ConnectionInfo | undefined): void;
    dispose(): void;
}

interface InternalState {
    model: string | undefined;
    tokens: TokenUsage | undefined;
    connection: ConnectionInfo | undefined;
}

const MODEL_PRIORITY = 100;
const TOKENS_PRIORITY = 99;
const CONNECTION_PRIORITY = 98;

/**
 * Format a token count using a compact, human-friendly suffix.
 *   973   -> "973"
 *   1234  -> "1.2k"
 *   12_345 -> "12.3k"
 *   1_500_000 -> "1.5M"
 */
function formatTokenCount(value: number): string {
    if (!Number.isFinite(value) || value < 0) {
        return "0";
    }
    if (value < 1_000) {
        return String(Math.round(value));
    }
    if (value < 1_000_000) {
        const v = value / 1_000;
        return `${v.toFixed(v >= 100 ? 0 : 1)}k`;
    }
    const v = value / 1_000_000;
    return `${v.toFixed(v >= 100 ? 0 : 1)}M`;
}

function readConfiguredModels(): string[] {
    const cfg = vscode.workspace.getConfiguration("altaris");
    const raw = cfg.get<unknown>("cli.models", []);
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw.filter((m): m is string => typeof m === "string" && m.trim().length > 0);
}

export function registerStatusBar(context: vscode.ExtensionContext): StatusBarHandle {
    const state: InternalState = {
        model: undefined,
        tokens: undefined,
        connection: undefined,
    };

    const modelItem = vscode.window.createStatusBarItem(
        "altaris.status.model",
        vscode.StatusBarAlignment.Right,
        MODEL_PRIORITY,
    );
    modelItem.name = "Altaris Model";
    modelItem.command = STATUS_BAR_MENU_COMMAND;

    const tokensItem = vscode.window.createStatusBarItem(
        "altaris.status.tokens",
        vscode.StatusBarAlignment.Right,
        TOKENS_PRIORITY,
    );
    tokensItem.name = "Altaris Token Usage";
    tokensItem.command = STATUS_BAR_MENU_COMMAND;

    const connectionItem = vscode.window.createStatusBarItem(
        "altaris.status.connection",
        vscode.StatusBarAlignment.Right,
        CONNECTION_PRIORITY,
    );
    connectionItem.name = "Altaris Connection";
    connectionItem.command = STATUS_BAR_MENU_COMMAND;

    const renderModel = (): void => {
        const label = state.model && state.model.trim().length > 0 ? state.model : "?";
        modelItem.text = `$(sparkle) Altaris: ${label}`;
        modelItem.tooltip = state.model
            ? `Active Altaris model: ${state.model}\nClick for status menu.`
            : "Altaris model is not yet active. Click to open the status menu.";
        modelItem.show();
    };

    const renderTokens = (): void => {
        if (!state.tokens) {
            tokensItem.text = "$(symbol-numeric) 0/0";
            tokensItem.tooltip = "No tokens used yet in this session.";
            tokensItem.show();
            return;
        }
        const inText = formatTokenCount(state.tokens.input);
        const outText = formatTokenCount(state.tokens.output);
        const total = formatTokenCount(state.tokens.input + state.tokens.output);
        tokensItem.text = `$(symbol-numeric) ${inText}/${outText}`;
        tokensItem.tooltip =
            `Altaris session tokens\n` +
            `Input:  ${state.tokens.input.toLocaleString()}\n` +
            `Output: ${state.tokens.output.toLocaleString()}\n` +
            `Total:  ${total}`;
        tokensItem.show();
    };

    const renderConnection = (): void => {
        const info = state.connection;
        if (!info || info.state === "disconnected") {
            connectionItem.text = "$(error) Altaris ✗";
            connectionItem.tooltip = "Altaris bridge disconnected. Click for options.";
            connectionItem.backgroundColor = new vscode.ThemeColor(
                "statusBarItem.warningBackground",
            );
        } else {
            const count = Math.max(0, info.servers | 0);
            connectionItem.text = `$(check) Altaris ✓ ${count}`;
            connectionItem.tooltip =
                `Altaris bridge connected\nMCP servers: ${count}\nClick for status menu.`;
            connectionItem.backgroundColor = undefined;
        }
        connectionItem.show();
    };

    renderModel();
    renderTokens();
    renderConnection();

    const menuCommand = vscode.commands.registerCommand(STATUS_BAR_MENU_COMMAND, async () => {
        type MenuItem = vscode.QuickPickItem & { action: "status" | "output" | "restart" | "switch" };
        const items: MenuItem[] = [
            {
                label: "$(info) Show status",
                description: state.model ?? "no model",
                detail: state.connection
                    ? `${state.connection.state} · ${state.connection.servers} MCP server(s)`
                    : "connection state unknown",
                action: "status",
            },
            {
                label: "$(output) Open output panel",
                action: "output",
            },
            {
                label: "$(refresh) Restart Altaris bridge",
                action: "restart",
            },
            {
                label: "$(arrow-swap) Switch model",
                description: state.model ?? undefined,
                action: "switch",
            },
        ];

        const pick = await vscode.window.showQuickPick(items, {
            title: "Altaris",
            placeHolder: "Altaris status menu",
            matchOnDescription: true,
            matchOnDetail: true,
        });
        if (!pick) {
            return;
        }

        switch (pick.action) {
            case "status": {
                const lines: string[] = [
                    `Model: ${state.model ?? "?"}`,
                    state.tokens
                        ? `Tokens: in ${state.tokens.input.toLocaleString()} / out ${state.tokens.output.toLocaleString()}`
                        : "Tokens: none",
                    state.connection
                        ? `Connection: ${state.connection.state} (${state.connection.servers} MCP)`
                        : "Connection: unknown",
                ];
                await vscode.window.showInformationMessage(`Altaris status\n${lines.join("\n")}`, {
                    modal: false,
                });
                break;
            }
            case "output": {
                const all = await vscode.commands.getCommands(true);
                if (all.includes(ALTARIS_OUTPUT_COMMAND)) {
                    await vscode.commands.executeCommand(ALTARIS_OUTPUT_COMMAND);
                } else {
                    await vscode.window.showWarningMessage(
                        "Altaris output command is not registered yet.",
                    );
                }
                break;
            }
            case "restart": {
                const all = await vscode.commands.getCommands(true);
                if (all.includes(ALTARIS_RESTART_BRIDGE_COMMAND)) {
                    await vscode.commands.executeCommand(ALTARIS_RESTART_BRIDGE_COMMAND);
                } else {
                    await vscode.window.showWarningMessage(
                        "Altaris bridge restart command is not registered yet.",
                    );
                }
                break;
            }
            case "switch": {
                const models = readConfiguredModels();
                if (models.length === 0) {
                    await vscode.window.showInformationMessage(
                        "No models configured. Set 'altaris.cli.models' in your settings.",
                    );
                    return;
                }
                const choice = await vscode.window.showQuickPick(models, {
                    title: "Switch Altaris model",
                    placeHolder: state.model ?? "Pick a model",
                });
                if (!choice) {
                    return;
                }
                const all = await vscode.commands.getCommands(true);
                if (all.includes(ALTARIS_SWITCH_MODEL_COMMAND)) {
                    await vscode.commands.executeCommand(ALTARIS_SWITCH_MODEL_COMMAND, choice);
                } else {
                    // Fallback: optimistic local update so the UI reflects the user's choice.
                    state.model = choice;
                    renderModel();
                    await vscode.window.showWarningMessage(
                        `Altaris switch-model command is not registered yet. Showing '${choice}' locally.`,
                    );
                }
                break;
            }
            default: {
                const _exhaustive: never = pick.action;
                void _exhaustive;
            }
        }
    });

    const handle: StatusBarHandle = {
        setModel(model: string | undefined): void {
            state.model = model && model.trim().length > 0 ? model : undefined;
            renderModel();
        },
        setTokens(tokens: TokenUsage | undefined): void {
            if (!tokens) {
                state.tokens = undefined;
            } else {
                const input = Number.isFinite(tokens.input) ? Math.max(0, Math.trunc(tokens.input)) : 0;
                const output = Number.isFinite(tokens.output)
                    ? Math.max(0, Math.trunc(tokens.output))
                    : 0;
                state.tokens = { input, output };
            }
            renderTokens();
        },
        setConnection(info: ConnectionInfo | undefined): void {
            if (!info) {
                state.connection = undefined;
            } else {
                state.connection = {
                    state: info.state === "connected" ? "connected" : "disconnected",
                    servers: Number.isFinite(info.servers) ? Math.max(0, Math.trunc(info.servers)) : 0,
                };
            }
            renderConnection();
        },
        dispose(): void {
            modelItem.dispose();
            tokensItem.dispose();
            connectionItem.dispose();
            menuCommand.dispose();
        },
    };

    context.subscriptions.push(modelItem, tokensItem, connectionItem, menuCommand);

    return handle;
}

/* INTEGRATION_NOTES:
 * - extension.ts activate(): import { registerStatusBar } from "./features/status-bar"
 *   const statusBar = registerStatusBar(context); + context.subscriptions.push(statusBar)
 * - server.ts on message: notification "notifications/altaris/{model,tokens,connection}"
 *   geldiğinde statusBar.setModel/setTokens/setConnection çağrılmalı
 *   (server.ts'e statusBar referansı geçirmek için startMcpServer signature'ına ek arg)
 * - package.json contributes.commands ekle:
 *   { "command": "altaris.statusBar.menu", "title": "Altaris: Status menü" }
 * - package.json contributes.configuration ekle:
 *   "altaris.cli.models" string[] default []
 */
