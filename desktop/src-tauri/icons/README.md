# Altaris Desktop Icons

Tauri build sırasında bu klasörde aşağıdaki dosyalar **zorunlu**:

- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)

## Üretim

Tek bir 1024×1024 PNG'den tüm formatları üretmek için Tauri CLI:

```bash
pnpm tauri icon path/to/altaris-1024.png
```

Bu komut hem icon set'ini hem de macOS/Windows native formatlarını üretir.

## TODO (Sprint 1 öncesi)

- [ ] Argus brand kit'inden Altaris logosunu 1024×1024 PNG olarak çıkar
- [ ] `pnpm tauri icon` çalıştır
- [ ] Bu README'yi sil
