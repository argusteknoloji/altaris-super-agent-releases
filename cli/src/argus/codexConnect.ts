/**
 * `altaris provider connect codex` — runs the local Codex OAuth dance against
 * auth.openai.com (browser) and ships the resulting token set up to the
 * Altaris API as a tenant-shared provider entry. After this command, anyone
 * in the tenant can pick the Codex profile from /provider — the platform's
 * background refresh worker keeps the access_token fresh.
 */

import { openBrowser } from "../utils/browser.js";
import { CodexOAuthService } from "../services/api/codexOAuth.js";
import { getApiBase } from "./apiConfig.js";
import { readToken } from "./bootstrap.js";

const REFRESH_HEADROOM_SECONDS = 60;

function decodeJwtExp(jwt: string): number | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function expiresInSeconds(accessToken: string, fallback = 3600): number {
  const exp = decodeJwtExp(accessToken);
  if (!exp) return fallback;
  const now = Math.floor(Date.now() / 1000);
  return Math.max(REFRESH_HEADROOM_SECONDS, exp - now);
}

interface ConnectOptions {
  name?: string;
  model?: string;          // codexplan | codexspark
  default?: boolean;
}

export async function altarisProviderConnectCodex(opts: ConnectOptions = {}): Promise<number> {
  const apiToken = await readToken();
  if (!apiToken) {
    process.stderr.write("Önce `altaris login` çalıştır.\n");
    return 1;
  }

  process.stdout.write("\nCodex (ChatGPT) OAuth — tarayıcı açılacak.\n");
  const service = new CodexOAuthService();
  let tokens;
  try {
    tokens = await service.startOAuthFlow(async (authUrl) => {
      process.stdout.write(`  → ${authUrl}\n  Tarayıcı açılıyor…\n`);
      const opened = await openBrowser(authUrl);
      if (!opened) {
        process.stdout.write("  Tarayıcı otomatik açılmadı. Yukarıdaki URL'yi elle aç.\n");
      }
    });
  } catch (e) {
    process.stderr.write(`Codex OAuth başarısız: ${(e as Error).message}\n`);
    return 2;
  }

  if (!tokens.accessToken || !tokens.refreshToken || !tokens.accountId) {
    process.stderr.write(
      "Codex token seti eksik (access_token / refresh_token / accountId). Re-login dene.\n",
    );
    return 3;
  }

  const body = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    idToken: tokens.idToken,
    accountId: tokens.accountId,
    expiresIn: expiresInSeconds(tokens.accessToken),
    name: opts.name,
    model: opts.model ?? "codexplan",
    makeDefault: opts.default ?? false,
  };

  const res = await fetch(`${getApiBase()}/api/v1/providers/connect/codex`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    process.stderr.write(`Platform connect başarısız: HTTP ${res.status} ${txt}\n`);
    return 4;
  }
  const out = (await res.json()) as {
    id: string;
    name: string;
    model: string;
    expiresAt: string;
    isDefault: boolean;
  };

  process.stdout.write(
    `\n✓ Codex bağlandı.\n` +
      `  Tenant provider id: ${out.id}\n` +
      `  Ad:                 ${out.name}\n` +
      `  Model:              ${out.model}\n` +
      `  Token expires at:   ${out.expiresAt}\n` +
      `  Default:            ${out.isDefault ? "evet" : "hayır"}\n` +
      `\nArtık /provider menüsünden seçip kullanabilirsin. Refresh otomatik.\n`,
  );
  return 0;
}
