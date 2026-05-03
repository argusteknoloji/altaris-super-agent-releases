/**
 *  `altaris provider sync` — backend'in tenant'a ait OAuth/static provider
 *  config'lerini çek, lokal credentials store'a yaz.
 *
 *  Web'den OAuth bağladıktan sonra (örn. Claude OAuth claudeplatform.com'da
 *  yapıldı, token'lar prod backend DB'sinde) CLI lokal'de tokenları bilmediği
 *  için "Provider yetkilendirmesi yok" hatası alıyordu. Bu komut tokenları
 *  pull edip yazar; CLI sonraki çağrılarda providerlari kullanabilir.
 *
 *  Anthropic (claude_code OAuth):
 *    ~/.altaris/credentials.json içine `claudeAiOauth` field'i yazılır.
 *    getClaudeAIOAuthTokens() bunu okur.
 *
 *  Codex / OpenAI:
 *    ~/.codex/auth.json yazılır (codex CLI uyumlu format).
 *
 *  Static (lmstudio, ollama, openai-key) — şimdilik atlanıyor, kullanıcı
 *  zaten env var setleyebiliyor.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { getAccessToken } from "./login.js";
import { getApiBase } from "./apiConfig.js";

interface RemoteCred {
  id: string;
  provider: string;       // 'anthropic' | 'codex' | 'openai' | 'lmstudio' | 'ollama'
  name: string;
  authKind: string;       // 'oauth' | 'static'
  baseUrl: string | null;
  defaultModel: string | null;
  isDefault: boolean;
  accountId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  expiresAt: string | null;  // ISO date
}

export async function altarisProviderSync(): Promise<number> {
  const token = await getAccessToken();
  if (!token) {
    process.stderr.write("Önce giriş yap: altaris login --tenant <slug>\n");
    return 1;
  }
  const apiBase = getApiBase();
  const url = `${apiBase}/api/v1/me/providers/credentials`;
  process.stdout.write(`→ Provider'lar çekiliyor: ${url}\n`);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  }).catch(() => null);
  if (!res || !res.ok) {
    process.stderr.write(`Hata: HTTP ${res?.status ?? "network-fail"}\n`);
    return 2;
  }
  const creds = (await res.json()) as RemoteCred[];
  if (creds.length === 0) {
    process.stdout.write("Tenant'ta hiç provider yok. Önce web admin'den ekle.\n");
    return 0;
  }

  let written = 0;
  for (const c of creds) {
    try {
      if (c.provider === "anthropic" && c.authKind === "oauth" && c.accessToken) {
        await writeAnthropicCreds(c);
        process.stdout.write(`  ✓ ${c.name} (anthropic OAuth) → ~/.altaris/credentials.json\n`);
        written++;
      } else if (c.provider === "codex" && c.authKind === "oauth" && c.accessToken && c.accountId) {
        await writeCodexCreds(c);
        process.stdout.write(`  ✓ ${c.name} (codex OAuth) → ~/.codex/auth.json\n`);
        written++;
      } else if (c.authKind === "static") {
        // Static provider'lar (ollama, lmstudio) için CLI env var/config bekliyor.
        process.stdout.write(`  · ${c.name} (${c.provider}) — static, env var ile setle: ${envHint(c.provider)}\n`);
      } else {
        process.stdout.write(`  · ${c.name} (${c.provider}) — atlandı (auth: ${c.authKind})\n`);
      }
    } catch (e) {
      process.stderr.write(`  ✗ ${c.name} yazılamadı: ${(e as Error).message}\n`);
    }
  }
  process.stdout.write(`\n✓ ${written} provider lokale yazıldı. Test: altaris -p "selam"\n`);
  return 0;
}

async function writeAnthropicCreds(c: RemoteCred): Promise<void> {
  // ~/.altaris/credentials.json — getClaudeAIOAuthTokens'in beklediği şema
  const path = join(homedir(), ".altaris", "credentials.json");
  await mkdir(join(homedir(), ".altaris"), { recursive: true, mode: 0o700 });

  // Mevcut dosyayı koru (auth.ts'in diğer alanları olabilir — session, vb.)
  let existing: Record<string, unknown> = {};
  try { existing = JSON.parse(await readFile(path, "utf8")); } catch { /* yok ya da bozuk */ }

  existing.claudeAiOauth = {
    accessToken: c.accessToken,
    refreshToken: c.refreshToken,
    expiresAt: c.expiresAt ? new Date(c.expiresAt).getTime() : null,
    scopes: ["user:profile", "user:inference", "user:sessions:claude_code", "user:mcp_servers", "user:file_upload"],
    subscriptionType: null,
    rateLimitTier: null,
  };
  if (c.accountId) {
    existing.oauthAccount = {
      accountUuid: c.accountId,
      organizationUuid: null,
      emailAddress: null,
    };
  }
  await writeFile(path, JSON.stringify(existing, null, 2), { mode: 0o600 });
}

async function writeCodexCreds(c: RemoteCred): Promise<void> {
  // ~/.codex/auth.json — codex CLI uyumlu
  const dir = join(homedir(), ".codex");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const auth = {
    OPENAI_API_KEY: null,
    tokens: {
      id_token: c.idToken ?? "",
      access_token: c.accessToken,
      refresh_token: c.refreshToken,
      account_id: c.accountId,
    },
    last_refresh: c.expiresAt ?? new Date().toISOString(),
  };
  await writeFile(join(dir, "auth.json"), JSON.stringify(auth, null, 2), { mode: 0o600 });
}

function envHint(provider: string): string {
  switch (provider) {
    case "ollama":   return "ALTARIS_USE_OPENAI=1 OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_MODEL=qwen2.5:7b";
    case "lmstudio": return "ALTARIS_USE_OPENAI=1 OPENAI_BASE_URL=http://localhost:1234/v1 OPENAI_MODEL=qwen3.6";
    case "openai":   return "OPENAI_API_KEY=sk-... OPENAI_MODEL=gpt-4o";
    default:         return "(provider'a özel env dokümantasyonuna bak)";
  }
}
