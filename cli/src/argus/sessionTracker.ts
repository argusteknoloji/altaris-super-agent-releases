/**
 * Altaris session tracker — registers every interactive `altaris` REPL run as a
 * row in the platform's `sessions` table (so it shows up in admin dashboards
 * alongside web/PTY/remote-control sessions) and pushes user/assistant turns
 * into `session_messages`.
 *
 * Best-effort: every network call is fire-and-forget. If the API is down the
 * REPL keeps working — we just lose the audit trail for that run.
 */

import { readToken } from "./bootstrap.js";
import { getApiBase } from "./apiConfig.js";

let _sessionId: string | null = null;
let _token: string | null = null;
let _pendingInit: Promise<void> | null = null;

function detectProviderModel(): { provider: string; model: string } {
  const name = process.env.ALTARIS_ACTIVE_PROVIDER_NAME;
  const type = process.env.ALTARIS_ACTIVE_PROVIDER_TYPE;
  const model =
    process.env.ALTARIS_ACTIVE_PROVIDER_MODEL ||
    process.env.OPENAI_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    process.env.GEMINI_MODEL ||
    process.env.MISTRAL_MODEL ||
    "altaris";
  return { provider: type ?? name ?? "altaris-cli", model };
}

/**
 * Register a session row. Idempotent for the lifetime of the process — the
 * second call is a no-op once `_sessionId` is set.
 */
export async function initSessionTracker(opts?: { source?: string }): Promise<string | null> {
  if (_sessionId) return _sessionId;
  if (_pendingInit) {
    await _pendingInit;
    return _sessionId;
  }

  _pendingInit = (async () => {
    try {
      const token = await readToken();
      if (!token) return;
      _token = token;

      const { provider, model } = detectProviderModel();
      const res = await fetch(`${getApiBase()}/api/v1/agent/sessions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          model,
          title: `altaris ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
          source: opts?.source ?? "cli",
        }),
      });
      if (!res.ok) return;
      const reg = (await res.json()) as { id: string };
      _sessionId = reg.id;
      process.env.ALTARIS_SESSION_ID = reg.id;

      // Close the session on shutdown so admin dashboards see it transition
      // from "active" to "ended" (and EndedAt gets stamped).
      const shutdown = () => {
        // Fire and forget — process is exiting.
        void closeSessionTracker();
      };
      process.once("exit", shutdown);
      process.once("SIGINT", shutdown);
      process.once("SIGTERM", shutdown);
    } catch {
      /* network/auth failure: silently degrade */
    }
  })();

  await _pendingInit;
  return _sessionId;
}

// ─── Background queue ────────────────────────────────────────────────────────
//
// LLM operasyonları transcript persist'i beklemesin diye fire-and-forget
// queue. REPL'in onTurnComplete callback'i syncSessionMessages'ı çağırır;
// her mesaj kuyruğa eklenip hemen geri döner. Worker arka planda 200ms
// batch'lerle drain eder. Network down ise queue 1000 mesaja kadar tutar
// (yaklaşık ortalama bir saatlik konuşmaya yeter), sonra en eski düşürülür.
//
// Avantajları:
//   - REPL hiçbir noktada transcript I/O için beklemez (event loop free)
//   - Kısa burst'lerde art arda 5-10 POST yerine batch (paralel) gönder
//   - Kısa network hıçkırıkları queue'da soğur, retry yok ama kayıp az
//   - Process exit'te queue drain edilir (closeSessionTracker)

interface QueuedMessage { role: "user" | "assistant" | "system"; content: string; }

const _queue: QueuedMessage[] = [];
const QUEUE_MAX = 1000;
const DRAIN_INTERVAL_MS = 200;
const PARALLEL_POSTS = 4;
let _drainTimer: ReturnType<typeof setInterval> | null = null;
let _draining = false;

function ensureDrainLoop(): void {
  if (_drainTimer) return;
  _drainTimer = setInterval(() => { void drainQueue(); }, DRAIN_INTERVAL_MS);
  // Drain timer should not keep process alive — let exit hook flush instead.
  if (typeof _drainTimer.unref === "function") _drainTimer.unref();
}

async function postOne(msg: QueuedMessage): Promise<void> {
  if (!_sessionId || !_token) return;
  try {
    await fetch(`${getApiBase()}/api/v1/agent/sessions/${_sessionId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(msg),
    });
  } catch {
    /* best effort — drop on persistent network failure */
  }
}

async function drainQueue(): Promise<void> {
  if (_draining) return;
  if (_queue.length === 0) return;
  if (!_sessionId || !_token) return;
  _draining = true;
  try {
    while (_queue.length > 0) {
      const batch = _queue.splice(0, PARALLEL_POSTS);
      // Order within a batch is not guaranteed, but global order is preserved
      // because we drain in arrival order. session_messages.created_at is
      // server-assigned NOW() so ordering by timestamp may differ slightly
      // from CLI submission order — acceptable for transcript review.
      await Promise.all(batch.map(postOne));
    }
  } finally {
    _draining = false;
  }
}

/**
 * Enqueue a single message turn. Returns immediately — actual POST runs in
 * a 200ms-batched background worker. No-op when there is no registered
 * session (user not logged in, API down at startup).
 */
export function pushSessionMessage(
  role: "user" | "assistant" | "system",
  content: string,
): void {
  if (!_sessionId || !_token) return;
  if (!content || content.trim().length === 0) return;
  if (_queue.length >= QUEUE_MAX) {
    // Network'tedir muhtemelen — en eski mesajı düşür ki yeni gelen sığsın.
    _queue.shift();
  }
  _queue.push({ role, content });
  ensureDrainLoop();
}

// UUID-based dedup: every Message in REPL.tsx has a stable .uuid we use as the
// idempotency key for transcript persistence. syncSessionMessages can be called
// any number of times — only previously-unseen UUIDs hit the API.
const _seenUuids = new Set<string>();

interface SerializableMessage {
  uuid?: string;
  type?: "user" | "assistant" | "system";
  isMeta?: boolean;
  message?: {
    role?: string;
    content?: unknown;
  };
}

function blocksToTranscriptText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content as Array<Record<string, unknown>>) {
    if (!block || typeof block !== "object") continue;
    const type = block.type as string | undefined;
    if (type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    } else if (type === "tool_use") {
      const name = block.name as string | undefined;
      const input = block.input;
      try {
        parts.push(`[tool:${name ?? "unknown"}] ${JSON.stringify(input)}`);
      } catch {
        parts.push(`[tool:${name ?? "unknown"}]`);
      }
    } else if (type === "tool_result") {
      const inner = block.content;
      const innerText = typeof inner === "string" ? inner : blocksToTranscriptText(inner);
      if (innerText) parts.push(`[tool_result] ${innerText}`);
    } else if (type === "thinking" && typeof block.thinking === "string") {
      parts.push(`[thinking] ${block.thinking}`);
    } else if (type === "image") {
      parts.push("[image]");
    }
  }
  return parts.join("\n");
}

/**
 * Idempotent sync: walk the REPL's message buffer and push every new turn
 * (user input, assistant response, tool-bearing messages) to the platform
 * transcript. Safe to call after every onTurnComplete — already-persisted
 * UUIDs are filtered out.
 */
export function syncSessionMessages(messages: ReadonlyArray<SerializableMessage>): void {
  if (!_sessionId || !_token) return;
  for (const msg of messages) {
    const uuid = msg.uuid;
    if (!uuid || _seenUuids.has(uuid)) continue;
    if (msg.isMeta) continue;
    const role = msg.type;
    if (role !== "user" && role !== "assistant") continue;
    const text = blocksToTranscriptText(msg.message?.content);
    if (!text || text.trim().length === 0) {
      _seenUuids.add(uuid);
      continue;
    }
    _seenUuids.add(uuid);
    // Enqueue (sync) — worker drain'leyecek; LLM operasyonu beklemez.
    pushSessionMessage(role, text);
  }
}

export async function closeSessionTracker(): Promise<void> {
  if (!_sessionId || !_token) return;
  // Queue'da kalan mesajları process exit'ten önce drain et — kullanıcı
  // CLI'ı kapatırken son turn de transcript'e gitsin.
  try {
    if (_drainTimer) { clearInterval(_drainTimer); _drainTimer = null; }
    await drainQueue();
  } catch { /* best effort */ }
  try {
    await fetch(`${getApiBase()}/api/v1/agent/sessions/${_sessionId}/close`, {
      method: "POST",
      headers: { Authorization: `Bearer ${_token}` },
    });
  } catch {
    /* best effort */
  }
  _sessionId = null;
}

export function getActiveSessionId(): string | null {
  return _sessionId;
}
