# Altaris Platform

**Argus Teknoloji** — Kurumsal Agentic AI Terminali + Multi-Tenant Web Portalı

> Veri güvenliği hassasiyeti olan kurumlar için lokal/on-prem deploy edilebilir agent platformu. Bulut isteyen müşteriler için Claude API doğrudan kullanılır; kamu/savunma/finans kurumları için Altaris lokal LLM'lere bağlanan kendi terminalimizdir.

## Bileşenler

| Klasör | Bileşen | Stack |
|---|---|---|
| `cli/` | `altaris` terminal binary'si | TypeScript + Bun (single-binary compile) |
| `web/` | Web portal + chat + remote terminal viewer | Next.js 16 (App Router) + xterm.js |
| `api/` | Multi-tenant backend API | .NET 9 modular monolith + EF Core + PostgreSQL |
| `desktop/` | macOS / Windows native uygulama | Tauri 2 + Vite + React 19 |
| `vscode-extension/` | VS Code uzantısı (VSIX) | TypeScript + WebSocket MCP bridge |
| `infra/` | Lokal dev stack | docker-compose: Postgres 16 + Keycloak 26 + Redis 7 |
| `docs/` | Mimari, deployment, API referansı | Markdown |

## Hızlı Başlangıç (Dev)

```bash
# 1. Infra (Postgres + Keycloak + Redis)
cd infra && docker compose up -d

# 2. API (.NET)
cd ../api && dotnet run --project src/Altaris.Api

# 3. Web portal
cd ../web && pnpm install && pnpm dev

# 4. CLI build
cd ../cli && bun install && bun run build && ./dist/altaris --version

# 5. Login (OAuth Device Flow → Keycloak)
./cli/dist/altaris login
```

## Mimari Özet

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  altaris CLI    │◄───────►│  Altaris API     │◄───────►│   PostgreSQL     │
│  (Bun binary)   │  REST   │  (.NET 9)        │  EF     │   (multi-tenant) │
│                 │  +WS    │  - Sessions      │         │   RLS by tenant  │
│  Local LLM      │         │  - Tenants       │         └──────────────────┘
│  (Ollama, vllm, │         │  - Audit log     │                 ▲
│  LM Studio,     │         │  - Remote PTY    │                 │
│  Claude API)    │         └──────────────────┘                 │
└─────────────────┘                  ▲                           │
        ▲                            │ JWT (Keycloak)            │
        │                            │                           │
        │                  ┌─────────┴──────────┐                │
        │                  │   Web Portal       │                │
        └──── WS PTY ─────►│   (Next.js 16)     │                │
                           │   - Chat           │◄───────────────┘
                           │   - Sessions       │
                           │   - Remote Term    │
                           │   - Tenant admin   │
                           └────────────────────┘
                                     ▲
                                     │ OIDC
                                     ▼
                           ┌────────────────────┐
                           │   Keycloak         │
                           │   - Multi-tenant   │
                           │   - SAML/OIDC      │
                           │   - e-Devlet ready │
                           └────────────────────┘
```

## Authorization Modelleri

- **CLI:** OAuth 2.0 Device Authorization Grant → Keycloak → Access Token (cached in OS keychain)
- **Web:** OIDC Authorization Code + PKCE → Keycloak → Session cookie
- **Tenant izolasyonu:** JWT içinde `tid` claim → API tarafında PostgreSQL Row-Level Security ile zorunlu filtre

## Deployment Modları

| Mod | Hedef Müşteri | Notlar |
|---|---|---|
| **On-Prem (air-gapped)** | Kamu, savunma, finans | Tüm bileşenler müşteri DC'sinde, lokal LLM zorunlu |
| **Private Cloud** | Orta-büyük kurumsal | Argus managed VPC, tek tenant |
| **SaaS Multi-Tenant** | KOBİ + AI consulting müşterileri | Argus hosted, bulut model provider + opsiyonel lokal LLM |

## Hızlı Kurulum (Son Kullanıcı)

Tek satırla `altaris` binary'sini PATH'e kur, ardından login + ilk vault:

```bash
# 1. Binary kurulumu (GitHub release asset, platforma göre)
curl -fsSL https://get.altaris.argusteknoloji.com.tr/install.sh | bash

# 2. PATH'e symlink + (opsiyonel) VS Code uzantısını otomatik kur
altaris shell-install --with-vscode

# 3. Keycloak Device Flow ile giriş
altaris login

# 4. İlk vault — geçerli dizin altına `demo/` scaffold'u (31 dosya + .altaris/)
altaris vault create demo

# 5. Vault'a "gir" — bidirectional sync daemon arka planda başlar
cd demo && altaris vault use demo
```

`altaris vault create` 31 dosyalık iskeleti, `.altaris/plugins/vault/` dizinini ve
`.altaris/settings.json` dosyasını oluşturur. `--here`, `--into <dir>` ve
`--legacy-mirror` bayrakları mevcut dizin yapılarına adaptasyon için kullanılır.
`altaris vault use` daemon'u devre dışı bırakmak için `--no-daemon | --no-sync`.

## VS Code Entegrasyonu

`altaris-vscode` uzantısı, VS Code içinde tam Altaris deneyimi sunar:

```bash
# CLI ile birlikte tek komutta kur
altaris shell-install --with-vscode

# Veya manuel VSIX
code --install-extension ./vscode-extension/altaris.vsix
```

Özellikler:

- **MCP WebSocket bridge** — `~/.altaris/ide/<port>.lock` dosyasından auth token okunur, CLI ile çift yönlü kanal kurulur
- **Tools** — `openDiff`, `close_tab`, `getDiagnostics`, `getCurrentSelection`, `getOpenEditors`, `executeCode` (Jupyter kernel)
- **Status bar** — model · token sayacı · bağlantı durumu (canlı CLI feed)
- **Inline edit (Cmd+I)** — seçimi CLI'a gönder, fenced code block çıktısı satır içi yer değiştirme olarak uygulanır
- **Quick Fix lightbulb** — diagnostic üzerine "Fix with Altaris" eylemi
- **Code Lens** — fonksiyon başlıklarına `Explain · Test · Refactor` aksiyonları
- **File watcher** — kaydetme tetikli canlı bağlam push
- **Workspace notifications** — uzun süren görev ilerlemesi + tamamlanma bildirimi + aksiyon butonları
- **Settings sync** — tema, font, locale otomatik CLI'a aktarılır
- **Workspace file picker (Cmd+Shift+2)** — `@-mention` path girişi için fuzzy picker
- **Inline diff accept/reject** — toast + CodeLens üzerinden onay
- **Terminal profile** — terminal "+" dropdown'unda "Altaris" + ikon
- **Activity Bar sidebar** — sol kenarda turuncu **A** ikonu, TreeView (Durum / Hızlı eylemler / Bakım)

| Kısayol | Aksiyon |
|---|---|
| `Cmd+I` (`Ctrl+I`) | Inline edit |
| `Cmd+Shift+2` (`Ctrl+Shift+2`) | Workspace file picker (`@`-mention) |

Detay: [./vscode-extension/README.md](./vscode-extension/README.md)

## Vault Akışı

```
altaris vault create <slug>           altaris vault use <slug>
        │                                     │
        ▼                                     ▼
  31 dosya scaffold                    fs.watch (debounced 1.5s)
  .altaris/plugins/vault/                     │
  .altaris/settings.json                      ▼
                                       manifest fetch + sha256 diff
                                              │
                              ┌───────────────┼───────────────┐
                              ▼                               ▼
                  PUT /vaults/{slug}/files          GET /vaults/{slug}/events
                  (parentChecksum, 409 conflict)    (Server-Sent Events stream)
                              │                               │
                              └────────┬──────────────────────┘
                                       ▼
                              VaultEventBroker
                              (created / updated / deleted)
```

- **Local → Remote:** `fs.watch` 1.5s debounce, manifest farkı `sha256` ile çıkarılır,
  `parentChecksum` ile optimistik `PUT`. `409 Conflict` üç-yollu birleştirme
  ekranını açar.
- **Remote → Local:** SSE akışından gelen `created | updated | deleted` event'leri
  arka plan daemon'u tarafından `pull` edilir.
- **API:** `GET /api/v1/vaults/{slug}/events` (in-memory `IVaultEventBroker` pub/sub).

## Slash Commands — Built-in Vault Skills

Her yeni vault'ta `vault@builtin` plugin'i otomatik aktiftir. `claude-obsidian`'dan
rebrand edilen on adet skill yerleşiktir:

| Komut | Açıklama |
|---|---|
| `/vault:wiki` | Vault iskeletini bootstrap et / sağlık kontrolü |
| `/vault:save` | Aktif konuşmayı yapılandırılmış nota dönüştürerek vault'a yaz |
| `/vault:canvas` | Görsel canvas üzerinde resim/PDF/sayfa düzenle |
| `/vault:autoresearch` | Otonom araştırma döngüsü — web + sentez + dosyalama |
| `/vault:wiki-ingest` | URL/dosya/batch kaynaktan vault'a ingest |
| `/vault:wiki-query` | Vault'tan citation'lı yanıt üretimi (quick/standard/deep) |
| `/vault:wiki-lint` | Orphan, dead link, stale claim, dataview health check |
| `/vault:obsidian-markdown` | Obsidian Flavored Markdown referansı |
| `/vault:obsidian-bases` | `.base` dosyaları — dinamik tablo/filter/formula |
| `/vault:defuddle` | Web sayfalarındaki reklam/nav/boilerplate'i temizle |

Kullanım:

```bash
cd demo && altaris vault use demo
> /vault:autoresearch "EU AI Act compliance for Turkish defense industry"
> /vault:save
> /vault:wiki-lint
```

## Dağıtım

| Kanal | İçerik |
|---|---|
| GitHub Releases (`argusteknoloji/altaris-super-agent-releases`) | 5 platform binary + `altaris.vsix` + sürümlü `altaris-X.Y.Z.vsix` + `SHA256SUMS` |
| VS Code Marketplace | `altaris-vscode` uzantısı (manuel dispatch workflow) |
| `web/public/altaris.vsix` | Kapalı kullanıcılar için doğrudan indirme |

VSIX sürüm bump CI'da otomatiktir — lokalde atlamak için `ALTARIS_NO_VERSION_BUMP=1`.
CLI günde bir kez uzantı güncellemesini kontrol eder (`checkExtensionUpdateOnce`).

## Dokümantasyon

- [./docs/PRODUCTION.md](./docs/PRODUCTION.md) — prod deploy, sertifika, backup, VSIX yayını
- [./docs/CODE-SIGNING.md](./docs/CODE-SIGNING.md) — macOS notarization + Windows code signing
- [./docs/APPLE-CERT-PERSONEL-NOTU.md](./docs/APPLE-CERT-PERSONEL-NOTU.md) — Apple geliştirici sertifika notları
- [./vscode-extension/README.md](./vscode-extension/README.md) — uzantı kullanım rehberi
- [./vscode-extension/CHANGELOG.md](./vscode-extension/CHANGELOG.md), [./cli/CHANGELOG.md](./cli/CHANGELOG.md) — sürüm geçmişi

## Lisans

Internal — © 2026 Argus Teknoloji. Tüm hakları saklıdır.
