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

const API_BASE = process.env.ALTARIS_API_BASE ?? "http://localhost:5050";

export function registerArgusCommands(program: Command): void {
  program
    .command("login")
    .description("Argus Identity Provider'a giriş (OAuth Device Flow)")
    .option("--issuer <url>", "Keycloak issuer URL (override)")
    .option("--client-id <id>", "OAuth client id (override)")
    .action(async (opts: { issuer?: string; clientId?: string }) => {
      const code = await altarisLogin({ issuer: opts.issuer, clientId: opts.clientId });
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
      const r = await fetch(`${API_BASE}/api/v1/sessions`, {
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

  registerVaultCommands(program);
}
