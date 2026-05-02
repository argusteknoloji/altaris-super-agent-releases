/**
 * Argus CLI extensions for Altaris.
 *
 * Wired into main.tsx via:
 *   import { registerArgusCommands } from './argus'
 *   registerArgusCommands(program)
 *
 * Adds: login, logout, whoami, session list/push (calls Altaris API).
 */

import type { Command } from "commander";
import { altarisLogin, altarisLogout, altarisWhoami, getAccessToken } from "./login.js";
import { registerVaultCommands } from "./vaults.js";
import { getApiBase } from "./apiConfig.js";

export function registerArgusCommands(program: Command): void {
  program
    .command("login")
    .description("Argus Identity Provider'a giriş (OAuth Device Flow)")
    .option("--api <url>", "Altaris API base URL (örn: https://altaris.acme.com)")
    .option("--issuer <url>", "Keycloak issuer URL (override — varsayılanı API'den çekilir)")
    .option("--client-id <id>", "OAuth client id (override)")
    .action(async (opts: { api?: string; issuer?: string; clientId?: string }) => {
      const code = await altarisLogin({ api: opts.api, issuer: opts.issuer, clientId: opts.clientId });
      process.exit(code);
    });

  program
    .command("logout")
    .description("Yerel token'ı sil")
    .action(async () => {
      const code = await altarisLogout();
      process.exit(code);
    });

  program
    .command("whoami")
    .description("Aktif kullanıcı + tenant bilgisi")
    .action(async () => {
      const code = await altarisWhoami();
      process.exit(code);
    });

  // NOT: `update` komutu opencode core tarafından zaten register edilmiş
  // (`update|upgrade` alias). Commander duplicate registration'da exception
  // fırlatır ve sonraki tüm Argus register çağrıları (session, provider, vb.)
  // sessizce başarısız olur. Bizim GitHub Releases tabanlı self-updater'ımız
  // `cli/src/cli/update.ts` ve `utils/githubReleaseUpdater.ts` üzerinden çalışıyor.

  const session = program.command("session").description("Sunucu tarafı oturumlar (Altaris API)");

  session
    .command("list")
    .description("Bu kullanıcının son oturumlarını listele")
    .action(async () => {
      const token = await getAccessToken();
      if (!token) {
        process.stderr.write("Giriş yapılmamış. `altaris login` ile başla.\n");
        process.exit(1);
      }
      const r = await fetch(`${getApiBase()}/api/v1/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) {
        process.stderr.write(`API hatası: HTTP ${r.status}\n`);
        process.exit(2);
      }
      const rows = await r.json() as Array<{ id: string; provider: string; model: string; title: string | null; startedAt: string }>;
      if (rows.length === 0) { process.stdout.write("Oturum yok.\n"); process.exit(0); }
      for (const s of rows) {
        process.stdout.write(`${s.startedAt}  ${s.provider}/${s.model}  ${s.title ?? "(başlıksız)"}  ${s.id}\n`);
      }
      process.exit(0);
    });

  // Provider grubu — şu an sadece OAuth-tabanlı Codex bağlantısı; statik
  // sağlayıcılar (OpenAI, Anthropic, vb.) hâlâ web admin'den ekleniyor.
  const provider = program.command("provider").description("Tenant provider yönetimi");
  provider
    .command("connect")
    .description("OAuth-tabanlı sağlayıcı bağla")
    .argument("<kind>", "Bağlanacak sağlayıcı türü (codex)")
    .option("--name <ad>", "Tenant'ta görünecek ad (örn: 'Codex · ekip')")
    .option("--model <model>", "Varsayılan model (codexplan | codexspark)", "codexplan")
    .option("--default", "Bu profili tenant'ta default yap")
    .action(async (kind: string, opts: { name?: string; model?: string; default?: boolean }) => {
      if (kind.toLowerCase() !== "codex") {
        process.stderr.write(`Desteklenmeyen sağlayıcı: ${kind}. Şu an sadece 'codex'.\n`);
        process.exit(2);
      }
      const { altarisProviderConnectCodex } = await import("./codexConnect.js");
      const code = await altarisProviderConnectCodex(opts);
      process.exit(code);
    });

  registerVaultCommands(program);
}
