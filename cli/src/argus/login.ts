/**
 * Altaris CLI — Argus extension: OAuth 2.0 Device Authorization Grant against Keycloak.
 *
 * `altaris login` — opens device flow, prompts user to visit a URL & enter a code,
 * polls token endpoint, persists the access token in the OS credential store.
 *
 * Wired up via the Argus command registrar in src/argus/index.ts (loaded from main.tsx).
 */

import { setTimeout as delay } from "node:timers/promises";
import { writeFile, mkdir, readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";

// PKCE (RFC 7636) — required by altaris-cli realm client (S256).
function makePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  id_token?: string;
}

const DEFAULT_KEYCLOAK = process.env.ALTARIS_KEYCLOAK_ISSUER ?? "http://localhost:8081/realms/altaris";
const CLIENT_ID = process.env.ALTARIS_CLI_CLIENT_ID ?? "altaris-cli";
const DEFAULT_API_BASE = process.env.ALTARIS_API_BASE ?? "http://localhost:5050";

const tokenStorePath = () => join(homedir(), ".altaris", "credentials.json");

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

async function discoverConfig(apiBase: string): Promise<{ issuer: string; clientId: string } | null> {
  try {
    const r = await fetch(`${apiBase}/api/v1/config/cli`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const cfg = (await r.json()) as { issuer?: string; clientId?: string };
    if (!cfg.issuer || !cfg.clientId) return null;
    return { issuer: cfg.issuer, clientId: cfg.clientId };
  } catch {
    return null;
  }
}

async function persistToken(token: TokenResponse, issuer: string, apiBase: string) {
  const dir = join(homedir(), ".altaris");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(
    tokenStorePath(),
    JSON.stringify({
      issuer,
      api_base: apiBase,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: Date.now() + token.expires_in * 1000,
      token_type: token.token_type,
      saved_at: new Date().toISOString()
    }, null, 2),
    { mode: 0o600 }
  );
}

export async function altarisLogin(opts: { issuer?: string; clientId?: string; api?: string } = {}): Promise<number> {
  const apiBase = normalizeBaseUrl(opts.api ?? DEFAULT_API_BASE);
  let issuer = opts.issuer;
  let clientId = opts.clientId;

  // If --api given without --issuer, ask the server which Keycloak realm /
  // client to talk to. Lets one binary target multiple deployments without
  // hard-coding their auth endpoints.
  if (!issuer || !clientId) {
    const discovered = await discoverConfig(apiBase);
    if (discovered) {
      issuer = issuer ?? discovered.issuer;
      clientId = clientId ?? discovered.clientId;
    }
  }
  issuer = issuer ?? DEFAULT_KEYCLOAK;
  clientId = clientId ?? CLIENT_ID;

  process.stdout.write(`\nAltaris — Argus Identity Provider'a giriş\n`);
  process.stdout.write(`  API:       ${apiBase}\n  Authority: ${issuer}\n  Client:    ${clientId}\n\n`);

  // 1. Initiate device flow with PKCE
  const pkce = makePkce();
  const deviceRes = await fetch(`${issuer}/protocol/openid-connect/auth/device`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      scope: "openid",
      code_challenge: pkce.challenge,
      code_challenge_method: "S256"
    })
  });
  if (!deviceRes.ok) {
    process.stderr.write(`Hata: device endpoint ${deviceRes.status} döndü.\n`);
    return 1;
  }
  const device = await deviceRes.json() as DeviceCodeResponse;

  process.stdout.write(`  → Tarayıcında aç: ${device.verification_uri_complete ?? device.verification_uri}\n`);
  process.stdout.write(`  → Kod:           ${device.user_code}\n\n`);
  process.stdout.write(`  ${device.expires_in} sn içinde tamamla. Bekleniyor…\n`);

  // 2. Poll token endpoint
  const deadline = Date.now() + device.expires_in * 1000;
  const interval = Math.max(device.interval ?? 5, 1) * 1000;

  while (Date.now() < deadline) {
    await delay(interval);
    const tokRes = await fetch(`${issuer}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: device.device_code,
        client_id: clientId,
        code_verifier: pkce.verifier
      })
    });

    if (tokRes.ok) {
      const token = await tokRes.json() as TokenResponse;
      await persistToken(token, issuer, apiBase);
      process.stdout.write(`\n✓ Giriş başarılı. Token ${tokenStorePath()} altında.\n`);
      return 0;
    }

    const err = await tokRes.json().catch(() => ({ error: "unknown" })) as { error?: string };
    if (err.error === "authorization_pending" || err.error === "slow_down") continue;
    if (err.error === "expired_token") {
      process.stderr.write(`Hata: kod süresi doldu. \`altaris login\` tekrar dene.\n`);
      return 2;
    }
    process.stderr.write(`Hata: ${err.error ?? "bilinmeyen"} (HTTP ${tokRes.status})\n`);
    return 3;
  }

  process.stderr.write(`Zaman aşımı.\n`);
  return 4;
}

export async function altarisLogout(): Promise<number> {
  try {
    await rm(tokenStorePath(), { force: true });
    process.stdout.write(`✓ Çıkış yapıldı. Token silindi.\n`);
    return 0;
  } catch (e) {
    process.stderr.write(`Hata: ${(e as Error).message}\n`);
    return 1;
  }
}

export async function altarisWhoami(): Promise<number> {
  try {
    const raw = await readFile(tokenStorePath(), "utf8");
    const cred = JSON.parse(raw) as { access_token: string; expires_at: number; issuer: string; api_base?: string };

    if (Date.now() > cred.expires_at) {
      process.stdout.write(`Token süresi dolmuş. \`altaris login\` ile yenile.\n`);
      return 1;
    }

    // Decode JWT payload (no signature verification — informational only)
    const payload = JSON.parse(Buffer.from(cred.access_token.split(".")[1], "base64url").toString("utf8")) as Record<string, unknown>;

    const dim   = (s: string) => `\x1b[2m${s}\x1b[0m`;
    const orange = (s: string) => `\x1b[38;5;208m${s}\x1b[0m`;
    const cyan  = (s: string) => `\x1b[36m${s}\x1b[0m`;
    const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
    const red   = (s: string) => `\x1b[31m${s}\x1b[0m`;

    // Header — kim, hangi tenant
    process.stdout.write(`${orange("◉ Altaris")}  ${cyan(String(payload.email ?? "—"))}  @  ${cyan(String(payload.tid ?? "—"))}\n`);
    process.stdout.write(`${dim(`API:        ${cred.api_base ?? "(re-login to set)"}`)}\n`);
    process.stdout.write(`${dim(`Authority:  ${cred.issuer}`)}\n`);
    process.stdout.write(`${dim(`Expires:    ${new Date(cred.expires_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}`)}\n`);

    // Realm roles (JWT claim'inden)
    const realmAccess = payload.realm_access as { roles?: string[] } | undefined;
    const roles = realmAccess?.roles ?? [];
    if (roles.length > 0) {
      process.stdout.write(`\n${dim("Roller")}\n`);
      for (const r of roles) {
        const tag =
          r === "platform_admin" ? red("● ") :
          r === "tenant_admin"   ? orange("● ") :
                                   green("● ");
        process.stdout.write(`  ${tag}${r}\n`);
      }
    }

    // Effective capabilities (backend'den /me/capabilities)
    try {
      // cred.api_base eski token'larda yoktu — env / default'a düş.
      const apiBase = cred.api_base
        || process.env.ALTARIS_API_BASE
        || "http://localhost:5050";
      if (apiBase) {
        const r = await fetch(`${apiBase}/api/v1/me/capabilities`, {
          headers: { Authorization: `Bearer ${cred.access_token}` },
        });
        if (r.ok) {
          const data = await r.json() as { capabilities: string[] };
          if (data.capabilities?.length > 0) {
            // Group by prefix (chat / vault / remote_control / admin / api_key / session)
            const groups = new Map<string, string[]>();
            for (const cap of data.capabilities) {
              const g = cap.split(".")[0];
              if (!groups.has(g)) groups.set(g, []);
              groups.get(g)!.push(cap);
            }
            process.stdout.write(`\n${dim(`Yetkiler (${data.capabilities.length})`)}\n`);
            for (const [g, caps] of Array.from(groups.entries()).sort()) {
              process.stdout.write(`  ${dim(g.padEnd(14))} ${caps.map(c => c.split(".").slice(1).join(".")).join(", ")}\n`);
            }
          }
        } else if (r.status !== 404) {
          process.stdout.write(`\n${dim(`(Yetkiler alınamadı — HTTP ${r.status})`)}\n`);
        }
      }
    } catch {
      // Network down veya eski API — sessizce atla, JWT bilgisi yeterli.
    }

    return 0;
  } catch {
    process.stdout.write(`Giriş yapılmamış. \`altaris login\` ile başla.\n`);
    return 1;
  }
}

export async function getAccessToken(): Promise<string | null> {
  try {
    const raw = await readFile(tokenStorePath(), "utf8");
    const cred = JSON.parse(raw) as { access_token: string; expires_at: number };
    if (Date.now() > cred.expires_at) return null;
    return cred.access_token;
  } catch {
    return null;
  }
}
