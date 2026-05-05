# Changelog

Tüm önemli değişiklikler bu dosyada izlenir. Format [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versiyonlama [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-05

İlk kamuya açık sürüm — Argus Altaris VS Code entegrasyonu.

### Added
- **MCP WebSocket köprüsü:** Altaris CLI ile çift yönlü iletişim için yerel WebSocket sunucusu; lockfile tabanlı kimlik doğrulama ve JSON-RPC protokol desteği.
- **MCP araçları:** `openDiff`, `close_tab`, `getDiagnostics`, `getCurrentSelection`, `getOpenEditors` — editör durumunu CLI'a aktaran temel araç seti.
- **`executeCode` aracı:** Jupyter notebook entegrasyonu; aktif notebook'ta hücre çalıştırma ve çıktıyı CLI'a döndürme.
- **Durum çubuğu:** Aktif model · token kullanımı · MCP bağlantı durumu; CLI tarafından gönderilen MCP bildirimleriyle canlı güncellenir.
- **Satır içi düzenleme (Cmd+I):** Seçili kod üzerinde `child_process` ile `altaris` CLI çağrısı; yanıttaki fenced code block otomatik çıkarılıp diff olarak uygulanır.
- **Quick Fix code action:** Diagnostics üzerinde "Fix with Altaris" lightbulb aksiyonu — tek tıkla CLI'dan düzeltme önerisi alma.
- **Code Lens:** Fonksiyon/metot tanımlarının üstünde **Explain** · **Test** · **Refactor** kısayolları.
- **Dosya izleyici (file watcher):** Workspace kayıt olaylarını yakalar ve canlı bağlam push'u olarak CLI'a iletir.
- **Workspace bildirimleri:** Uzun süreli görevler için ilerleme göstergesi, tamamlanma toast'u ve aksiyon butonları.
- **Ayar senkronizasyonu:** Tema, yazı tipi ve locale ayarlarının CLI tarafına otomatik aktarımı.
- **Workspace dosya seçici (Cmd+Shift+2):** `@`-mention yol seçimi için hızlı quick-pick paleti.
- **Inline diff accept/reject:** Önerilen değişiklikleri toast veya CodeLens üzerinden onaylama/reddetme.
- **Terminal profili:** "+" dropdown'da Altaris ikonu ile özel terminal profili.

[Unreleased]: https://github.com/argusteknoloji/altaris-super-agent/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/argusteknoloji/altaris-super-agent/releases/tag/v0.1.0
