import * as vscode from 'vscode';

export interface TaskAction {
  id: string;
  label: string;
}

interface TaskState {
  progress: vscode.Progress<{ message?: string; increment?: number }>;
  resolve: () => void;
  token: vscode.CancellationToken;
  lastProgress: number;
  title: string;
}

export type TaskActionHandler = (taskId: string, actionId: string) => void;

export class NotificationManager {
  private readonly tasks = new Map<string, TaskState>();
  private actionHandler: TaskActionHandler | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Register a callback that is invoked when the user clicks an action button
   * on a completion notification. The wiring layer (server.ts) is expected to
   * forward the result to the CLI as a `notifications/altaris/taskAction`
   * JSON-RPC notification.
   */
  public onAction(handler: TaskActionHandler): void {
    this.actionHandler = handler;
  }

  /**
   * Begin tracking a long-running task. Opens a VS Code progress notification
   * anchored in the OS notification area. If `cancellable` is true, the user
   * can cancel via the progress UI; the underlying CancellationToken is stored
   * so callers may observe cancellation.
   */
  public start(id: string, title: string, cancellable: boolean = false): void {
    if (this.tasks.has(id)) {
      // Already tracking — treat as a title refresh by ignoring the duplicate.
      return;
    }

    void vscode.window.withProgress<void>(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable,
      },
      (progress, token) =>
        new Promise<void>((resolve) => {
          const state: TaskState = {
            progress,
            resolve,
            token,
            lastProgress: 0,
            title,
          };
          this.tasks.set(id, state);

          // Best-effort: surface cancellation by resolving the progress.
          // Consumers (server.ts) can poll token.isCancellationRequested.
          token.onCancellationRequested(() => {
            // Leave entry in map so a late `complete`/`error` is a no-op;
            // remove eagerly here to avoid leaking state.
            this.tasks.delete(id);
            resolve();
          });
        }),
    );
  }

  /**
   * Update the progress percentage (0-100) and optional detail line for an
   * in-flight task. Silently no-ops if the task is unknown.
   */
  public update(id: string, progress: number, detail?: string): void {
    const state = this.tasks.get(id);
    if (!state) {
      return;
    }
    const clamped = Math.max(0, Math.min(100, progress));
    const increment = clamped - state.lastProgress;
    state.lastProgress = clamped;
    state.progress.report({
      message: detail,
      increment: increment > 0 ? increment : undefined,
    });
  }

  /**
   * Close the progress notification for `id` and present a follow-up
   * informational toast with the supplied actions. The chosen action (if any)
   * is forwarded to the registered action handler.
   */
  public async complete(
    id: string,
    title: string,
    detail?: string,
    actions: TaskAction[] = [],
  ): Promise<void> {
    const state = this.tasks.get(id);
    if (state) {
      state.resolve();
      this.tasks.delete(id);
    }

    const message = detail ? `${title} — ${detail}` : title;
    const labels = actions.map((a) => a.label);
    const picked = await vscode.window.showInformationMessage(message, ...labels);
    if (picked === undefined) {
      return;
    }
    const matched = actions.find((a) => a.label === picked);
    if (matched && this.actionHandler) {
      this.actionHandler(id, matched.id);
    }
  }

  /**
   * Close the progress notification for `id` and present an error toast.
   */
  public async error(id: string, title: string, detail?: string): Promise<void> {
    const state = this.tasks.get(id);
    if (state) {
      state.resolve();
      this.tasks.delete(id);
    }
    const message = detail ? `${title} — ${detail}` : title;
    await vscode.window.showErrorMessage(message);
  }

  /**
   * Returns whether the task with `id` has been cancelled by the user via the
   * VS Code progress UI. Useful for server.ts to short-circuit further updates.
   */
  public isCancelled(id: string): boolean {
    const state = this.tasks.get(id);
    return state ? state.token.isCancellationRequested : false;
  }

  /**
   * Disposes any in-flight progress notifications. Called implicitly when the
   * extension deactivates because state is anchored in `context.subscriptions`.
   */
  public dispose(): void {
    for (const [, state] of this.tasks) {
      state.resolve();
    }
    this.tasks.clear();
  }
}

/**
 * Factory that wires a `NotificationManager` instance into the extension
 * lifecycle so it is disposed on deactivate.
 */
export function registerNotifications(
  context: vscode.ExtensionContext,
): NotificationManager {
  const manager = new NotificationManager(context);
  context.subscriptions.push({ dispose: () => manager.dispose() });
  return manager;
}

/* INTEGRATION_NOTES:
 * - extension.ts activate(): const notifs = registerNotifications(context)
 * - server.ts'de "notifications/altaris/task" geldiginde notifs.start/update/complete/error cagir
 * - server.ts'e notifs referansini startMcpServer signature'ina ekle
 * - taskAction notification'ini CLI'a geri gondermek icin server WebSocket'inden
 *   ws.send(JSON.stringify({jsonrpc:"2.0", method:"notifications/altaris/taskAction", params:{id, actionId}}))
 */
