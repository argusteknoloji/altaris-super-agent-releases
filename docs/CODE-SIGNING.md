# Altaris Desktop — Code Signing Setup

Desktop App'i kullanıcının makinesinde "tanınmayan geliştirici" uyarısı vermeden
açtırmak için 3 platform için de kod imzalama gerekir. Pipeline (`desktop-release.yml`)
ilgili sırlar **eksikse** sessizce atlar — yani başlangıçta unsigned binary üretir,
sırlar GitHub repo Settings → Secrets'a eklendiğinde otomatik aktif olur.

## Required GitHub Secrets

| Secret | Platform | Açıklama |
|---|---|---|
| `APPLE_CERTIFICATE` | macOS | Developer ID Application sertifikasının base64 p12 içeriği |
| `APPLE_CERTIFICATE_PASSWORD` | macOS | p12 export sırasında belirlediğin şifre |
| `APPLE_KEYCHAIN_PASSWORD` | macOS | CI runner'da kurulan geçici keychain için herhangi bir şifre |
| `APPLE_ID` | macOS | Apple ID e-posta (notarization için) |
| `APPLE_APP_PASSWORD` | macOS | App-specific password (appleid.apple.com → Sign-in & Security) |
| `APPLE_TEAM_ID` | macOS | 10 karakter Team ID (Apple Developer dashboard) |
| `WINDOWS_CERTIFICATE` | Windows | Authenticode pfx sertifikasının base64 içeriği |
| `WINDOWS_CERTIFICATE_PASSWORD` | Windows | pfx şifresi |
| `LINUX_GPG_PRIVATE_KEY` | Linux | `gpg --armor --export-secret-keys <key-id>` çıktısı |
| `LINUX_GPG_PASSPHRASE` | Linux | GPG anahtar şifresi |
| `LINUX_GPG_KEY_ID` | Linux | `gpg --list-secret-keys --keyid-format=long` ile öğrenilen ID |
| `TAURI_UPDATER_PRIVATE_KEY` | All | Tauri updater için imza özel anahtarı |
| `TAURI_UPDATER_KEY_PASSWORD` | All | Updater anahtar şifresi |
| `RELEASES_REPO_TOKEN` | — | (Mevcut) Public release repo'ya yazma yetkisi olan PAT |

## 1. macOS — Apple Developer ID + Notarization

**Maliyet:** Apple Developer Program $99/yıl.

1. https://developer.apple.com → Membership ile katıl, Team ID'yi not al.
2. Keychain Access → **Certificate Assistant → Request a Certificate from a CA** ile CSR üret, save to disk.
3. Apple Developer → Certificates → **+ Developer ID Application** seç, CSR'ı yükle, `.cer` indir, çift tıklayıp keychain'e ekle.
4. Keychain Access → My Certificates → "Developer ID Application: Argus Teknoloji" sertifikasını private key ile birlikte sağ tık → **Export** → `cert.p12` (şifre belirle).
5. base64 encode: `base64 -i cert.p12 | pbcopy` → GitHub Secret `APPLE_CERTIFICATE` olarak yapıştır.
6. App-specific password üret: https://appleid.apple.com → Sign-in & Security → App-Specific Passwords → "Altaris CI" → değer = `APPLE_APP_PASSWORD`.

Pipeline `notarytool` ile dmg'yi otomatik notarize + staple eder. Kullanıcı çift tıkladığında hiçbir uyarı görmez.

## 2. Windows — Authenticode

**Maliyet:** Standard OV Code Signing ~$200/yıl (Sectigo, DigiCert, SSL.com). EV Code Signing $300+/yıl ve "Unknown Publisher" SmartScreen warning'ini anında kaldırır (OV warning ~3000 install sonrası kaybolur).

1. CA'dan (Sectigo, DigiCert, SSL.com) Code Signing sertifikası al. OV → email validation, EV → USB token.
2. OV ise: vendor portal'dan `.pfx` indir. EV ise: token üzerinden export edilemez, alternatif olarak [`AzureSignTool`](https://github.com/vcsjones/AzureSignTool) + Azure Key Vault HSM kullan.
3. base64 encode: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.pfx")) | clip` → `WINDOWS_CERTIFICATE`.

Pipeline `signtool /tr http://timestamp.digicert.com /td sha256 /fd sha256` ile NSIS `*-setup.exe` dosyasını imzalar + zaman damgası ekler (sertifika expire olduktan sonra bile geçerli kalır).

## 3. Linux — GPG Detached Signature

**Maliyet:** Sıfır. Linux ekosistemi GPG kullanır.

```bash
# Key üret (RSA 4096, 5 yıl):
gpg --full-generate-key
#   → kind: RSA and RSA
#   → size: 4096
#   → expire: 5y
#   → name: Argus Teknoloji
#   → email: innovahub@argusteknoloji.com.tr
#   → passphrase: (güçlü)

# Key ID'yi öğren:
gpg --list-secret-keys --keyid-format=long
# /Users/.../  rsa4096/ABCD1234EFGH5678 2026-05-02 [SC] [expires: 2031-05-01]

# Public key'i public release repo'ya README'ye veya releases sayfasına yapıştır:
gpg --armor --export ABCD1234EFGH5678 > altaris-public-key.asc

# Private key (CI için):
gpg --armor --export-secret-keys ABCD1234EFGH5678 | pbcopy
# → APPLE_GPG_PRIVATE_KEY secret olarak yapıştır
```

Kullanıcı `.AppImage` veya `.deb` indirdiğinde:

```bash
gpg --import altaris-public-key.asc
gpg --verify altaris-desktop-linux-x64.AppImage.asc altaris-desktop-linux-x64.AppImage
# → Good signature from "Argus Teknoloji <…>"
```

## 4. Tauri Updater Key (otomatik güncelleme imzası)

Auto-update mekanizması her yeni binary'nin Argus tarafından üretildiğini doğrular
— MITM saldırısına karşı zorunlu.

```bash
# Local makinede (bir kez):
cd desktop
pnpm tauri signer generate -w ~/.tauri/altaris-updater.key
# → password sorar (güçlü gir, sakla)
# → ~/.tauri/altaris-updater.key (private)
# → ~/.tauri/altaris-updater.key.pub (public)

# Public key'i tauri.conf.json'a yapıştır:
cat ~/.tauri/altaris-updater.key.pub
# → tauri.conf.json → plugins.updater.pubkey

# Private key'i GitHub secret olarak ekle:
cat ~/.tauri/altaris-updater.key | base64 | pbcopy
# → TAURI_UPDATER_PRIVATE_KEY
# Şifreyi de:
# → TAURI_UPDATER_KEY_PASSWORD
```

Pipeline build sırasında her platform binary'sinin yanına `.sig` üretir; publish
job'u `latest.json` manifest'ine bu imzaları gömer. Desktop App güncellemeyi
indirip bu pubkey ile doğrular.

## Sırlar Eksikken Pipeline Davranışı

Workflow `if: env.X != ''` koşullarıyla yazıldı:

| Secret eksik | Davranış |
|---|---|
| `APPLE_CERTIFICATE` | macOS dmg unsigned çıkar, Gatekeeper "Cannot verify" uyarısı verir, kullanıcı sağ tık → Open ile açar |
| `WINDOWS_CERTIFICATE` | NSIS setup unsigned, SmartScreen "Unknown publisher" uyarısı verir |
| `LINUX_GPG_PRIVATE_KEY` | `.asc` üretilmez, kullanıcı GPG doğrulama yapamaz (binary çalışır ama integrity garanti yok) |
| `TAURI_UPDATER_PRIVATE_KEY` | `.sig` üretilmez, `latest.json`'da signature alanı boş, auto-update başarısız olur (manuel indirme çalışır) |

İlk release tag'inde tüm sırlar boş olabilir — pipeline yine de yeşil olur ve
kullanıcı manuel "Right Click → Open" ile uygulamayı açabilir.

## Toplam Maliyet (yıllık)

| Platform | Min | Önerilen |
|---|---|---|
| macOS Apple Developer | $99 | $99 |
| Windows OV Code Signing | $200 | $300 (EV) |
| Linux GPG | $0 | $0 |
| **Toplam** | **~$300** | **~$400** |
