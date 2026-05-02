/**
 * Altaris CLI bootstrap.
 *
 * If the user is logged in (`altaris login` token in `~/.altaris/credentials.json`),
 * fetch their tenant's active provider config from the Argus API and inject
 * the matching provider env vars *before* commander parses argv. This means
 *   altaris
 * with no exports already routes to whatever the operator picked in the
 * web admin panel (`/admin/providers` → ★ default).
 *
 * Manual env vars always win — we only fill blanks.
 * Network or auth failure is silent: the user just falls back to the existing
 * env-var/configuration model and gets the same friendly error if they hit
 * a request without credentials.
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const CREDS_PATH = join(homedir(), ".altaris", "credentials.json");
import { getApiBase, getLastProviderId } from "./apiConfig.js";
// Cap the network call so a slow/down API never blocks startup for long.
const FETCH_TIMEOUT_MS = 1500;

interface StoredCreds {
  access_token: string;
  expires_at: number;
}

export interface ActiveProvider {
  id: string;
  provider: string;            // anthropic | openai | lmstudio | ollama | codex
  name: string;
  baseUrl: string | null;
  apiKey: string | null;
  model: string | null;
  isDefault: boolean;
  authKind?: string;           // "static" | "oauth"
  accountId?: string | null;   // ChatGPT account id (Codex OAuth flow)
  expiresAt?: string | null;
}

export interface ProviderListItem {
  id: string;
  provider: string;
  name: string;
  defaultModel: string | null;
  isDefault: boolean;
}

export async function readToken(): Promise<string | null> {
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

async function fetchJson<T>(path: string, token: string): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(`${getApiBase()}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: ctrl.signal
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchActiveProvider(token: string, opts?: { id?: string; provider?: string }): Promise<ActiveProvider | null> {
  const qs = new URLSearchParams();
  if (opts?.id) qs.set("id", opts.id);
  if (opts?.provider) qs.set("provider", opts.provider);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return fetchJson<ActiveProvider>(`/api/v1/providers/active${suffix}`, token);
}

export async function fetchProviderList(token: string): Promise<ProviderListItem[] | null> {
  return fetchJson<ProviderListItem[]>(`/api/v1/providers`, token);
}

function setIfMissing(key: string, value: string | null | undefined): boolean {
  if (!value) return false;
  if (process.env[key] && process.env[key]!.length > 0) return false;
  process.env[key] = value;
  return true;
}

function setForce(key: string, value: string | null | undefined): boolean {
  if (!value) return false;
  process.env[key] = value;
  return true;
}

/**
 * Apply provider config to process.env. By default only fills blanks (so
 * manual exports win at startup). When `force=true` (mid-session switch via
 * /provider), all keys are overwritten and conflicting providers' flags are
 * cleared first so the runtime picks the right transport.
 */
// Sensible per-provider model defaults used when the platform row leaves
// DefaultModel blank. Keeps the startup banner from flashing
// "(no model selected)" — admins can still override per-provider in the web
// panel and the CLI will pick that up via the regular bootstrap path.
const DEFAULT_MODEL_BY_PROVIDER: Record<string, string> = {
  anthropic: "claude-sonnet-4-5",
  openai:    "gpt-4o",
  lmstudio:  "local-model",
  ollama:    "llama3.1:8b",
  codex:     "codexplan",
};

function defaultModelFor(provider: string): string {
  return DEFAULT_MODEL_BY_PROVIDER[provider.toLowerCase()] ?? "default";
}

export function applyProvider(p: ActiveProvider, opts?: { force?: boolean }): string[] {
  const force = opts?.force === true;
  const set = force ? setForce : setIfMissing;
  const applied: string[] = [];

  if (force) {
    // Clear competing provider flags so detectProvider picks the right branch.
    delete process.env.ALTARIS_USE_OPENAI;
    delete process.env.ALTARIS_USE_OLLAMA;
    delete process.env.ALTARIS_USE_GEMINI;
    delete process.env.ALTARIS_USE_GITHUB;
    delete process.env.ALTARIS_USE_MISTRAL;
  }

  const resolvedModel = p.model ?? defaultModelFor(p.provider);

  switch (p.provider.toLowerCase()) {
    case "lmstudio":
    case "openai": {
      if (set("ALTARIS_USE_OPENAI", "1"))     applied.push("ALTARIS_USE_OPENAI");
      if (set("OPENAI_BASE_URL", p.baseUrl))  applied.push("OPENAI_BASE_URL");
      if (set("OPENAI_API_KEY",  p.apiKey))   applied.push("OPENAI_API_KEY");
      if (set("OPENAI_MODEL",    resolvedModel)) applied.push("OPENAI_MODEL");
      break;
    }
    case "anthropic": {
      if (set("ANTHROPIC_API_KEY",  p.apiKey))     applied.push("ANTHROPIC_API_KEY");
      if (set("ANTHROPIC_BASE_URL", p.baseUrl))    applied.push("ANTHROPIC_BASE_URL");
      if (set("ANTHROPIC_MODEL",    resolvedModel)) applied.push("ANTHROPIC_MODEL");
      break;
    }
    case "ollama": {
      if (set("ALTARIS_USE_OLLAMA", "1"))    applied.push("ALTARIS_USE_OLLAMA");
      if (set("OLLAMA_BASE_URL", p.baseUrl)) applied.push("OLLAMA_BASE_URL");
      if (set("OLLAMA_MODEL",    resolvedModel)) applied.push("OLLAMA_MODEL");
      break;
    }
    case "codex": {
      // OAuth-backed Codex profile shipped from /providers/active. The
      // access_token in `apiKey` is whatever the platform refreshed last —
      // the CLI never has to know about refresh tokens.
      if (set("ALTARIS_USE_OPENAI", "1"))                                applied.push("ALTARIS_USE_OPENAI");
      if (set("OPENAI_BASE_URL", p.baseUrl ?? "https://chatgpt.com/backend-api/codex")) applied.push("OPENAI_BASE_URL");
      if (set("OPENAI_API_KEY",  p.apiKey))                              applied.push("OPENAI_API_KEY");
      if (set("CODEX_API_KEY",   p.apiKey))                              applied.push("CODEX_API_KEY");
      if (set("OPENAI_MODEL",    p.model ?? "codexplan"))                applied.push("OPENAI_MODEL");
      if (p.accountId && set("CHATGPT_ACCOUNT_ID", p.accountId))         applied.push("CHATGPT_ACCOUNT_ID");
      if (p.accountId && set("CODEX_ACCOUNT_ID",   p.accountId))         applied.push("CODEX_ACCOUNT_ID");
      break;
    }
    default:
      // Unknown provider tipi: fallback OpenAI-compatible varsay.
      if (set("ALTARIS_USE_OPENAI", "1"))    applied.push("ALTARIS_USE_OPENAI");
      if (set("OPENAI_BASE_URL", p.baseUrl)) applied.push("OPENAI_BASE_URL");
      if (set("OPENAI_API_KEY",  p.apiKey))  applied.push("OPENAI_API_KEY");
      if (set("OPENAI_MODEL",    p.model))   applied.push("OPENAI_MODEL");
  }

  // Always expose active-provider metadata so the banner / status line can
  // show the platform-defined name and selected model rather than guessing.
  process.env.ALTARIS_ACTIVE_PROVIDER_ID = p.id;
  process.env.ALTARIS_ACTIVE_PROVIDER_NAME = p.name;
  process.env.ALTARIS_ACTIVE_PROVIDER_TYPE = p.provider;
  if (p.model) process.env.ALTARIS_ACTIVE_PROVIDER_MODEL = p.model;

  return applied;
}

/**
 * Run the bootstrap. Resolves silently — never throws. Set
 *   ALTARIS_BOOTSTRAP_DEBUG=1
 * to see what (if anything) was applied.
 */
export async function argusBootstrap(): Promise<void> {
  if (process.env.ALTARIS_BOOTSTRAP_DISABLE === "1") return;
  const debug = process.env.ALTARIS_BOOTSTRAP_DEBUG === "1";
  try {
    const token = await readToken();
    if (!token) { if (debug) process.stderr.write("[altaris-bootstrap] no token\n"); return; }

    // Honour the user's last /provider pick first. If that id isn't valid
    // anymore (provider deleted, disabled, moved tenants), fall back to the
    // tenant default so the CLI never gets stuck on a stale pin.
    const pinned = getLastProviderId();
    let active = pinned ? await fetchActiveProvider(token, { id: pinned }) : null;
    if (!active) {
      if (pinned && debug) process.stderr.write(`[altaris-bootstrap] pinned id ${pinned} not found, using tenant default\n`);
      active = await fetchActiveProvider(token);
    }
    if (!active) { if (debug) process.stderr.write("[altaris-bootstrap] no active provider returned\n"); return; }
    const applied = applyProvider(active);
    if (debug) {
      process.stderr.write(
        `[altaris-bootstrap] active=${active.provider}/${active.name} model=${active.model ?? "—"} ` +
        `applied=[${applied.join(",")}]\n`
      );
    }
  } catch (e) {
    if (debug) process.stderr.write(`[altaris-bootstrap] error: ${(e as Error).message}\n`);
  }
}
