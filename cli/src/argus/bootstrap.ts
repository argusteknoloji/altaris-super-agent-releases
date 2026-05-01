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
const API_BASE = process.env.ALTARIS_API_BASE ?? "http://localhost:5000";
// Cap the network call so a slow/down API never blocks startup for long.
const FETCH_TIMEOUT_MS = 1500;

interface StoredCreds {
  access_token: string;
  expires_at: number;
}

interface ActiveProvider {
  id: string;
  provider: string;            // anthropic | openai | lmstudio | ollama
  name: string;
  baseUrl: string | null;
  apiKey: string | null;
  model: string | null;
  isDefault: boolean;
}

async function readToken(): Promise<string | null> {
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

async function fetchActive(token: string): Promise<ActiveProvider | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(`${API_BASE}/api/v1/providers/active`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: ctrl.signal
    });
    if (!r.ok) return null;
    return (await r.json()) as ActiveProvider;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function setIfMissing(key: string, value: string | null | undefined): boolean {
  if (!value) return false;
  if (process.env[key] && process.env[key]!.length > 0) return false;
  process.env[key] = value;
  return true;
}

function applyProvider(p: ActiveProvider): string[] {
  const applied: string[] = [];
  switch (p.provider.toLowerCase()) {
    case "lmstudio":
    case "openai": {
      if (setIfMissing("ALTARIS_USE_OPENAI", "1"))    applied.push("ALTARIS_USE_OPENAI");
      if (setIfMissing("OPENAI_BASE_URL", p.baseUrl)) applied.push("OPENAI_BASE_URL");
      if (setIfMissing("OPENAI_API_KEY",  p.apiKey))  applied.push("OPENAI_API_KEY");
      if (setIfMissing("OPENAI_MODEL",    p.model))   applied.push("OPENAI_MODEL");
      break;
    }
    case "anthropic": {
      if (setIfMissing("ANTHROPIC_API_KEY",  p.apiKey))  applied.push("ANTHROPIC_API_KEY");
      if (setIfMissing("ANTHROPIC_BASE_URL", p.baseUrl)) applied.push("ANTHROPIC_BASE_URL");
      if (setIfMissing("ANTHROPIC_MODEL",    p.model))   applied.push("ANTHROPIC_MODEL");
      break;
    }
    case "ollama": {
      if (setIfMissing("ALTARIS_USE_OLLAMA", "1"))    applied.push("ALTARIS_USE_OLLAMA");
      if (setIfMissing("OLLAMA_BASE_URL", p.baseUrl)) applied.push("OLLAMA_BASE_URL");
      if (setIfMissing("OLLAMA_MODEL",    p.model))   applied.push("OLLAMA_MODEL");
      break;
    }
    default:
      // Unknown provider tipi: fallback OpenAI-compatible varsay.
      if (setIfMissing("ALTARIS_USE_OPENAI", "1"))    applied.push("ALTARIS_USE_OPENAI");
      if (setIfMissing("OPENAI_BASE_URL", p.baseUrl)) applied.push("OPENAI_BASE_URL");
      if (setIfMissing("OPENAI_API_KEY",  p.apiKey))  applied.push("OPENAI_API_KEY");
      if (setIfMissing("OPENAI_MODEL",    p.model))   applied.push("OPENAI_MODEL");
  }
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
    const active = await fetchActive(token);
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
