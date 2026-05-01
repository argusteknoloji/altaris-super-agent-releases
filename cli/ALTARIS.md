# Altaris CLI

`altaris` — Argus Teknoloji'nin kurumsal agentic AI terminali. Argus multi-tenant API'sine, Keycloak SSO'ya ve Argus'un yönettiği lokal LLM provider'larına bağlanır.

## Build

```bash
bun install
bun run build
./bin/altaris --version
```

Single-binary release:

```bash
bun build --compile --target=bun-darwin-arm64 ./dist/cli.mjs --outfile release/altaris-darwin-arm64
bun build --compile --target=bun-linux-x64 ./dist/cli.mjs --outfile release/altaris-linux-x64
bun build --compile --target=bun-windows-x64 ./dist/cli.mjs --outfile release/altaris-windows-x64.exe
```

## Komutlar (Argus genişletmeleri — `src/argus/` altında)

| Komut | Amaç |
|---|---|
| `altaris login` | Keycloak Device Authorization Flow, token'ı OS keychain'e yazar |
| `altaris logout` | Keychain token siler, Keycloak session sonlandırır |
| `altaris whoami` | Aktif kullanıcı + tenant bilgisi |
| `altaris session list` | Argus API'sinden geçmiş session'ları çeker |
| `altaris session push <id>` | Lokal session'ı API'ye senkronize eder (web portalda görünür) |

## Provider Defaults

`altaris` ilk başta lokal LLM önerir:
- LM Studio (`https://llm.argusteknoloji.com/v1` veya `http://localhost:1234/v1`)
- Ollama (`http://localhost:11434`)
- Bulut model provider (Anthropic / OpenAI uyumlu — bulut isteyen müşteriler için)

