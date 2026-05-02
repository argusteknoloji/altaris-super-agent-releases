/**
 * `altaris provider connect claude` — runs the local Claude OAuth dance via
 * opencode's authLogin (claude.ai flow), reads the resulting tokens from the
 * secure local store, and ships them up to the Altaris API as a tenant-shared
 * provider entry. Symmetric with codexConnect.ts.
 */

import { authLogin } from "../cli/handlers/auth.js";
import { getClaudeAIOAuthTokensAsync } from "../utils/auth.js";
import { getOauthAccountInfo } from "../utils/auth.js";
import { getApiBase } from "./apiConfig.js";
import { readToken } from "./bootstrap.js";

interface ConnectOptions {
  name?: string;
  model?: string;          // claude-sonnet-4-7, claude-opus-4-7 vb.
  default?: boolean;
}

export async function altarisProviderConnectClaude(opts: ConnectOptions = {}): Promise<number> {
  const apiToken = await readToken();
  if (!apiToken) {
    process.stderr.write("Önce `altaris login --api ...` çalıştır.\n");
    return 1;
  }

  process.stdout.write("\nClaude (Anthropic) OAuth — tarayıcı açılacak.\n");
  try {
    // opencode'un kendi OAuth flow'u: tarayıcı açar, callback alır,
    // token'ı macOS Keychain veya secure storage'a yazar.
    await authLogin({ claudeai: true });
  } catch (e) {
    process.stderr.write(`Claude OAuth başarısız: ${(e as Error).message}\n`);
    return 2;
  }

  // OAuth dance bittikten sonra token'ı lokal store'dan oku.
  const tokens = await getClaudeAIOAuthTokensAsync();
  if (!tokens?.accessToken) {
    process.stderr.write("Token alınamadı (lokal store boş). Re-login dene.\n");
    return 3;
  }

  const account = getOauthAccountInfo();
  const accountUuid = account?.accountUuid;
  if (!accountUuid) {
    process.stderr.write("Account UUID bulunamadı. claude.ai profile fetch fail.\n");
    return 4;
  }

  const body = {
    accessToken:      tokens.accessToken,
    refreshToken:     tokens.refreshToken ?? null,
    accountUuid,
    organizationUuid: account?.organizationUuid ?? null,
    email:            account?.emailAddress ?? null,
    expiresAt:        tokens.expiresAt ? Math.floor(tokens.expiresAt / 1000) : null,
    name:             opts.name,
    model:            opts.model ?? "claude-sonnet-4-7",
    makeDefault:      opts.default ?? false,
  };

  const res = await fetch(`${getApiBase()}/api/v1/providers/connect/claude`, {
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
    return 5;
  }
  const out = (await res.json()) as {
    id: string;
    name: string;
    model: string;
    expiresAt: string;
    isDefault: boolean;
  };

  process.stdout.write(
    `\n✓ Claude bağlandı.\n` +
      `  Tenant provider id: ${out.id}\n` +
      `  Ad:                 ${out.name}\n` +
      `  Model:              ${out.model}\n` +
      `  Token expires at:   ${out.expiresAt}\n` +
      `  Default:            ${out.isDefault ? "evet" : "hayır"}\n` +
      `\nArtık /provider menüsünden seçip kullanabilirsin.\n`,
  );
  return 0;
}
