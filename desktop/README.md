# Altaris Desktop App

**Tauri 2.x** tabanlı macOS + Windows native uygulaması. Terminale adapte olamayan kullanıcılar için chat + code yetenekleri.

## Neden Tauri?

| | Tauri 2 | Electron |
|---|---|---|
| Binary boyutu | ~10 MB | ~150 MB |
| Bellek | ~80 MB | ~250 MB |
| Native (macOS/Windows) | ✓ | webview |
| On-prem dağıtım | ideal | büyük |
| Auto-update | ✓ built-in | ekstra |
| Code signing | ✓ macOS+Windows | ✓ |

Kamu kurumlarına air-gapped USB ile götürme senaryosu için Tauri'nin küçük binary boyutu kritik.

## Mimari

```
┌──────────────────┐
│   Tauri Shell    │  ← Rust core (auto-update, file system, keychain)
│   (macOS/Win)    │
│ ┌──────────────┐ │
│ │  React UI    │ │  ← Vite + React 19 + Tailwind
│ │  (WebView)   │ │
│ └──────┬───────┘ │
└────────┼─────────┘
         │ Tauri invoke + HTTPS
         ▼
   Altaris API (.NET 9)
   Keycloak (OIDC Device Flow)
   Lokal LLM (Ollama / LM Studio / vllm-mlx)
```

## Özellikler (v1.0 hedefi)

1. **Chat** — `web/` portalı ile aynı UI; Anthropic, Ollama, LM Studio provider seçimi
2. **Code** — built-in code editor (Monaco), workspace açma, agent ile düzenleme
3. **Terminal** — entegre xterm.js (lokal shell + remote PTY)
4. **Login** — OS-native OAuth Device Flow window
5. **Keychain** — token macOS Keychain / Windows Credential Manager
6. **Auto-update** — Tauri updater
7. **Offline** — lokal LLM tespiti, fallback önerisi
8. **Multi-tenant** — birden fazla Argus tenant'ına aynı anda bağlanabilme

## Kurulum (dev)

```bash
# Tauri CLI (Rust)
cargo install tauri-cli@^2.0

# Frontend deps
cd desktop && pnpm install

# Dev mode (hot reload)
pnpm tauri dev

# Production build
pnpm tauri build --target universal-apple-darwin   # macOS Universal (M1+Intel)
pnpm tauri build --target x86_64-pc-windows-msvc   # Windows x64
```

## Sprint Yol Haritası

| Sprint | İçerik |
|---|---|
| S1 (1 hafta) | Tauri scaffold, login + dashboard ekranı (web portaldan port) |
| S2 (1 hafta) | Chat ekranı (SSE consumer) + provider/model picker |
| S3 (2 hafta) | Code editor (Monaco), workspace açma, file tree |
| S4 (1 hafta) | Entegre terminal (xterm.js + lokal/remote toggle) |
| S5 (1 hafta) | Keychain entegrasyonu + auto-update + code signing |
| S6 (1 hafta) | Beta release, müşteri pilotuna teslim |

**Toplam: ~7 hafta** (1 dev), paralelize edilebilir.

## Code Signing

- **macOS:** Apple Developer ID (Argus Teknoloji ekibi). Notarization zorunlu (Gatekeeper).
- **Windows:** Code Signing Cert (DigiCert / Sectigo, ~$300/yıl). EV cert tercih edilir (SmartScreen reputation).
