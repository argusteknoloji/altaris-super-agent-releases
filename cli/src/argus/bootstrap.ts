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

// 401 recovery için detaylı sonuç ayrımı: API 503 + provider_oauth_refresh_failed
// dönerse kullanıcıya net mesaj basabilelim, network hatasıyla karıştırmayalım.
export type FetchActiveDetailed =
  | { kind: "ok"; data: ActiveProvider }
  | { kind: "refresh_failed"; detail: string }
  | { kind: "not_found" }
  | { kind: "unauthorized" }
  | { kind: "network" };

export async function fetchActiveProviderDetailed(
  token: string,
  opts: { id?: string; provider?: string } = {},
): Promise<FetchActiveDetailed> {
  const qs = new URLSearchParams();
  if (opts.id) qs.set("id", opts.id);
  if (opts.provider) qs.set("provider", opts.provider);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(`${getApiBase()}/api/v1/providers/active${suffix}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (r.status === 503) {
      // API JIT refresh tried + failed (RT revoke / IdP down). Title alanı
      // "provider_oauth_refresh_failed" → bunu UX'te ayırt et.
      try {
        const body = (await r.json()) as { title?: string; detail?: string };
        if (body.title === "provider_oauth_refresh_failed") {
          return { kind: "refresh_failed", detail: body.detail ?? "OAuth refresh failed" };
        }
      } catch {
        /* JSON parse fail → generic network */
      }
      return { kind: "network" };
    }
    if (r.status === 401 || r.status === 403) return { kind: "unauthorized" };
    if (r.status === 404) return { kind: "not_found" };
    if (!r.ok) return { kind: "network" };
    const data = (await r.json()) as ActiveProvider;
    return { kind: "ok", data };
  } catch {
    return { kind: "network" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 401 anında çağrılır: API'den fresh access_token çek (PR-1 JIT refresh
 * tetiklenir), ALTARIS_OAUTH_TOKEN env'ini overwrite et, fresh token'ı dön.
 *
 * Env-var modunda CLI refreshToken görmediği için in-session refresh yapamıyor;
 * tek çare API'ye yeniden /providers/active çağrısı atmak.
 */
export type RebootstrapResult =
  | { ok: true; freshToken: string }
  | { ok: false; reason: "no_token" | "no_active" | "no_access_token" | "network" }
  | { ok: false; reason: "refresh_failed"; detail: string };

export async function rebootstrapClaudeProvider(failedAccessToken: string): Promise<RebootstrapResult> {
  if (process.env.ALTARIS_BOOTSTRAP_DISABLE === "1") return { ok: false, reason: "no_token" };
  const token = await readToken();
  if (!token) return { ok: false, reason: "no_token" };

  // Pinned id öncelikli (kullanıcı /provider ile seçtiyse onu yenile);
  // yoksa provider=anthropic ile tenant default'unu çek.
  const pinned = getLastProviderId();
  let result = pinned
    ? await fetchActiveProviderDetailed(token, { id: pinned })
    : await fetchActiveProviderDetailed(token, { provider: "anthropic" });

  // Pinned id artık geçersizse fallback'e düş (silinmiş, disable edilmiş, vb.)
  if (result.kind === "not_found" && pinned) {
    result = await fetchActiveProviderDetailed(token, { provider: "anthropic" });
  }

  if (result.kind === "refresh_failed") return { ok: false, reason: "refresh_failed", detail: result.detail };
  if (result.kind === "not_found")       return { ok: false, reason: "no_active" };
  if (result.kind === "unauthorized")    return { ok: false, reason: "no_token" };
  if (result.kind === "network")         return { ok: false, reason: "network" };

  const active = result.data;
  if (!active.apiKey) return { ok: false, reason: "no_access_token" };

  // Aynı stale token tekrar geldiyse refresh sahiden olmamış → fail döndür ki
  // caller sonsuz retry'a girmesin.
  if (active.apiKey === failedAccessToken) {
    return { ok: false, reason: "refresh_failed", detail: "API stale aynı token'ı döndürdü" };
  }

  // Env'i FORCE overwrite et — bootstrap setIfMissing kullanıyor, biz
  // zaten set olan token'ı yenilemek istiyoruz.
  applyProvider(active, { force: true });
  return { ok: true, freshToken: active.apiKey };
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
      // OAuth (claude_code scope) tokenları Bearer + system prelude bekliyor;
      // ANTHROPIC_API_KEY x-api-key header olarak gider, OAuth ile uyumsuz.
      // CLI getClaudeAIOAuthTokens() helper'ı ALTARIS_OAUTH_TOKEN env'i okur.
      if (p.authKind === "oauth") {
        if (set("ALTARIS_OAUTH_TOKEN", p.apiKey)) applied.push("ALTARIS_OAUTH_TOKEN");
      } else {
        if (set("ANTHROPIC_API_KEY",  p.apiKey)) applied.push("ANTHROPIC_API_KEY");
      }
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

  // VS Code extension güncelleme kontrolü (günde 1 kez, async fire-and-forget).
  // Provider bootstrap'ı bloklamasın diye await etmiyoruz.
  void (async () => {
    try {
      const { checkExtensionUpdateOnce } = await import("../utils/ide.js");
      await checkExtensionUpdateOnce();
    } catch {
      /* fail silently */
    }
  })();

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
