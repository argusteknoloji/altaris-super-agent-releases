/**
 * Resolves which Altaris API base URL the CLI should hit.
 *
 * Precedence (highest first):
 *   1. ALTARIS_API_BASE env var (override for scripts/dev)
 *   2. `api_base` field stored in ~/.altaris/credentials.json (set by
 *      `altaris login --api <url>`)
 *   3. http://localhost:5050 (local dev fallback)
 *
 * Lets one altaris binary work across cloud / on-prem / local installs.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CREDS_PATH = join(homedir(), ".altaris", "credentials.json");
const DEFAULT_LOCAL = "http://localhost:5050";

interface StoredCreds {
  api_base?: string;
  issuer?: string;
  last_provider_id?: string;
  [k: string]: unknown;
}

let _cached: string | null = null;

function readStored(): StoredCreds | null {
  try {
    const raw = readFileSync(CREDS_PATH, "utf8");
    return JSON.parse(raw) as StoredCreds;
  } catch {
    return null;
  }
}

function writeStored(patch: Partial<StoredCreds>): void {
  try {
    const current = readStored() ?? {};
    const next = { ...current, ...patch };
    writeFileSync(CREDS_PATH, JSON.stringify(next, null, 2), { mode: 0o600 });
  } catch {
    /* best effort — login flow will recreate the file next time */
  }
}

/** Last provider id picked via /provider — used by bootstrap on next startup. */
export function getLastProviderId(): string | null {
  return readStored()?.last_provider_id ?? null;
}

export function setLastProviderId(id: string | null): void {
  writeStored({ last_provider_id: id ?? undefined });
}

export function getApiBase(): string {
  if (process.env.ALTARIS_API_BASE) return process.env.ALTARIS_API_BASE;
  if (_cached) return _cached;
  const stored = readStored();
  if (stored?.api_base) {
    _cached = stored.api_base;
    return stored.api_base;
  }
  return DEFAULT_LOCAL;
}

export function getStoredIssuer(): string | null {
  return readStored()?.issuer ?? null;
}

/** Forget cached api_base — call after `altaris login` rewrites credentials. */
export function clearApiBaseCache(): void {
  _cached = null;
}
