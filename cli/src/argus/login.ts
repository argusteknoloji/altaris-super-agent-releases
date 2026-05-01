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

const tokenStorePath = () => join(homedir(), ".altaris", "credentials.json");

async function persistToken(token: TokenResponse, issuer: string) {
  const dir = join(homedir(), ".altaris");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(
    tokenStorePath(),
    JSON.stringify({
      issuer,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: Date.now() + token.expires_in * 1000,
      token_type: token.token_type,
      saved_at: new Date().toISOString()
    }, null, 2),
    { mode: 0o600 }
  );
}

export async function altarisLogin(opts: { issuer?: string; clientId?: string } = {}): Promise<number> {
  const issuer = opts.issuer ?? DEFAULT_KEYCLOAK;
  const clientId = opts.clientId ?? CLIENT_ID;

  process.stdout.write(`\nAltaris — Argus Identity Provider'a giriş\n`);
  process.stdout.write(`  Authority: ${issuer}\n  Client:    ${clientId}\n\n`);

  // 1. Initiate device flow
  const deviceRes = await fetch(`${issuer}/protocol/openid-connect/auth/device`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, scope: "openid email profile tenant" })
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
        client_id: clientId
      })
    });

    if (tokRes.ok) {
      const token = await tokRes.json() as TokenResponse;
      await persistToken(token, issuer);
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
    const cred = JSON.parse(raw) as { access_token: string; expires_at: number; issuer: string };

    if (Date.now() > cred.expires_at) {
      process.stdout.write(`Token süresi dolmuş. \`altaris login\` ile yenile.\n`);
      return 1;
    }

    // Decode JWT payload (no signature verification — informational only)
    const payload = JSON.parse(Buffer.from(cred.access_token.split(".")[1], "base64url").toString("utf8")) as Record<string, unknown>;

    process.stdout.write(`E-posta:  ${payload.email ?? "—"}\n`);
    process.stdout.write(`Tenant:   ${payload.tid ?? "—"}\n`);
    process.stdout.write(`Subject:  ${payload.sub ?? "—"}\n`);
    process.stdout.write(`Authority:${cred.issuer}\n`);
    process.stdout.write(`Expires:  ${new Date(cred.expires_at).toISOString()}\n`);
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
