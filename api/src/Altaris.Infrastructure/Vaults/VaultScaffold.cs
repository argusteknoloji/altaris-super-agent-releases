using System.Text;

namespace Altaris.Infrastructure.Vaults;

/// <summary>
///   Writes a minimal Obsidian-compatible starter set into a freshly
///   created vault directory. The structure mirrors common knowledge-vault
///   conventions (a top-level index, an append-only operations log, a hot
///   cache of recent context, plus a <c>wiki/</c> tree for entities,
///   concepts, decisions, meetings) so an Argus operator can drop straight
///   into curating notes without first deciding on a folder layout.
/// </summary>
public static class VaultScaffold
{
    private record SeedFile(string Path, string Body);

    private static IEnumerable<SeedFile> Files(string vaultName) => new[]
    {
        new SeedFile("README.md", $@"# {vaultName}

Argus Altaris bilgi kasası — Obsidian uyumlu, sunucu tarafı yönetilen.

- `index.md` — kasanın canlı haritası
- `log.md`   — kronolojik operasyon kaydı (en yeni başta)
- `hot.md`   — son ~500 kelime hot context (her oturumda üstü yazılır)
- `wiki/`    — kalıcı bilgi (entities, concepts, decisions, meetings)
- `_attachments/` — gömülü medya (resim, pdf)

Web arayüzünden veya `altaris vault open {vaultName}` ile düzenle.
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
        new SeedFile("_attachments/.gitkeep", ""),
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
