import * as vscode from 'vscode';

type Broadcast = (method: string, params?: unknown) => void;

const NOTIFICATION_METHOD = 'notifications/altaris/settings';

const WATCHED_KEYS = [
  'workbench.colorTheme',
  'editor.fontFamily',
  'editor.fontSize',
  'editor.tabSize',
  'editor.insertSpaces',
  'editor.rulers',
  'files.encoding',
  'terminal.integrated.fontFamily',
  'terminal.integrated.fontSize',
] as const;

interface SettingsSnapshot {
  'workbench.colorTheme': string | undefined;
  'editor.fontFamily': string | undefined;
  'editor.fontSize': number | undefined;
  'editor.tabSize': number | undefined;
  'editor.insertSpaces': boolean | undefined;
  'editor.rulers': number[] | undefined;
  'files.encoding': string | undefined;
  'terminal.integrated.fontFamily': string | undefined;
  'terminal.integrated.fontSize': number | undefined;
}

interface ThemeInfo {
  kind: 'Light' | 'Dark' | 'HighContrast' | 'HighContrastLight' | 'Unknown';
  name: string | undefined;
}

interface SettingsPayload {
  settings: SettingsSnapshot;
  theme: ThemeInfo;
  locale: string;
}

function readSnapshot(): SettingsSnapshot {
  const cfg = vscode.workspace.getConfiguration();
  return {
    'workbench.colorTheme': cfg.get<string>('workbench.colorTheme'),
    'editor.fontFamily': cfg.get<string>('editor.fontFamily'),
    'editor.fontSize': cfg.get<number>('editor.fontSize'),
    'editor.tabSize': cfg.get<number>('editor.tabSize'),
    'editor.insertSpaces': cfg.get<boolean>('editor.insertSpaces'),
    'editor.rulers': cfg.get<number[]>('editor.rulers'),
    'files.encoding': cfg.get<string>('files.encoding'),
    'terminal.integrated.fontFamily': cfg.get<string>('terminal.integrated.fontFamily'),
    'terminal.integrated.fontSize': cfg.get<number>('terminal.integrated.fontSize'),
  };
}

function readThemeInfo(): ThemeInfo {
  const active = vscode.window.activeColorTheme;
  let kind: ThemeInfo['kind'] = 'Unknown';
  switch (active.kind) {
    case vscode.ColorThemeKind.Light:
      kind = 'Light';
      break;
    case vscode.ColorThemeKind.Dark:
      kind = 'Dark';
      break;
    case vscode.ColorThemeKind.HighContrast:
      kind = 'HighContrast';
      break;
    default:
      // HighContrastLight (kind === 4) introduced later; guard via numeric compare.
      if ((active.kind as number) === 4) {
        kind = 'HighContrastLight';
      }
      break;
  }
  const cfg = vscode.workspace.getConfiguration();
  return {
    kind,
    name: cfg.get<string>('workbench.colorTheme'),
  };
}

function buildPayload(): SettingsPayload {
  return {
    settings: readSnapshot(),
    theme: readThemeInfo(),
    locale: vscode.env.language,
  };
}

export function registerSettingsSync(
  context: vscode.ExtensionContext,
  broadcast: Broadcast,
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  const push = (): void => {
    try {
      broadcast(NOTIFICATION_METHOD, buildPayload());
    } catch {
      // Broadcast failures must not break the extension host.
    }
  };

  // Initial push — fire once on activation so the CLI gets a baseline snapshot.
  push();

  // Debounce config-change pushes (300ms) to coalesce rapid edits.
  let debounceTimer: NodeJS.Timeout | undefined;
  const schedulePush = (): void => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      push();
    }, 300);
  };

  const cfgSub = vscode.workspace.onDidChangeConfiguration((evt) => {
    for (const key of WATCHED_KEYS) {
      if (evt.affectsConfiguration(key)) {
        schedulePush();
        return;
      }
    }
  });
  disposables.push(cfgSub);

  const themeSub = vscode.window.onDidChangeActiveColorTheme(() => {
    // Theme switches are user-initiated and discrete; push immediately.
    push();
  });
  disposables.push(themeSub);

  // Make sure the debounce timer is cleared on deactivation.
  disposables.push(
    new vscode.Disposable(() => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
      }
    }),
  );

  // Tie disposables to extension lifetime as well, so callers may either
  // forward into context.subscriptions or rely on their own teardown.
  void context;

  return disposables;
}

/* INTEGRATION_NOTES:
 * - extension.ts: registerSettingsSync(context, (m, p) => server?.broadcast(m, p))
 *     .forEach(d => context.subscriptions.push(d))
 * - CLI tarafı (cli/src/argus/...) bu notification'ı dinleyip TUI tema/font'una
 *   uygulayabilir — bu agent'ın işi değil, CLI tarafı ayrı PR.
 */
