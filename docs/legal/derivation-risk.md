# IP Türetim Riski — Altaris CLI

**Durum:** açık · sahibi: [[Burak Demirsoy]] · son güncelleme: 2026-05-01

## Özet

`cli/` dizini [openclaude](https://github.com/Gitlawb/openclaude) reposundan türetilmiştir. openclaude'un `LICENSE/NOTICE` dosyası açıkça şunu belirtir:

> "This repository contains code derived from Anthropic's Claude Code CLI. The original Claude Code source is proprietary software… This project does not have Anthropic's authorization to distribute their proprietary source. Users and contributors should evaluate their own legal position."

## Risk profili

| Senaryo | Risk seviyesi | Etki |
|---|---|---|
| Argus internal kullanım | düşük | Argus geliştirme ekibi kendi dev araçları olarak kullanır |
| Müşteri demo / pilot | orta | Lisans atfı yapılırsa savunulabilir; Anthropic uyarı/cease-desist gönderebilir |
| Ticari kamu satışı | **yüksek** | KİK ihalelerinde IP beyanı zorunlu; tedarikçi yasak listesine düşme + sözleşme iptali riski |
| Kapalı kaynak SaaS | **yüksek** | Anthropic ToS ihlali iddiası → DMCA / dava |

## Aksiyonlar (gerekli, sırayla)

1. **Hukuki review** — Argus iç hukuk + dış IP avukatı görüşü. Önce Beşinci sürüm (5.0+) dağıtımdan önce.
2. **Bağımsız ajan loop'u** — orta vadede `cli/src/QueryEngine.ts`, `Tool.ts`, `assistant/` modüllerini sıfırdan yazıp openclaude bağımlılığını sıfırlama. Tahmini efor: 6-9 hafta.
3. **NOTICE / atıf** — sözleşmelerde Argus, Altaris CLI'nin "openclaude tabanlı topluluk türevi" olduğunu belirtir; müşteri kendi hukuki pozisyonunu kabul eder.
4. **Telemetry temiz** — Anthropic'e geri call eden hiçbir endpoint olmadığını `bun run verify:privacy` ile doğrula. Build pipeline'da zorunlu.
5. **Marka ayrımı** — kullanıcı yüzeyinde "Claude" / "openclaude" geçmemeli. (Şu an: tamam, build çıktıları temiz.)

## İlgili

- [[Altaris SuperAgent]]
- [[Altaris-Super-Agent-Local-Deployment-Strategy]]
- [[MİA Teknoloji Litigation]] — IP iddialarının ticari etkisi konusunda iç hafıza
