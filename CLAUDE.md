# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

This is a polyglot monorepo for **Altaris** — Argus Teknoloji's enterprise agentic AI platform. Four deployable artifacts share a single API + Keycloak + Postgres backbone:

| Path | Artifact | Stack |
|---|---|---|
| `api/` | Multi-tenant backend | .NET 9, EF Core, PostgreSQL, Serilog |
| `cli/` | `altaris` terminal binary | TypeScript + Bun (single-binary compile), React + Ink |
| `web/` | Web portal (chat, terminal, admin) | Next.js 15 App Router, NextAuth, xterm.js, Tailwind v4 |
| `desktop/` | macOS/Windows native app | Tauri 2 + Vite + React 19 |
| `vscode-extension/` | VS Code uzantısı (VSIX) | TypeScript + WebSocket MCP bridge |
| `infra/` | Local + prod compose stacks | Postgres 16, Keycloak 26, Redis 7, Caddy |

There is **no top-level package manager** — each subproject manages its own deps. Don't run install/build commands from the repo root.

## Common commands

### API (.NET 9)
```bash
cd api
dotnet run --project src/Altaris.Api          # dev server (port 5000)
dotnet build                                   # build all projects
dotnet test                                    # run all tests
dotnet test tests/Altaris.Api.Tests --filter "FullyQualifiedName~SessionEndpointsTests"  # single test
dotnet ef migrations add <Name> -p src/Altaris.Infrastructure -s src/Altaris.Api
dotnet ef database update -p src/Altaris.Infrastructure -s src/Altaris.Api
```

### CLI (Bun)
```bash
cd cli
bun install
bun run build                                  # bundles to dist/cli.mjs
bun run dev                                    # build + run
bun test                                       # run all tests
bun test src/utils/providerRecommendation.test.ts  # single test file
bun run typecheck                              # tsc --noEmit
bun run smoke                                  # build + --version sanity check
bun run verify:privacy                         # ensure no telemetry phone-home
bun run doctor:runtime                         # system-check report

# Provider/profile dev launchers (see scripts/provider-launch.ts)
bun run dev:ollama                             # ollama provider
bun run dev:codex                              # codex provider
bun run dev:fast                               # smallest local model

# Single-binary release builds
bun build --compile --target=bun-darwin-arm64 ./dist/cli.mjs --outfile release/altaris-darwin-arm64
```

### Web (Next.js 15)
```bash
cd web
pnpm install
pnpm dev                                       # port 3000
pnpm build && pnpm start
pnpm lint
pnpm typecheck
```

### Desktop (Tauri 2)
```bash
cd desktop
pnpm install
pnpm tauri:dev                                 # hot-reload dev
pnpm tauri:build:mac                           # universal-apple-darwin
pnpm tauri:build:win                           # x86_64-pc-windows-msvc
pnpm typecheck
```

### Infra (local dev stack)
```bash
cd infra
docker compose up -d                           # Postgres + Keycloak + Redis
docker compose down
```

Production deploy uses `infra/docker-compose.prod.yml` + `.env.production` + Caddy — see `docs/PRODUCTION.md`. Don't commit `.env.production`.

## Architecture

### Authentication / multi-tenancy

All four artifacts authenticate against a **single Keycloak realm** (`altaris`):

- **CLI / Desktop:** OAuth 2.0 Device Authorization Grant. Tokens cached in OS keychain. CLI implementation lives in `cli/src/argus/login.ts` + `cli/src/commands/login/`.
- **Web:** OIDC Auth Code + PKCE via NextAuth (`web/src/auth.ts`). Session cookie.
- **Tenant isolation:** every JWT carries a `tid` claim. The API enforces tenant scoping via PostgreSQL **Row-Level Security** policies, configured in `api/src/Altaris.Infrastructure/MultiTenancy/`. Bypassing the tenant context in EF queries = data leak — always go through the tenancy abstraction.

### API (`api/`)

.NET 9 **modular monolith**. The solution (`api/Altaris.sln`) has six projects:

- `Altaris.Api` — entry point, minimal-API endpoints under `Endpoints/`, middleware, rate limiting, OpenAPI, Serilog wiring (`Program.cs`).
- `Altaris.Domain` — pure domain entities/value objects.
- `Altaris.Infrastructure` — EF Core DbContext, Keycloak admin client, Redis presence, PTY session manager (`Pty/`), remote control broker, vault filesystem storage, embeddings, executive-brain glue.
- `Altaris.Modules.Sessions`, `Altaris.Modules.Tenants`, `Altaris.Modules.Users` — feature modules.

Endpoints are registered as **minimal-API** groups (e.g. `ChatEndpoints.cs`, `PtyEndpoints.cs`, `RemoteControlEndpoints.cs`, `VaultEndpoints.cs`). The remote-PTY + remote-control flow is the non-obvious one: web portal connects via WebSocket through `RemoteControlEndpoints` → `RemoteControlBroker` (Redis-backed) → CLI on user's machine acts as the PTY backend. `PtySessionManager` tracks in-process PTY sessions; `PresenceTracker` is Redis-backed.

In `Production` environment, `Program.cs` requires `ConnectionStrings:Postgres`, `Keycloak:Authority`, and `Keycloak:AdminClientSecret` — startup throws otherwise.

### CLI (`cli/`)

This CLI is a **fork/extension of Anthropic's Claude Code**. The core agentic engine (Task loop, tools, ink TUI, MCP, plugins, memory) is upstream code; **Argus-specific additions live exclusively under `cli/src/argus/`** (`apiConfig`, `login`, `vaults`, `remoteControl`, `sessionTracker`, `providerSync`, `claudeConnect`, `codexConnect`, `update`). When extending, prefer adding under `argus/` rather than modifying the upstream tree — release sync becomes easier.

Build pipeline: `scripts/build.ts` produces `dist/cli.mjs` (single ESM bundle), then `bun build --compile` produces a single static binary per platform. The `bin/altaris` shim points to `dist/cli.mjs` for dev. Releases are built/uploaded by `scripts/release.ts` and `.github/workflows/release.yml`.

`scripts/verify-no-phone-home.ts` is a hard CI gate — privacy-sensitive customers (kamu/savunma/finans) require zero outbound telemetry, so no GrowthBook / OTLP / analytics calls may execute by default. Don't introduce code paths that phone home unconditionally.

### Web (`web/src/app/`)

Next.js App Router. Notable routes: `chat/`, `terminal/` (xterm.js → API WebSocket), `remote-control/` (controls a paired CLI's PTY), `vaults/`, `dashboard/`, `admin/`, `katalog/`, `executive-brain/`, `senaryolar/`, `setup/`, `invite/`. Server actions in `_actions/`; shared components in `_components/`. Auth in `src/auth.ts`.

### Desktop (`desktop/`)

Tauri 2 shell + React 19 frontend (`src/`). Rust side in `src-tauri/` handles auto-update (`tauri-plugin-updater`), keychain (`tauri-plugin-store`), shell, process. Reuses xterm.js + Monaco the same way `web/` does. macOS notarization + Windows code signing are required for distribution; see `docs/CODE-SIGNING.md` and `docs/APPLE-CERT-PERSONEL-NOTU.md`.

### VS Code extension (`vscode-extension/`)

Bağımsız VSIX paketi. CLI ile `~/.altaris/ide/<port>.lock` üzerinden auth token alıp WebSocket MCP bridge kurar; `openDiff`, `getDiagnostics`, `getOpenEditors`, `executeCode` (Jupyter) gibi tool'lar sağlar. Status bar (model · token · connection), Cmd+I inline edit (CLI'a child_process spawn → fenced code block extract → satır içi yer değiştirme), Cmd+Shift+2 workspace file picker, Quick Fix lightbulb, Code Lens (Explain · Test · Refactor), file watcher live context push, settings sync, terminal profile, Activity Bar TreeView (Durum / Hızlı eylemler / Bakım) içerir. CLI günde bir kez `checkExtensionUpdateOnce` ile uzantı güncellemesi denetler. Marketplace yayını manuel `vsce-publish.yml` workflow'u + `VSCE_PAT` secret ile yapılır; air-gapped müşterilere `web/public/altaris.vsix` üzerinden dağıtılır.

### Vault flow (`cli/src/argus/vaults/` + `api/.../Vaults/`)

`altaris vault create <slug>` 31 dosyalık iskeleti, `.altaris/plugins/vault/` ve `.altaris/settings.json`'u oluşturur (`--here | --into <dir> | --legacy-mirror` bayrakları). `altaris vault use <slug>` arka planda bidirectional sync daemon başlatır: lokal `fs.watch` 1.5s debounce → manifest fetch → sha256 diff → `PUT` (parentChecksum, 409 conflict ile üç-yollu merge); uzak taraf `GET /api/v1/vaults/{slug}/events` SSE akışı (in-memory `IVaultEventBroker` pub/sub) — `created | updated | deleted` event'leri pull tetikler. Built-in `vault@builtin` plugin'i her vault'ta `/vault:wiki`, `/vault:save`, `/vault:canvas`, `/vault:autoresearch`, `/vault:wiki-ingest`, `/vault:wiki-query`, `/vault:wiki-lint`, `/vault:obsidian-markdown`, `/vault:obsidian-bases`, `/vault:defuddle` slash komutlarını otomatik aktive eder. Multi-pod prod deploylarda `VaultEventBroker` Redis adapter'ı henüz yok — tek replica çalıştırılmalı (bkz. `docs/PRODUCTION.md` §11).

## Conventions and guardrails

- **Language:** product-facing docs, comments, and commit messages are typically Turkish; code identifiers are English. Match the surrounding style.
- **Privacy gate (CLI):** any new dependency or code path that could call out to a third-party endpoint must pass `bun run verify:privacy`. The repo treats this as a correctness invariant, not a "nice to have".
- **No upstream-tree edits in CLI when avoidable:** Argus-specific behavior goes in `cli/src/argus/`. Touching upstream files (`cli/src/commands/`, `cli/src/tools/`, `cli/src/query/`, etc.) makes future merges from upstream painful — prefer hooks/wrappers from `argus/` if possible.
- **Tenant scoping in API:** never write a raw EF query that bypasses the multi-tenancy filter; route through `Altaris.Infrastructure/MultiTenancy/`.
- **Production config:** `Program.cs` fails fast on missing prod secrets — don't add new required prod settings without updating the `Req(...)` block and the production deployment docs.
