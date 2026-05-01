# Altaris Platform

**Argus Teknoloji** — Kurumsal Agentic AI Terminali + Multi-Tenant Web Portalı

> Veri güvenliği hassasiyeti olan kurumlar için lokal/on-prem deploy edilebilir agent platformu. Bulut isteyen müşteriler için Claude API doğrudan kullanılır; kamu/savunma/finans kurumları için Altaris lokal LLM'lere bağlanan kendi terminalimizdir.

## Bileşenler

| Klasör | Bileşen | Stack |
|---|---|---|
| `cli/` | `altaris` terminal binary'si | TypeScript + Bun (single-binary compile) |
| `web/` | Web portal + chat + remote terminal viewer | Next.js 16 (App Router) + xterm.js |
| `api/` | Multi-tenant backend API | .NET 9 modular monolith + EF Core + PostgreSQL |
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
| **SaaS Multi-Tenant** | KOBİ + AI consulting müşterileri | Argus hosted, Claude API + opsiyonel lokal LLM |

## Hukuki Not

`cli/` dizini Anthropic Claude Code'dan türetilmiş [openclaude](https://github.com/Gitlawb/openclaude) reposunu temel alır. Bu bağımlılığın IP risk profili `docs/legal/derivation-risk.md` içinde dokümante edilmiştir. Kamu kurumlarına ticari satış öncesi hukuki review **zorunlu**.

## Lisans

Internal — © 2026 Argus Teknoloji. Tüm hakları saklıdır.
