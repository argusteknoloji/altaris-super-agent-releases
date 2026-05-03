#!/usr/bin/env bash
#
# Altaris production deploy — 46.101.151.236
# Idempotent: ilk kurulum + sonraki güncellemeler için aynı script.
#
# Kullanım:
#   bash scripts/deploy-prod.sh                      # full deploy
#   bash scripts/deploy-prod.sh --update             # sadece kod + restart
#   bash scripts/deploy-prod.sh --logs               # tail container logs
#   bash scripts/deploy-prod.sh --reseed-provider    # LM Studio Qwen provider'ı yeniden seed et
#
# Şifre yönetimi:
#   SSH şifresi env var'dan okunur. Önceden set et veya prompt'ta gir:
#     export ALTARIS_SSH_PASS='qwq1234.'
#   Provider API key'i:
#     export ALTARIS_LM_API_KEY='sk-lm-...'
#
# Bağımlılıklar (lokal Mac'te):
#   - sshpass        (brew install sshpass --HEAD)
#   - rsync          (system'de var)
#   - openssl        (secret üretimi için, system'de var)

set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════════════
SERVER_IP="46.101.151.236"
SERVER_USER="root"
SERVER_PORT="12222"
REMOTE_DIR="/opt/altaris"

# Domain layout — DNS A records bu IP'ye işaret etmeli
WEB_HOSTNAMES="altarisplatform.com altaris.run"
API_HOSTNAMES="api.altarisplatform.com api.altaris.run"
KC_HOSTNAMES="auth.altarisplatform.com auth.altaris.run"
PRIMARY_WEB="altarisplatform.com"
PRIMARY_KC="auth.altarisplatform.com"
PRIMARY_API="api.altarisplatform.com"

# İlk admin user (Keycloak realm'a seed edilir, ilk login'de şifre değişir)
ADMIN_EMAIL="hburakdemirsoy@gmail.com"
ADMIN_FIRST="Burak"
ADMIN_LAST="Demirsoy"
ADMIN_INITIAL_PASSWORD="Altaris2026!"

# Default LLM provider (Argus LM Studio Qwen) — local config'den
LM_PROVIDER_NAME="Argus LM Studio Qwen3.6 27B"
LM_PROVIDER_KIND="lmstudio"
LM_BASE_URL="https://llm.argusteknoloji.com/v1"
LM_DEFAULT_MODEL="qwen/qwen3.6-27b"

LETSENCRYPT_EMAIL="innovahub@argusteknoloji.com.tr"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ═══════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════
RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; BLUE=$'\033[34m'; DIM=$'\033[2m'; RESET=$'\033[0m'
step() { echo "${BLUE}══ $1${RESET}"; }
info() { echo "  ${DIM}$1${RESET}"; }
ok()   { echo "  ${GREEN}✓ $1${RESET}"; }
warn() { echo "  ${YELLOW}⚠ $1${RESET}"; }
err()  { echo "  ${RED}✗ $1${RESET}"; exit 1; }

# Lokal ön-kontrol
preflight() {
  step "0/9 Lokal ön-kontrol"
  command -v sshpass >/dev/null || err "sshpass kurulu değil. brew install sshpass --HEAD"
  command -v rsync   >/dev/null || err "rsync bulunamadı"
  command -v openssl >/dev/null || err "openssl bulunamadı"
  if [[ -z "${ALTARIS_SSH_PASS:-}" ]]; then
    read -rsp "  SSH şifresi (root@$SERVER_IP:$SERVER_PORT): " ALTARIS_SSH_PASS; echo
    [[ -n "$ALTARIS_SSH_PASS" ]] || err "Şifre boş"
    export ALTARIS_SSH_PASS
  fi
  ok "Bağımlılıklar OK"
}

ssh_remote() { sshpass -e ssh -o StrictHostKeyChecking=accept-new -p "$SERVER_PORT" "$SERVER_USER@$SERVER_IP" "$@"; }
scp_to()     { sshpass -e scp -o StrictHostKeyChecking=accept-new -P "$SERVER_PORT" "$@"; }
rsync_to()   { sshpass -e rsync -avz --delete -e "ssh -o StrictHostKeyChecking=accept-new -p $SERVER_PORT" "$@"; }

# Env vars sshpass için
export SSHPASS="$ALTARIS_SSH_PASS"

# ═══════════════════════════════════════════════════════════════════════════
# STEPS
# ═══════════════════════════════════════════════════════════════════════════
test_ssh() {
  step "1/9 SSH bağlantısını test et"
  if ssh_remote "echo connected as \$(whoami) on \$(hostname)" 2>/dev/null; then
    ok "SSH OK"
  else
    err "SSH başarısız. IP/port/şifre doğru mu? Firewall port $SERVER_PORT açık mı?"
  fi
}

bootstrap_server() {
  step "2/9 Sunucuyu hazırla (Docker, dizinler)"
  ssh_remote bash -s <<'EOF'
set -e
# Docker varsa atla, yoksa kur
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker kuruluyor..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg rsync
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  echo "Docker kuruldu: $(docker --version)"
else
  echo "Docker zaten kurulu: $(docker --version)"
fi

# Firewall (varsa) — 80/443 aç
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
fi

mkdir -p /opt/altaris
EOF
  ok "Sunucu hazır"
}

sync_source() {
  step "3/9 Kaynak kodu rsync ile transfer et"
  # Sadece deploy için gerekenler — node_modules/.git/dist hariç
  rsync_to \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude 'web/.next' \
    --exclude 'cli/dist' \
    --exclude 'cli/node_modules' \
    --exclude 'desktop/node_modules' \
    --exclude 'desktop/src-tauri/target' \
    --exclude 'api/**/bin' \
    --exclude 'api/**/obj' \
    --exclude 'infra/postgres-data' \
    --exclude 'infra/keycloak-db-data' \
    --exclude 'infra/redis-data' \
    --exclude 'infra/backups' \
    --exclude '.DS_Store' \
    "$REPO_ROOT/" "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/"
  ok "Source transfer tamam"
}

generate_env() {
  step "4/9 .env.production üret (yoksa)"
  ssh_remote bash -s <<EOF
set -e
cd $REMOTE_DIR/infra
if [[ -f .env.production ]]; then
  echo "  .env.production zaten var, atlıyor (override için sil)"
  exit 0
fi
gen() { openssl rand -base64 36 | tr -d '/+=' | cut -c1-40; }
KC_ADMIN_PWD=\$(gen)
KC_DB_PWD=\$(gen)
PG_PWD=\$(gen)
REDIS_PWD=\$(gen)
WEB_AUTH_SECRET=\$(openssl rand -base64 64 | tr -d '\n')
ADMIN_SVC_SECRET=\$(gen)
WEB_KC_SECRET=\$(gen)

cat > .env.production <<EOT
# Altaris production secrets — auto-generated $(date -u +%Y-%m-%dT%H:%M:%SZ)
# DO NOT COMMIT. Backup somewhere safe (1Password/vault).

# Postgres
POSTGRES_USER=altaris
POSTGRES_PASSWORD=\$PG_PWD
POSTGRES_DB=altaris

# Keycloak DB
KC_DB_USER=keycloak
KC_DB_PASSWORD=\$KC_DB_PWD
KC_DB_NAME=keycloak

# Keycloak admin (master realm)
KC_ADMIN_USER=admin
KC_ADMIN_PASSWORD=\$KC_ADMIN_PWD
KC_REALM=altaris
KC_ADMIN_SVC_SECRET=\$ADMIN_SVC_SECRET

# Redis
REDIS_PASSWORD=\$REDIS_PWD

# Web (NextAuth)
WEB_AUTH_SECRET=\$WEB_AUTH_SECRET
WEB_KEYCLOAK_SECRET=\$WEB_KC_SECRET

# Hostnames — Caddy multi-host (boşlukla ayrılmış)
WEB_HOSTNAMES=$WEB_HOSTNAMES
KC_HOSTNAMES=$KC_HOSTNAMES
API_HOSTNAMES=$API_HOSTNAMES
# Single-host gerektiren servisler (Keycloak issuer, NEXTAUTH_URL, CORS) için primary
PRIMARY_WEB_HOSTNAME=$PRIMARY_WEB
PRIMARY_KC_HOSTNAME=$PRIMARY_KC
PRIMARY_API_HOSTNAME=$PRIMARY_API
WEB_HOSTNAME_2=altaris.run
LETSENCRYPT_EMAIL=$LETSENCRYPT_EMAIL

# Image tag (CI/CD push'ladığında bu artar)
ALTARIS_VERSION=latest
EOT
chmod 600 .env.production
echo "  .env.production üretildi"
echo "  ⚠ Keycloak master admin şifresi: \$KC_ADMIN_PWD"
echo "  ⚠ Bu şifreyi 1Password'a kaydet — bir daha gösterilmez."
EOF
  ok ".env.production hazır"
}

render_realm() {
  step "5/9 Keycloak realm'ı production hostname'leriyle render et"
  ssh_remote bash -s <<EOF
set -e
cd $REMOTE_DIR/infra/keycloak/realms
# Orijinal realm dosyasını dokunmadan, prod kopyasını üret:
# - localhost URL → production hostname
# - dev seed user şifresi (altaris_dev) password policy'ye uymuyor (uppercase yok),
#   prod kabul edilir bir başlangıç şifresine çevir
sed -e "s|http://localhost:8081|https://$PRIMARY_KC|g" \\
    -e "s|http://localhost:3000|https://$PRIMARY_WEB|g" \\
    -e 's|"value": "altaris_dev"|"value": "$ADMIN_INITIAL_PASSWORD"|g' \\
    altaris-realm.json > altaris-realm.prod.json
# Keycloak --import-realm flag'i bu dizindeki tüm *.json dosyalarını import eder.
# Orijinal localhost realm'ını import etmesini önle:
mv altaris-realm.json altaris-realm.dev.json.disabled 2>/dev/null || true
echo "  altaris-realm.prod.json render edildi"
EOF
  ok "Realm prod hostname'leriyle hazır"
}

build_and_up() {
  step "6/9 Build + start (docker compose)"
  ssh_remote bash -s <<EOF
set -e
cd $REMOTE_DIR/infra
docker compose -f docker-compose.prod.yml --env-file .env.production pull 2>/dev/null || true
docker compose -f docker-compose.prod.yml --env-file .env.production build --pull 2>&1 | tail -20
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --remove-orphans
echo ""
docker compose -f docker-compose.prod.yml --env-file .env.production ps
EOF
  ok "Container'lar ayakta"
}

wait_keycloak() {
  step "7/9 Keycloak hazır olana kadar bekle (~60sn)"
  for i in {1..30}; do
    if ssh_remote "curl -sf https://$PRIMARY_KC/health/ready >/dev/null 2>&1"; then
      ok "Keycloak ready"
      return
    fi
    info "  bekleniyor… ($i/30)"
    sleep 5
  done
  warn "Keycloak readiness timeout — container loglarına bak: bash $0 --logs"
}

seed_admin_user() {
  step "8/9 Burak admin user'ını Keycloak'a seed et"
  ssh_remote bash -s <<EOF
set -e
cd $REMOTE_DIR/infra
source <(grep -E '^(KC_ADMIN_USER|KC_ADMIN_PASSWORD|KC_REALM)=' .env.production | sed 's/^/export /')

# Master realm'a admin login
TOKEN=\$(docker compose -f docker-compose.prod.yml exec -T keycloak \\
  /opt/keycloak/bin/kcadm.sh config credentials \\
  --server http://localhost:8080 \\
  --realm master \\
  --user "\$KC_ADMIN_USER" --password "\$KC_ADMIN_PASSWORD" 2>&1 | tail -1)

# User var mı kontrol
EXISTS=\$(docker compose -f docker-compose.prod.yml exec -T keycloak \\
  /opt/keycloak/bin/kcadm.sh get users -r "\$KC_REALM" -q "email=$ADMIN_EMAIL" --fields id 2>/dev/null | grep -c '"id"' || echo 0)

if [[ "\$EXISTS" -gt 0 ]]; then
  echo "  Admin user zaten var: $ADMIN_EMAIL"
else
  docker compose -f docker-compose.prod.yml exec -T keycloak \\
    /opt/keycloak/bin/kcadm.sh create users -r "\$KC_REALM" \\
    -s username=$ADMIN_EMAIL -s email=$ADMIN_EMAIL \\
    -s firstName=$ADMIN_FIRST -s lastName=$ADMIN_LAST \\
    -s enabled=true -s emailVerified=true \\
    -s 'attributes.tenant_slug=["argus"]'

  USER_ID=\$(docker compose -f docker-compose.prod.yml exec -T keycloak \\
    /opt/keycloak/bin/kcadm.sh get users -r "\$KC_REALM" -q "email=$ADMIN_EMAIL" --fields id 2>/dev/null \\
    | grep '"id"' | head -1 | sed 's/.*: "\\([^"]*\\)".*/\\1/')

  # Geçici şifre + ilk login'de değiştirme zorunluluğu
  docker compose -f docker-compose.prod.yml exec -T keycloak \\
    /opt/keycloak/bin/kcadm.sh set-password -r "\$KC_REALM" \\
    --userid "\$USER_ID" --new-password "$ADMIN_INITIAL_PASSWORD" --temporary

  # platform_admin + tenant_admin rollerini ata
  docker compose -f docker-compose.prod.yml exec -T keycloak \\
    /opt/keycloak/bin/kcadm.sh add-roles -r "\$KC_REALM" \\
    --uusername $ADMIN_EMAIL \\
    --rolename platform_admin --rolename tenant_admin || echo "  (roles already assigned)"

  echo "  ✓ Burak admin user yaratıldı (ilk login'de şifre değişimi zorunlu)"
fi
EOF
  ok "Admin user hazır"
}

seed_db() {
  step "9/9 Postgres'e tenant + user mirror + LM Studio Qwen provider seed et"
  local lm_key="${ALTARIS_LM_API_KEY:-}"
  if [[ -z "$lm_key" ]]; then
    warn "ALTARIS_LM_API_KEY env yok — provider seed atlanıyor (sonra UI'dan ekle)"
    return
  fi
  ssh_remote bash -s <<EOF
set -e
cd $REMOTE_DIR/infra
source <(grep -E '^(POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_DB)=' .env.production | sed 's/^/export /')

# Argus tenant — INSERT IF NOT EXISTS
docker compose -f docker-compose.prod.yml exec -T postgres \\
  psql -U "\$POSTGRES_USER" -d "\$POSTGRES_DB" <<SQL
INSERT INTO tenants (slug, name, keycloak_realm)
VALUES ('argus', 'Argus Teknoloji', 'altaris')
ON CONFLICT (slug) DO NOTHING;

-- Burak user mirror (Keycloak Sub'ı sonra ilk login'de eşleşir; placeholder ile başla)
INSERT INTO users (id, tenant_id, keycloak_sub, email, display_name, role, created_at)
SELECT gen_random_uuid(), t.id, '00000000-0000-0000-0000-000000000000',
       '$ADMIN_EMAIL', '$ADMIN_FIRST $ADMIN_LAST', 'platform_admin', now()
FROM tenants t WHERE t.slug='argus'
ON CONFLICT (email) DO UPDATE SET role='platform_admin';

-- Default LLM provider (LM Studio Qwen)
INSERT INTO provider_configs (id, tenant_id, provider, name, base_url, default_model, api_key_enc, is_default, enabled, created_at, updated_at)
SELECT gen_random_uuid(), t.id, '$LM_PROVIDER_KIND', '$LM_PROVIDER_NAME',
       '$LM_BASE_URL', '$LM_DEFAULT_MODEL', '$lm_key', true, true, now(), now()
FROM tenants t WHERE t.slug='argus'
ON CONFLICT DO NOTHING;
SQL
echo "  ✓ DB seed tamam"
EOF
  ok "Tenant + admin user mirror + provider seed edildi"
}

health_check() {
  step "✓ Health check"
  echo ""
  echo "  Web:      https://$PRIMARY_WEB"
  echo "  API:      https://$PRIMARY_API/health/live"
  echo "  Keycloak: https://$PRIMARY_KC"
  echo ""
  for url in "https://$PRIMARY_WEB" "https://$PRIMARY_API/health/live" "https://$PRIMARY_KC"; do
    code=$(ssh_remote "curl -sk -o /dev/null -w '%{http_code}' $url" 2>/dev/null || echo "ERR")
    if [[ "$code" =~ ^(200|301|302|303)$ ]]; then
      ok "$url → HTTP $code"
    else
      warn "$url → HTTP $code (Let's Encrypt cert provision için 1-2 dk bekle, sonra tarayıcıdan dene)"
    fi
  done
  echo ""
  echo "${GREEN}═══════════════════════════════════════════════════════════════${RESET}"
  echo "${GREEN}  DEPLOY TAMAM${RESET}"
  echo "${GREEN}═══════════════════════════════════════════════════════════════${RESET}"
  echo ""
  echo "  → ${BLUE}https://$PRIMARY_WEB${RESET} adresinden giriş yap:"
  echo "    Email: ${YELLOW}$ADMIN_EMAIL${RESET}"
  echo "    Şifre: ${YELLOW}$ADMIN_INITIAL_PASSWORD${RESET} (ilk login'de değiştir)"
  echo ""
  echo "  → Keycloak master admin: ${BLUE}https://$PRIMARY_KC/admin${RESET}"
  echo "    Şifreyi sunucuda gör: ${DIM}ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP 'grep KC_ADMIN_PASSWORD $REMOTE_DIR/infra/.env.production'${RESET}"
  echo ""
  echo "  Logları izle:  ${DIM}bash $0 --logs${RESET}"
  echo "  Sadece güncelle: ${DIM}bash $0 --update${RESET}"
}

# ═══════════════════════════════════════════════════════════════════════════
# COMMAND DISPATCH
# ═══════════════════════════════════════════════════════════════════════════
# Sunucuda build yapmadan ghcr.io'dan pre-built image'ları çek + restart.
# Bu mod GitHub Actions build-images.yml workflow'u çalıştıktan sonra kullanılır:
#   .github/workflows/build-images.yml main push'da web + api image'larını
#   ghcr.io'ya push eder, --pull burada onları indirip atomic swap yapar.
# Avantaj: 2 GB droplet'a build yükü binmez, deploy 30 sn (5 dk yerine).
pull_and_up() {
  step "→ ghcr.io'dan latest image'ları çek + atomic restart"
  ssh_remote bash -s <<'EOF'
set -e
cd /opt/altaris/infra
# ghcr.io'ya login (GitHub Actions push'lar için ghcr token GITHUB_TOKEN scope=packages:write
# ile çalışır; sunucu pull için sadece public veya kendi PAT'i ile login).
# Public package ise login gerek yok; private ise GHCR_PULL_TOKEN env'i set edilmiş olmalı.
if [[ -n "${GHCR_PULL_TOKEN:-}" ]]; then
  echo "$GHCR_PULL_TOKEN" | docker login ghcr.io -u argusteknoloji --password-stdin >/dev/null
fi
docker compose -f docker-compose.prod.yml --env-file .env.production pull web api 2>&1 | tail -10
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --no-build web api 2>&1 | tail -5
echo "—"
docker compose -f docker-compose.prod.yml --env-file .env.production ps web api
EOF
  ok "Pull + restart tamam"
}

case "${1:-}" in
  --logs)
    preflight
    ssh_remote "cd $REMOTE_DIR/infra && docker compose -f docker-compose.prod.yml logs -f --tail=100"
    ;;
  --update)
    # Eski mod: source rsync + sunucuda build (RAM ağır). Yeni deploy'larda --pull tercih et.
    preflight; test_ssh; sync_source; build_and_up; health_check
    ;;
  --pull)
    # Yeni mod: GitHub Actions image'larını ghcr.io'dan pull + restart (build yok).
    preflight; test_ssh; pull_and_up; health_check
    ;;
  --reseed-provider)
    preflight; test_ssh; seed_db
    ;;
  --status)
    preflight
    ssh_remote "cd $REMOTE_DIR/infra && docker compose -f docker-compose.prod.yml ps"
    ;;
  ""|--full)
    preflight
    test_ssh
    bootstrap_server
    sync_source
    generate_env
    render_realm
    build_and_up
    wait_keycloak
    seed_admin_user
    seed_db
    health_check
    ;;
  *)
    echo "Usage: $0 [--full|--update|--pull|--logs|--status|--reseed-provider]"
    exit 1
    ;;
esac
