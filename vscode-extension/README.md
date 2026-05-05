# Altaris VS Code Extension

Altaris CLI ile VS Code (Cursor / Windsurf dahil) arasında köprü kuran extension.

## Ne yapıyor?

Aktivasyonda 127.0.0.1 üzerinde rastgele bir porta WebSocket dinliyor ve `~/.altaris/ide/<port>.lock` dosyasına auth token + workspace bilgisi yazıyor. Altaris CLI başlatıldığında bu lockfile'ı bulup köprüye bağlanıyor.

CLI'a sunulan tool'lar (MCP `tools/call`):

- **openDiff** — Editörde diff aç, kullanıcı kabul/red bekler.
- **close_tab** — Açık diff tab'ını kapat.
- **getDiagnostics** — Editör diagnostics'ini CLI'a aktar.
- **getCurrentSelection** — Aktif seçimi paylaş.
- **getOpenEditors** — Açık dosya listesi.
- **executeCode** — Jupyter kod çalıştırma (yakında).

## Kurulum

```bash
# CLI üzerinden (önerilen)
altaris shell-install --with-vscode

# veya manuel
code --install-extension altaris.vsix
```

## Geliştirme

```bash
npm install
npm run build
# F5 ile Extension Development Host başlat
```

## Paketleme

```bash
npm run package   # altaris.vsix üretir
```

## Marketplace yayını (maintainer için)

1. https://aka.ms/vscode-create-publisher → publisher 'argus' oluştur
2. Azure DevOps → User settings → Personal access tokens → Marketplace (Publish) scope → token üret
3. GitHub repo → Settings → Secrets → New: name=`VSCE_PAT`, value=token
4. Actions → "Publish VS Code extension" → Run workflow → version: auto → Run

İlk yayında bir kez `vsce login argus` lokalden de yapılmalı (CI'da headless).
Versiyon bump: package.json `version` alanını manuel arttır, sonra workflow tetikle.
Patch publish: `vsce publish patch`, minor: `vsce publish minor`.

