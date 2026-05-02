#!/usr/bin/env bash
#
# Altaris Desktop — Apple Developer ID Application sertifikası ve GitHub
# secrets'larını otomatik üretir. Apple Developer üyesi personel tarafından
# kendi Mac'inde çalıştırılır. Hiçbir şey buluta gitmez; çıktı yerel
# /tmp/altaris-apple-cert/SECRETS-TO-PASTE.txt dosyasında bırakılır.
#
# Kullanım:
#   bash generate-apple-cert.sh
#
# Gereksinimler:
#   - macOS (Linux/Windows üzerinde çalışmaz — security & keychain Apple'a özel)
#   - Apple Developer Program aktif üyelik (Account Holder veya Admin rolü)
#   - Internet bağlantısı

set -euo pipefail

# ─── 0) Platform check ──────────────────────────────────────────────────────
if [[ "$(uname)" != "Darwin" ]]; then
  echo "❌ Bu script yalnız macOS'ta çalışır." >&2
  exit 1
fi

WORK="${HOME}/Desktop/altaris-apple-cert-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$WORK"
cd "$WORK"

echo "═══════════════════════════════════════════════════════════════"
echo "  Altaris — Apple Developer ID sertifika üretimi"
echo "  Çalışma dizini: $WORK"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ─── 1) fastlane kurulumu ────────────────────────────────────────────────────
if ! command -v fastlane >/dev/null 2>&1; then
  echo "→ fastlane kurulu değil, kuruluyor (sudo şifresi sorulabilir)…"
  if command -v brew >/dev/null 2>&1; then
    brew install fastlane
  else
    sudo gem install fastlane -NV
  fi
fi
echo "✓ fastlane $(fastlane --version | head -1 | awk '{print $2}') hazır"
echo ""

# ─── 2) Kullanıcı girdileri ──────────────────────────────────────────────────
echo "Apple Developer hesap bilgileri (lokal kullanılır, hiçbir yere gönderilmez):"
read -rp "  Apple ID e-postası: " APPLE_ID
read -rsp "  App-specific password (https://account.apple.com → App-Specific Passwords ile üret, biçim: xxxx-xxxx-xxxx-xxxx): " APP_PWD; echo
read -rp "  Apple Team ID (10 karakter, https://developer.apple.com/account üst sağ): " TEAM_ID

if [[ ! "$TEAM_ID" =~ ^[A-Z0-9]{10}$ ]]; then
  echo "❌ Team ID 10 karakter olmalı (büyük harf + rakam)." >&2
  exit 1
fi

# ─── 3) Random şifre üret (.p12 + keychain için) ─────────────────────────────
P12_PASS="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
KC_PASS="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"

# ─── 4) fastlane cert ile Developer ID Application sertifikası üret ─────────
echo ""
echo "→ Apple'dan Developer ID Application sertifikası talep ediliyor…"
echo "  (Apple ilk kez 2FA kodu sorabilir; cihazına/SMS'ine gelen 6 hane gir)"
echo ""

export FASTLANE_USER="$APPLE_ID"
export FASTLANE_PASSWORD="$APP_PWD"
export FASTLANE_TEAM_ID="$TEAM_ID"
export FASTLANE_DISABLE_COLORS=1
# fastlane bazen interaktif mod ister; force-yes:
export FASTLANE_HIDE_CHANGELOG=1

fastlane cert \
  --type developer_id_application \
  --team_id "$TEAM_ID" \
  --output_path "$WORK" \
  --keychain_path "$HOME/Library/Keychains/login.keychain-db" \
  --skip_set_partition_list false

# ─── 5) Yeni kurulan identity'yi bul ──────────────────────────────────────────
echo ""
echo "→ Sertifika keychain'e kuruldu, identity tespit ediliyor…"
IDENTITY=$(security find-identity -v -p codesigning login.keychain-db \
  | grep "Developer ID Application" | tail -1 | sed -E 's/.*"(.+)".*/\1/')

if [[ -z "$IDENTITY" ]]; then
  echo "❌ Identity bulunamadı. fastlane çıktısını kontrol et." >&2
  exit 1
fi
echo "✓ Identity: $IDENTITY"

# ─── 6) .p12 export ──────────────────────────────────────────────────────────
P12_PATH="$WORK/Argus-DeveloperID.p12"
echo ""
echo "→ .p12 export ediliyor…"
security export \
  -k "$HOME/Library/Keychains/login.keychain-db" \
  -t identities \
  -f pkcs12 \
  -P "$P12_PASS" \
  -o "$P12_PATH"

if [[ ! -s "$P12_PATH" ]]; then
  echo "❌ .p12 export başarısız." >&2
  exit 1
fi
echo "✓ $P12_PATH ($(stat -f%z "$P12_PATH") bytes)"

# ─── 7) base64'e çevir + SECRETS dosyası üret ────────────────────────────────
APPLE_CERT_B64=$(base64 -i "$P12_PATH" | tr -d '\n')

SECRETS="$WORK/SECRETS-TO-PASTE.txt"
cat > "$SECRETS" <<EOF
═══════════════════════════════════════════════════════════════════════════
Altaris Desktop — GitHub Secrets'a yapıştırılacak değerler

URL: https://github.com/argusteknoloji/altaris-super-agent/settings/secrets/actions
"New repository secret" → Name + Value yapıştır → Add secret
═══════════════════════════════════════════════════════════════════════════

────────────────────────────────────────────────────────────────────────
Secret name:  APPLE_CERTIFICATE
────────────────────────────────────────────────────────────────────────
$APPLE_CERT_B64

────────────────────────────────────────────────────────────────────────
Secret name:  APPLE_CERTIFICATE_PASSWORD
────────────────────────────────────────────────────────────────────────
$P12_PASS

────────────────────────────────────────────────────────────────────────
Secret name:  APPLE_KEYCHAIN_PASSWORD
────────────────────────────────────────────────────────────────────────
$KC_PASS

────────────────────────────────────────────────────────────────────────
Secret name:  APPLE_ID
────────────────────────────────────────────────────────────────────────
$APPLE_ID

────────────────────────────────────────────────────────────────────────
Secret name:  APPLE_APP_PASSWORD
────────────────────────────────────────────────────────────────────────
$APP_PWD

────────────────────────────────────────────────────────────────────────
Secret name:  APPLE_TEAM_ID
────────────────────────────────────────────────────────────────────────
$TEAM_ID

═══════════════════════════════════════════════════════════════════════════
Bu dosyayı 6 secret'ı yapıştırdıktan sonra GÜVENLİ ŞEKİLDE SİL:
  shred -u "$SECRETS"
veya:
  rm -P "$SECRETS"
.p12 dosyası ($P12_PATH) yedek olarak 1Password'a koyulabilir, sonra sil.
═══════════════════════════════════════════════════════════════════════════
EOF

# ─── 8) Bitir ────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ TAMAMLANDI"
echo ""
echo "Sıradaki adım:"
echo "  1) $SECRETS dosyasını aç"
echo "  2) İçindeki 6 secret'ı GitHub repo'ya yapıştır"
echo "  3) Yapıştırma bittiğinde dosyayı güvenli sil:"
echo "       rm -P \"$SECRETS\""
echo ""
echo "Finder'da gösteriyorum…"
open -R "$SECRETS"
