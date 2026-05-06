# Altaris — Production Deployment

> **Audience:** ops engineer deploying Altaris on a single host (8 vCPU / 16 GB
> RAM minimum) reachable from the public internet, or on-prem in a customer
> datacenter behind a corporate proxy.

## 1. Prerequisites

- Linux host with Docker 25+ and `docker compose` v2
- 3 DNS A records pointing to the host's public IP:
  - `altaris.<your-domain>` — web portal
  - `auth.<your-domain>` — Keycloak SSO
  - `api.<your-domain>` — optional, exposes API for CLI / Desktop
- Open ports 80 + 443 (TCP + UDP for HTTP/3)
- For air-gapped deploys: a TLS bundle in `infra/caddy/certs/` and `Caddyfile` adjustments

## 2. Configure secrets

```bash
cd infra
cp .env.production.example .env.production

# Generate secrets — replace EVERY "replace-me" placeholder:
for var in POSTGRES_PASSWORD KC_DB_PASSWORD KC_ADMIN_PASSWORD \
           KC_ADMIN_SVC_SECRET REDIS_PASSWORD WEB_AUTH_SECRET; do
  printf "%s=%s\n" "$var" "$(openssl rand -base64 32)" >> .env.production
done

# Pin hostnames + Let's Encrypt email
${EDITOR:-nano} .env.production
```

`.env.production` is in `.gitignore` — never commit it.

## 3. Bring the stack up

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
docker compose -f docker-compose.prod.yml ps
```

First boot takes ~3 minutes (Caddy provisions Let's Encrypt certs, Postgres
runs init SQL, Keycloak imports the realm).

## 4. Post-import — assign service-account roles

Keycloak realm import does not support inline service-account role mappings.
Run once per fresh deploy:

```bash
KC_URL="https://${KC_HOSTNAME}" \
KC_ADMIN_USER="${KC_ADMIN_USER}" \
KC_ADMIN_PASS="${KC_ADMIN_PASSWORD}" \
KC_REALM="${KC_REALM}" \
./keycloak/post-import.sh
```

This grants `altaris-admin-svc` the `manage-users / view-users / query-users /
manage-realm / view-realm` roles it needs to drive the admin REST API.

## 5. Verify

```bash
curl https://${WEB_HOSTNAME}/api/health        # → {"status":"ok",...}
curl https://${API_HOSTNAME}/health/live       # → 200
curl https://${API_HOSTNAME}/health/ready      # → 200 once Postgres + Redis are healthy
curl https://${KC_HOSTNAME}/realms/${KC_REALM}/.well-known/openid-configuration
```

Open `https://${WEB_HOSTNAME}` in a browser → "Giriş yap" → Keycloak login →
Argus dashboard.

## 6. Backups

`pg-backup` container dumps `altaris` Postgres daily to
`infra/backups/altaris-YYYYMMDD-HHMMSS.sql.gz`. Default retention 14 days
(override with `BACKUP_RETENTION_DAYS`).

```bash
# Manual restore example (replace TS with a real backup timestamp):
gunzip -c infra/backups/altaris-20260601-030000.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
    psql -U "${POSTGRES_USER}" "${POSTGRES_DB}"
```

Off-host backup target (S3, NFS, etc.) is the operator's responsibility —
sync `infra/backups/` to immutable storage on a separate cron.

## 7. Hardening already applied

| Surface | Hardening |
|---|---|
| API JWT | `RequireHttpsMetadata=true` in Production; raw claim names |
| API rate limit | Token bucket: 200 burst / 100 per 10s per user/IP |
| API logs | Serilog structured JSON to stdout; PII-aware request logger |
| API health | `/health/live` (process), `/health/ready` (deps: pg + redis) |
| API forward headers | XForwardedFor + XForwardedProto trusted from proxy |
| Web headers | HSTS preload, X-Frame-Options DENY, no `X-Powered-By` |
| Web build | Next.js standalone output, runs as non-root in Alpine |
| Postgres | RLS policies on all tenant tables (already enforced) |
| Redis | Password-protected (`requirepass`) |
| Keycloak | Optimized mode (`start --optimized`), strict hostname, `xforwarded` proxy headers |
| Caddy | Auto-TLS, HSTS, HTTP/3, security headers, no Server header |
| Container runtime | Both API + Web run as `altaris` non-root user |

## 8. Updates

```bash
# Pull new images for the pinned ALTARIS_VERSION
docker compose -f docker-compose.prod.yml --env-file .env.production pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Or build locally from the checked-out source
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

DB migrations run automatically via `postgres-init/01-init.sql` on a fresh
volume. For migrating an EXISTING database use EF Core migrations:

```bash
docker compose -f docker-compose.prod.yml exec api dotnet ef database update
```

## 9. Air-gapped notes

- Mirror these images into your registry: `postgres:16-alpine`,
  `quay.io/keycloak/keycloak:26.0`, `redis:7-alpine`, `caddy:2-alpine`,
  `ghcr.io/argusteknoloji/altaris-api`, `ghcr.io/argusteknoloji/altaris-web`
- Replace Caddy auto-TLS with internal-CA bundle in `infra/caddy/certs/`
- Disable `LETSENCRYPT_EMAIL`, set `tls /etc/caddy/certs/fullchain.pem
  /etc/caddy/certs/privkey.pem` for each site block in `Caddyfile`
- Provider config: switch all chat sessions to local LLM endpoints (Ollama,
  LM Studio) via `/admin/providers`

## 10. VS Code uzantısı — Marketplace yayını

`altaris-vscode` uzantısı iki kanaldan dağıtılır:

| Kanal | Hedef | Dosya |
|---|---|---|
| GitHub Releases | Açık kullanıcı + air-gapped müşteri | `altaris.vsix` + `altaris-X.Y.Z.vsix` |
| VS Code Marketplace | Genel müşteri | `vsce publish` (manuel) |
| `web/public/altaris.vsix` | Kapalı portal indirmesi | Release sonrası senkron edilir |

**Marketplace yayın akışı:**

```bash
# 1. PAT oluştur — https://dev.azure.com/<org>/_usersSettings/tokens
#    Scope: Marketplace > Manage
# 2. GitHub repo secrets: VSCE_PAT = <PAT>
# 3. Workflow tetikle (manuel dispatch)
gh workflow run vsce-publish.yml -f version=0.1.0-alpha.X
```

`.github/workflows/vsce-publish.yml` — `workflow_dispatch` ile çalışır,
`vsce package` + `vsce publish` adımlarını sırayla yürütür. Air-gapped müşteriler
için Marketplace yayını ATLANIR; sadece GitHub release + `web/public/altaris.vsix`
dağıtılır.

VSIX sürüm bump CI'da otomatik. Lokal build'de atlamak için:

```bash
ALTARIS_NO_VERSION_BUMP=1 cd vscode-extension && npm run package
```

## 11. Vault sync — production considerations

`VaultEventBroker` şu an **in-memory** pub/sub. Bu, tek pod'lu deploylar için
yeterlidir; yatay ölçeklemede iki uyarı vardır:

- **Multi-pod kayıp event riski:** Pod A'ya `PUT` gelen değişiklik, sadece Pod A
  içindeki SSE consumer'lara broadcast edilir. Pod B'ye bağlı CLI istemcisi event
  almaz.
- **TODO — Redis adapter:** `IVaultEventBroker` arayüzünün Redis pub/sub
  implementasyonu eklenince horizontal scale destekli hale gelecek.

Ara çözüm: prod'da `api` servisini tek replica çalıştırın
(`docker-compose.prod.yml` → `replicas: 1`) veya sticky-session ile vault SSE
endpoint'ini sabit pod'a yönlendirin.

SSE endpoint:

```
GET /api/v1/vaults/{slug}/events     Accept: text/event-stream
```

## 12. CLI uzantı auto-update akışı

CLI başlatıldığında `checkExtensionUpdateOnce` günde bir kez VS Code uzantısı
sürümünü kontrol eder. Yeni sürüm varsa kullanıcıya:

1. CLI status bar'da "Altaris VS Code 0.1.X mevcut" notice
2. `altaris shell-install --with-vscode` ile tek komutla güncelleme
3. Atlamak için `ALTARIS_SKIP_EXT_UPDATE_CHECK=1`

## 13. Tag + release flow

```bash
# 1. CHANGELOG güncelle (cli/, vscode-extension/)
# 2. Tag at — workflow tetiklenir
git tag v0.1.0-alpha.X && git push origin v0.1.0-alpha.X
```

`.github/workflows/release.yml` otomatik üretir:

- 5 platform binary: `altaris-darwin-arm64`, `altaris-darwin-x64`,
  `altaris-linux-x64`, `altaris-linux-arm64`, `altaris-windows-x64.exe`
- `altaris.vsix` (latest pointer) + `altaris-X.Y.Z.vsix` (sürümlü)
- `SHA256SUMS` — tüm asset'lerin checksum'ları
- Release `argusteknoloji/altaris-super-agent-releases` repo'suna push edilir

Marketplace yayını ayrı workflow ile manuel tetiklenir (bkz. §10).
