/**
 * `altaris provider connect claude` — runs the local Claude OAuth dance via
 * opencode's authLogin (claude.ai flow), reads the resulting tokens from the
 * secure local store, and ships them up to the Altaris API as a tenant-shared
 * provider entry. Symmetric with codexConnect.ts.
 */

import { authLogin } from "../cli/handlers/auth.js";
import { getClaudeAIOAuthTokensAsync, clearOAuthTokenCache, getOauthAccountInfo } from "../utils/auth.js";
import { getOauthProfileFromOauthToken } from "../services/oauth/getOauthProfile.js";
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
  // opencode'un authLogin'i 'Login successful.\n' yazıp process.exit(0) çağırıyor.
  // Throw ile intercept edersek opencode'un kendi catch bloğu yakalayıp
  // 'Login failed' yazıp exit(1) çağırıyor (kullanıcı için yanıltıcı).
  // En güvenli: exit'i NO-OP yap, async function normal şekilde return etsin.
  // Sonradan biz başarı/hata kontrolü tokens fetch ile yaparız.
  const originalExit = process.exit.bind(process);
  let lastExitCode: number | null = null;
  // @ts-expect-error — runtime override (no-op + record code)
  process.exit = (code?: number) => {
    lastExitCode = code ?? 0;
    /* swallow — async function continues / returns */
  };
  try {
    await authLogin({ claudeai: true });
  } catch (e) {
    process.stderr.write(`Claude OAuth wrapper hatası: ${(e as Error).message ?? String(e)}\n`);
  } finally {
    // @ts-expect-error — restore original
    process.exit = originalExit;
  }
  if (lastExitCode !== null && lastExitCode !== 0) {
    process.stderr.write(`opencode authLogin exit ${lastExitCode} bildirdi.\n`);
    return 2;
  }

  // getClaudeAIOAuthTokens memoize edilmiş — fresh token okumak için cache temizle.
  clearOAuthTokenCache();

  // OAuth dance bittikten sonra token'ı lokal store'dan oku.
  process.stdout.write("\n→ Lokal store'dan token okunuyor…\n");
  const tokens = await getClaudeAIOAuthTokensAsync();
  if (!tokens?.accessToken) {
    process.stderr.write("Token alınamadı (lokal store boş). Re-login dene.\n");
    return 3;
  }
  process.stdout.write(`✓ Access token alındı (uzunluk: ${tokens.accessToken.length}, expires: ${tokens.expiresAt ? new Date(tokens.expiresAt).toISOString() : 'unknown'})\n`);

  // installOAuthTokens profile fetch yapmamış olabilir (cache zamanlama),
  // direkt Anthropic /api/oauth/profile çağırıp UUID + organization + email çek.
  let accountUuid = getOauthAccountInfo()?.accountUuid;
  let organizationUuid: string | undefined = getOauthAccountInfo()?.organizationUuid;
  let email: string | undefined = getOauthAccountInfo()?.emailAddress;
  if (!accountUuid) {
    process.stdout.write("→ Account info lokal'de yok, Anthropic /api/oauth/profile çağrılıyor…\n");
    const profile = await getOauthProfileFromOauthToken(tokens.accessToken);
    if (profile) {
      accountUuid     = profile.account.uuid;
      organizationUuid = profile.organization.uuid;
      email           = profile.account.email;
    }
  }
  process.stdout.write(`→ Account info: ${accountUuid ? `uuid=${accountUuid.substring(0,8)}…, email=${email ?? 'n/a'}` : 'YOK'}\n`);
  if (!accountUuid) {
    process.stderr.write("Account UUID alınamadı. Anthropic profile endpoint reachable değil veya scope eksik.\n");
    return 4;
  }

  const body = {
    accessToken:      tokens.accessToken,
    refreshToken:     tokens.refreshToken ?? null,
    accountUuid,
    organizationUuid: organizationUuid ?? null,
    email:            email ?? null,
    expiresAt:        tokens.expiresAt ? Math.floor(tokens.expiresAt / 1000) : null,
    name:             opts.name,
    model:            opts.model ?? "claude-sonnet-4-7",
    makeDefault:      opts.default ?? false,
  };

  process.stdout.write(`→ Backend POST: ${getApiBase()}/api/v1/providers/connect/claude\n`);
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
