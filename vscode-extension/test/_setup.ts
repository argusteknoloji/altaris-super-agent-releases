/**
 * Minimal vscode module mock for Bun's test runner.
 *
 * Several src/ modules import `vscode` at the top level; in unit tests we don't
 * actually exercise that surface — we just need the import to resolve. Bun's
 * `mock.module` lets us register a virtual "vscode" module for the duration of
 * the test suite.
 */
import { mock } from "bun:test";

mock.module("vscode", () => ({
  workspace: {
    workspaceFolders: undefined,
    getConfiguration: () => ({ get: () => undefined }),
  },
  window: {
    withProgress: async (_opts: unknown, fn: (progress: unknown, token: unknown) => unknown) =>
      fn({ report: () => {} }, { onCancellationRequested: () => {} }),
  },
  env: { appName: "VS Code" },
  ProgressLocation: { Notification: 15 },
}));
