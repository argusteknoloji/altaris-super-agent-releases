/**
 * Altaris Remote Control — CLI publisher.
 *
 * `altaris --remote-control` (or ALTARIS_REMOTE_CONTROL=1):
 *   1. POST /api/v1/agent/sessions          → register session in DB
 *   2. PATCH …/{id}/remote-control          → flip remote_control flag on
 *   3. WS /ws/remote-control/publish?…      → master channel
 *      • outbound: every process.stdout.write chunk forwarded as {type:"out",data}
 *      • inbound:  {type:"in",data} keystrokes injected back into stdin
 *
 * Web viewers attach via /ws/remote-control/attach (admin or session owner).
 *
 * Stop:  Ctrl-D / process exit → close WS + flag off + session end.
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const CREDS_PATH = join(homedir(), ".altaris", "credentials.json");
const API_BASE = process.env.ALTARIS_API_BASE ?? "http://localhost:5050";

let _sessionId: string | null = null;
let _ws: WebSocket | null = null;
let _origStdoutWrite: ((chunk: unknown, ...args: unknown[]) => boolean) | null = null;
let _origStderrWrite: ((chunk: unknown, ...args: unknown[]) => boolean) | null = null;

interface StoredCreds { access_token: string; expires_at: number; }

async function getToken(): Promise<string | null> {
  try {
    const raw = await readFile(CREDS_PATH, "utf8");
    const c = JSON.parse(raw) as StoredCreds;
    if (typeof c.access_token !== "string") return null;
    if (typeof c.expires_at === "number" && Date.now() > c.expires_at) return null;
    return c.access_token;
  } catch {
    return null;
  }
}

function bytesToText(chunk: unknown): string {
  if (typeof chunk === "string") return chunk;
  if (chunk && typeof (chunk as { toString: (enc?: string) => string }).toString === "function") {
    try { return (chunk as Buffer).toString("utf8"); } catch { /* ignore */ }
  }
  return String(chunk);
}

function patchStdio(): void {
  // stdout
  _origStdoutWrite = process.stdout.write.bind(process.stdout) as typeof _origStdoutWrite;
  (process.stdout.write as unknown) = ((chunk: unknown, ...args: unknown[]) => {
    try {
      if (_ws && _ws.readyState === 1 /* OPEN */) {
        _ws.send(JSON.stringify({ type: "out", data: bytesToText(chunk) }));
      }
    } catch { /* drop frame on overflow */ }
    return _origStdoutWrite!(chunk, ...args);
  });

  // stderr — same channel, viewer doesn't distinguish (Ink writes mostly to stdout)
  _origStderrWrite = process.stderr.write.bind(process.stderr) as typeof _origStderrWrite;
  (process.stderr.write as unknown) = ((chunk: unknown, ...args: unknown[]) => {
    try {
      if (_ws && _ws.readyState === 1) {
        _ws.send(JSON.stringify({ type: "out", data: bytesToText(chunk) }));
      }
    } catch { }
    return _origStderrWrite!(chunk, ...args);
  });
}

function unpatchStdio(): void {
  if (_origStdoutWrite) { (process.stdout.write as unknown) = _origStdoutWrite; _origStdoutWrite = null; }
  if (_origStderrWrite) { (process.stderr.write as unknown) = _origStderrWrite; _origStderrWrite = null; }
}

/**
 * Start the publisher. Resolves once the WS handshake succeeds.
 * Failure paths log and resolve silently — never throw at startup.
 */
export async function startRemoteControl(): Promise<void> {
  const token = await getToken();
  if (!token) {
    process.stderr.write("[altaris] remote-control: önce `altaris login` çalıştır\n");
    return;
  }

  // 1. register session
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/agent/sessions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "altaris-cli",
        model: process.env.OPENAI_MODEL ?? process.env.ANTHROPIC_MODEL ?? "altaris",
        title: `altaris ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
        source: "cli"
      })
    });
  } catch (e) {
    process.stderr.write(`[altaris] remote-control: API'ye bağlanılamadı (${(e as Error).message})\n`);
    return;
  }
  if (!res.ok) {
    process.stderr.write(`[altaris] remote-control: register fail HTTP ${res.status}\n`);
    return;
  }
  const reg = await res.json() as { id: string };
  _sessionId = reg.id;

  // 2. flip flag on
  await fetch(`${API_BASE}/api/v1/agent/sessions/${reg.id}/remote-control`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: true })
  }).catch(() => { /* best effort */ });

  // 3. open WS publisher
  const wsBase = API_BASE.replace(/^http/, "ws");
  const url = `${wsBase}/ws/remote-control/publish?session=${reg.id}&access_token=${encodeURIComponent(token)}`;
  try {
    _ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("WS handshake timeout")), 5000);
      _ws!.onopen  = () => { clearTimeout(t); resolve(); };
      _ws!.onerror = e => { clearTimeout(t); reject(new Error("WS error")); void e; };
    });
  } catch (e) {
    process.stderr.write(`[altaris] remote-control: WS açılamadı (${(e as Error).message})\n`);
    return;
  }

  // 4. inbound: viewer takeover input → multi-method stdin injection
  // Ink + raw-mode TTYs read from process.stdin via several abstractions
  // (data event with Buffer, data event with string, internal Readable.push).
  // Try them all; quietly noop on failures so the publisher stays alive.
  const debug = process.env.ALTARIS_RC_DEBUG === "1";
  _ws.onmessage = (ev: MessageEvent) => {
    try {
      const data = typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data as ArrayBuffer);
      const msg = JSON.parse(data);

      // PTY resize forwarding (broker → publisher). Update process.stdout
      // dimensions so Ink/curses TUIs re-layout, and emit "resize" so any
      // listener (e.g. xterm.js mirror in another viewer) can recompute.
      if (msg.type === "resize" && typeof msg.cols === "number" && typeof msg.rows === "number") {
        try {
          const so = process.stdout as NodeJS.WriteStream & { columns?: number; rows?: number };
          so.columns = msg.cols;
          so.rows    = msg.rows;
          process.stdout.emit("resize");
        } catch { /* not a TTY — ignore */ }
        return;
      }

      if (msg.type !== "in" || typeof msg.data !== "string") return;
      const text = msg.data;
      const buf = Buffer.from(text, "utf8");
      if (debug) {
        const codes = Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join(" ");
        process.stderr.write(`\x1b[2m[altaris-rc] in ${buf.length}B [${codes}]\x1b[0m\n`);
      }

      const stdin = process.stdin as NodeJS.ReadStream & {
        push?: (chunk: Buffer | string) => boolean;
      };

      // Try every known way to deliver a keypress to a TTY-backed stdin.
      try { stdin.emit("data", buf); }                          catch { /* ignore */ }
      try { stdin.emit("data", text); }                         catch { /* ignore */ }
      try { stdin.emit("readable"); }                           catch { /* ignore */ }
      try { if (typeof stdin.push === "function") stdin.push(buf); } catch { /* ignore */ }
      // Ink also listens for the synthesized "keypress" event on legacy paths.
      try {
        const ch = text.length === 1 ? text : "";
        stdin.emit("keypress", ch, { sequence: text, name: text, ctrl: false, meta: false, shift: false });
      } catch { /* ignore */ }
    } catch { /* ignore */ }
  };

  // 5. patch stdout/stderr → WS broadcast
  patchStdio();

  // 6. cleanup hooks
  const shutdown = () => { void stopRemoteControl(); };
  process.once("exit",   shutdown);
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  const webBase = process.env.ALTARIS_WEB_BASE ?? "http://localhost:3000";
  process.stderr.write(
    `\x1b[2m[altaris] Remote Control yayında · session=${reg.id.slice(0, 8)} · ` +
    `web → ${webBase}/remote-control\x1b[0m\n`
  );
}

/** True iff a publisher WebSocket is currently open + handshaked. */
export function isRemoteControlActive(): boolean {
  return _ws !== null && _ws.readyState === 1 /* OPEN */;
}

export async function stopRemoteControl(): Promise<void> {
  unpatchStdio();
  try { _ws?.close(); } catch { /* ignore */ }
  _ws = null;
  if (_sessionId) {
    const token = await getToken();
    if (token) {
      await fetch(`${API_BASE}/api/v1/agent/sessions/${_sessionId}/remote-control`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false })
      }).catch(() => { });
      await fetch(`${API_BASE}/api/v1/agent/sessions/${_sessionId}/close`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }
      }).catch(() => { });
    }
    _sessionId = null;
  }
}
