using System.Text;

namespace Altaris.Infrastructure.Vaults;

/// <summary>
///   Writes a minimal Obsidian-compatible starter set into a freshly
///   created vault directory. The structure pairs the standard knowledge
///   layer (top-level index / log / hot cache + wiki tree of entities,
///   concepts, decisions, meetings, comparisons) with an agentic layer
///   (agents / skills / commands / hooks / _templates / bin) so an Argus
///   operator can drop straight into curating notes AND wiring up vault-
///   scoped automations without first deciding on a folder layout.
/// </summary>
public static class VaultScaffold
{
    private record SeedFile(string Path, string Body);

    private static IEnumerable<SeedFile> Files(string vaultName) => new[]
    {
        // Vault landing page — web UI bu kasayı açtığında ilk olarak Altaris.md'yi
        // gösterir (varsa). README.md ops belgesi olarak kalır; Altaris.md
        // kullanıcının vault'a girince ilk gördüğü "kapı" sayfası.
        new SeedFile("Altaris.md", $@"# {vaultName}

Bu kasaya hoş geldin. Markdown ile not al, `[[wikilink]]` ile bağla, sağ
üstteki **Graph** ile bağlantıları görselleştir.

## Hızlı başlangıç

- **Yeni not:** sol panelden `+ Dosya` ile bir `.md` aç.
- **Bağlantı:** içeride `[[Note Adi]]` yaz; otomatik tamamlama gelir,
  Cmd/Ctrl + click ile hedefe gider.
- **Edit / Oku:** üstteki segment butonu ile düzenleme ve okuma modları
  arasında geçiş yap. Tercih oturuma kaydedilir.
- **Kaydet:** Cmd/Ctrl + S.

## Yapı

- `wiki/` — kalıcı bilgi (entities, concepts, decisions, meetings, comparisons)
- `agents/`, `skills/`, `commands/`, `hooks/` — vault-scoped agentic katman
- `_templates/` — not şablonları (Templater veya `/template` komutu)
- `_attachments/` — gömülü medya

## Sonraki adım

İlk kalıcı notunu aç:

`wiki/concepts/[[ilk-not]].md`

Buraya yazdığın her şey vault graph'ında görünecek.
"),
        new SeedFile("README.md", $@"# {vaultName}

Argus Altaris bilgi kasası — Obsidian uyumlu, sunucu tarafı yönetilen,
agentic AI iş akışları için hazırlanmış.

## Bilgi katmanı
- `index.md` — kasanın canlı haritası
- `log.md`   — kronolojik operasyon kaydı (en yeni başta)
- `hot.md`   — son ~500 kelime hot context (her oturumda üstü yazılır)
- `wiki/`    — kalıcı bilgi (entities, concepts, decisions, meetings, comparisons)

## Agentic katman
- `agents/`     — vault'a özel AI agent tanımları (persona + tool seti)
- `skills/`     — yeniden kullanılabilir prompt + tool şablonları
- `commands/`   — vault'a özel slash komutlar
- `hooks/`      — lifecycle hook'ları (pre/post tool-use, on-edit, …)
- `_templates/` — Templater eklentisi için not şablonları
- `bin/`        — vault'a özel yardımcı script'ler

## Medya
- `_attachments/` — gömülü resim, PDF, vb.

Web arayüzünden veya `altaris vault use {vaultName}` ile düzenle.
"),
        new SeedFile("index.md", $@"---
type: meta
title: ""{vaultName} — Index""
status: evergreen
tags: [meta, index]
---

# {vaultName} — Index

Bu kasaya açıklama yaz. İlk kayıt için `wiki/concepts/` altına bir not aç,
buradan `[[Note Name]]` formatıyla bağla.
"),
        new SeedFile("log.md", @"---
type: meta
title: Log
status: evergreen
tags: [meta, log]
---

> Append-only. En yeni kayıt en üstte.

## (henüz kayıt yok)
"),
        new SeedFile("hot.md", $@"---
type: meta
title: Hot Cache
status: evergreen
tags: [meta, hot]
---

# Hot Cache — {DateTime.UtcNow:yyyy-MM-dd}

~500-kelime aktif bağlam. Her oturum başında üstü yazılır.

(boş)
"),

        // ─── Bilgi katmanı ────────────────────────────────────────────────
        new SeedFile("wiki/_index.md", @"---
type: meta
title: Wiki Index
status: evergreen
---

Kalıcı bilgi katmanı. Alt klasörler:

- `entities/` — kişiler, organizasyonlar, ürünler, projeler
- `concepts/` — fikirler, çerçeveler, tanımlar
- `decisions/` — kararlar (gerekçe + tarih)
- `meetings/` — toplantı notları
- `comparisons/` — karşılaştırma analizleri
"),
        new SeedFile("wiki/entities/.gitkeep", ""),
        new SeedFile("wiki/concepts/.gitkeep", ""),
        new SeedFile("wiki/decisions/.gitkeep", ""),
        new SeedFile("wiki/meetings/.gitkeep", ""),
        new SeedFile("wiki/comparisons/.gitkeep", ""),

        // ─── Agentic katman ───────────────────────────────────────────────
        new SeedFile("agents/README.md", @"# agents/

Bu klasördeki her `.md` dosyası bu kasaya özel bir AI agent tanımıdır.
Agent runtime onu yüklerken frontmatter'ı parse eder, gövdeyi system
prompt'a ekler.

Frontmatter alanları (öneri):

```yaml
---
name: brief-writer
description: Toplantı notlarından 250-kelimelik özet üretir
model: sonnet
tools: [WebSearch, FileSystem]
---
```

Boşken bile vault çalışır; bu dizin opt-in.
"),
        new SeedFile("agents/.gitkeep", ""),

        new SeedFile("skills/README.md", @"# skills/

Yeniden kullanılabilir prompt + tool kombinasyonları. Skill = ne zaman
tetiklenir + hangi adımlarla çözer.

Frontmatter (öneri):

```yaml
---
name: extract-action-items
description: Bir metinden açık aksiyonları çıkar
when: ""kullanıcı 'aksiyonları çıkar' der""
tools: [Read]
---
```

CLI agent loop runtime'da bu dosyaları discover eder.
"),
        new SeedFile("skills/.gitkeep", ""),

        new SeedFile("commands/README.md", @"# commands/

Vault'a özel slash komutları. Her dosya `/<isim>` olarak interactive
oturumda görünür.

Örnek `commands/günlük.md`:

```yaml
---
name: günlük
description: Bugünün günlük notunu aç ya da yarat
---
Bugünün notu `wiki/journal/{date:YYYY-MM-DD}.md` dosyasında. Dosya yoksa
şablonla yarat ve ilk başlığa bugünün tarihini koy.
```
"),
        new SeedFile("commands/.gitkeep", ""),

        new SeedFile("hooks/README.md", @"# hooks/

Lifecycle hook'ları. Bir tool çağrılmadan önce/sonra, oturum başında,
dosya kaydedildikten sonra çalışan ufak script'ler.

Örnek `hooks/post-edit.json`:

```json
{
  ""event"": ""post-edit"",
  ""glob"": ""wiki/**/*.md"",
  ""run"": ""bin/lint-frontmatter.sh""
}
```

`bin/` altındaki script'ler aynı vault dizininden çağrılır.
"),
        new SeedFile("hooks/.gitkeep", ""),

        new SeedFile("_templates/README.md", @"# _templates/

Obsidian Templater eklentisi (veya CLI `/template` komutu) tarafından
okunan not şablonları.

Örnek `_templates/meeting.md`:

```markdown
---
type: meeting
date: {{date}}
attendees: []
---

# {{title}}

## Bağlam

## Kararlar

## Aksiyonlar
```
"),
        new SeedFile("_templates/.gitkeep", ""),

        new SeedFile("bin/README.md", @"# bin/

Vault'a özel yardımcı script'ler (bash / python / node). Sistem PATH'ine
girmez; hook'lar ve manuel çalıştırma için.

Çalıştırmadan önce executable yap:

```bash
chmod +x bin/*.sh
```
"),
        new SeedFile("bin/.gitkeep", ""),

        // ─── Medya ────────────────────────────────────────────────────────
        new SeedFile("_attachments/.gitkeep", ""),

        // ─── Obsidian config ──────────────────────────────────────────────
        new SeedFile(".obsidian/app.json", @"{
  ""promptDelete"": true,
  ""newLinkFormat"": ""shortest"",
  ""useMarkdownLinks"": false,
  ""attachmentFolderPath"": ""_attachments""
}
"),
        new SeedFile(".obsidian/appearance.json", @"{
  ""theme"": ""obsidian"",
  ""baseFontSize"": 16
}
"),
        new SeedFile(".gitignore", @".obsidian/workspace*
.obsidian/cache
.DS_Store
"),

        // ─── CLI proje konvansiyonu — .mcp.json ─────────────────────────────
        // CLI vault'a cd ettiğinde bu MCP'leri otomatik yükler.
        // n8n: Argus internal n8n server (https://n8n.argusteknoloji.com),
        //      mcp-server endpoint kendi auth'unu içeride tutuyor; key gereksiz.
        // Web admin'den ekstra MCP eklenebilir; bu sadece default başlangıç.
        new SeedFile(".mcp.json", @"{
  ""mcpServers"": {
    ""n8n"": {
      ""type"": ""http"",
      ""url"": ""https://n8n.argusteknoloji.com/mcp-server/http""
    }
  }
}
"),
        new SeedFile(".altaris/skills/.gitkeep", ""),
        new SeedFile(".altaris/agents/.gitkeep", ""),
    };

    public static int Apply(string vaultRoot, string vaultName)
    {
        Directory.CreateDirectory(vaultRoot);
        var count = 0;
        foreach (var f in Files(vaultName))
        {
            var path = Path.Combine(vaultRoot, f.Path);
            var dir  = Path.GetDirectoryName(path);
            if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
            File.WriteAllText(path, f.Body, Encoding.UTF8);
            count++;
        }
        return count;
    }
}
