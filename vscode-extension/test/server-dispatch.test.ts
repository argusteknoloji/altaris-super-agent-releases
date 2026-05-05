import { test, expect, describe, beforeEach } from "bun:test";
import { dispatchNotification, type NotificationHandlers } from "../src/server";

type Call = [string, ...unknown[]];

let calls: Call[] = [];
let handlers: NotificationHandlers = {};
const log = (_msg: string) => {};

beforeEach(() => {
  calls = [];
  handlers = {
    onModel: (m) => calls.push(["model", m]),
    onTokens: (i, o) => calls.push(["tokens", i, o]),
    onConnection: (s, n) => calls.push(["connection", s, n]),
    onTaskStart: (id, title, cancellable) => calls.push(["taskStart", id, title, cancellable]),
    onTaskUpdate: (id, progress, detail) => calls.push(["taskUpdate", id, progress, detail]),
    onTaskComplete: (id, title, detail, actions) =>
      calls.push(["taskComplete", id, title, detail, actions]),
    onTaskError: (id, title, detail) => calls.push(["taskError", id, title, detail]),
  };
});

describe("dispatchNotification", () => {
  test("notifications/altaris/model invokes onModel with model string", () => {
    dispatchNotification("notifications/altaris/model", { model: "claude-opus-4" }, handlers, log);
    expect(calls).toEqual([["model", "claude-opus-4"]]);
  });

  test("notifications/altaris/model defaults to '?' when missing", () => {
    dispatchNotification("notifications/altaris/model", {}, handlers, log);
    expect(calls).toEqual([["model", "?"]]);
  });

  test("notifications/altaris/tokens casts input/output to numbers", () => {
    dispatchNotification(
      "notifications/altaris/tokens",
      { input: "120", output: "45" },
      handlers,
      log,
    );
    expect(calls).toEqual([["tokens", 120, 45]]);
  });

  test("notifications/altaris/connection coerces 'connected' state", () => {
    dispatchNotification(
      "notifications/altaris/connection",
      { state: "connected", servers: 3 },
      handlers,
      log,
    );
    expect(calls).toEqual([["connection", "connected", 3]]);
  });

  test("notifications/altaris/connection falls back to 'disconnected' for any non-connected state", () => {
    dispatchNotification(
      "notifications/altaris/connection",
      { state: "weird", servers: 0 },
      handlers,
      log,
    );
    expect(calls).toEqual([["connection", "disconnected", 0]]);
  });

  test("notifications/altaris/task status=started routes to onTaskStart", () => {
    dispatchNotification(
      "notifications/altaris/task",
      { id: "t1", status: "started", title: "Indexing", cancellable: true },
      handlers,
      log,
    );
    expect(calls).toEqual([["taskStart", "t1", "Indexing", true]]);
  });

  test("notifications/altaris/task status=progress routes to onTaskUpdate", () => {
    dispatchNotification(
      "notifications/altaris/task",
      { id: "t1", status: "progress", progress: 42, detail: "halfway" },
      handlers,
      log,
    );
    expect(calls).toEqual([["taskUpdate", "t1", 42, "halfway"]]);
  });

  test("notifications/altaris/task status=complete routes to onTaskComplete", () => {
    const actions = [{ id: "open", label: "Open" }];
    dispatchNotification(
      "notifications/altaris/task",
      { id: "t1", status: "complete", title: "Done", detail: "ok", actions },
      handlers,
      log,
    );
    expect(calls).toEqual([["taskComplete", "t1", "Done", "ok", actions]]);
  });

  test("notifications/altaris/task status=error routes to onTaskError", () => {
    dispatchNotification(
      "notifications/altaris/task",
      { id: "t1", status: "error", title: "Boom", detail: "stack" },
      handlers,
      log,
    );
    expect(calls).toEqual([["taskError", "t1", "Boom", "stack"]]);
  });

  test("unknown method does not invoke any handler", () => {
    dispatchNotification("notifications/altaris/unknown", { foo: "bar" }, handlers, log);
    expect(calls).toEqual([]);
  });

  test("notifications/altaris/task with unknown status invokes no handler", () => {
    dispatchNotification(
      "notifications/altaris/task",
      { id: "t1", status: "??" },
      handlers,
      log,
    );
    expect(calls).toEqual([]);
  });
});
