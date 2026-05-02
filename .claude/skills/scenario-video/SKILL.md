---
name: scenario-video
description: |
  Build narrative scenario videos that demonstrate Altaris (or any product) value
  through a 15-25 second mini-film instead of a static catalog scroll. Six scenes,
  CSS keyframe-chain self-playing, procedural Web Audio cinematic soundtrack with
  a brand theme motif, recordable to MP4 via Playwright + ffmpeg avfoundation.
  Output is share-ready for WhatsApp / Telegram / executive briefs.
trigger:
  - senaryo videosu
  - scenario video
  - mini film yap
  - storyboard demo
  - kurumsal demo videosu
  - 30 saniye demo
---

# Scenario Video — Skill

> "Düz katalog kaydı değil. Bir hikaye. İzleyen 'haa, bu böyle bir işe yarıyor' demeli."

## When to use

- C-level brief / pitch deck companion (SSB Başkanı, CEO, satın alma)
- WhatsApp / Telegram'da paylaşılabilir 15-25 sn'lik anlatım
- Pre-meeting "ne yapıyor" demo
- Şirket içi tanıtım / yatırımcı sunumu

**Not for:** ürün demosu, ekran kaydı, eğitim videosu. Bunlar düz kayıt — burası
storytelling.

## Storyboard recipe — "before/after/proof/CTA"

Her senaryo şu 5 atomu içerir:

| Atom | Süre | İşlevi |
|---|---|---|
| **Sahne** | 2-3 sn | Karakteri ve durumu kur ("Pazartesi 08:30 yönetici masası") |
| **Sorun** | 2-3 sn | Net soru sor ("Bu hafta hangi 3 risk elimde?") |
| **Aksiyon** | 3-4 sn | Ürün kullanımı ("Altaris'e yaz · düşünüyor · yanıt") |
| **Cevap** | 4-6 sn | Somut çıktı (3 risk kartı, kaynak referansları) |
| **Kanıt** | 2-3 sn | Sayısal vurgu ("4 saatlik analiz · 12 sn") |
| **CTA** | 3-4 sn | Marka + aksiyon ("Pilot · 30 gün ücretsiz") |

Toplam: ~22 sn. WhatsApp limit 30 sn altı, ideal.

## Implementation pattern

### 1) Sahne sayfası — Next.js App Router route

`web/src/app/katalog/senaryo/page.tsx`. Tek dosyada 6 sahne, hepsi
`position: absolute; inset: 0` ile üst üste, opacity ile sırasıyla görünür.

CSS keyframe chain (kritik teknik):

```css
@keyframes scene-life {
  0%, 100% { opacity: 0; transform: translateY(10px); }
  6%, 92%  { opacity: 1; transform: translateY(0); }
}
.s1 { animation: scene-life 3s   0s   ease-out forwards; }
.s2 { animation: scene-life 3s   3s   ease-out forwards; }
.s3 { animation: scene-life 3s   6s   ease-out forwards; }
.s4 { animation: scene-life 6s   9s   ease-out forwards; }
.s5 { animation: scene-life 3s   15s  ease-out forwards; }
.s6 { animation: scene-life 4s   18s  ease-out forwards; }
```

Her sahne kendi içinde alt-animasyonlar yapabilir (typing, kart pop, stopwatch
döner) — bunlar `animation-delay` ile sahne penceresinin içinde tetiklenir.

### 2) Soundtrack — Web Audio prosedürel

`Soundtrack.tsx` (client component). Telif sıfır, dosya sıfır. Üç katman:

- **Drone pad** — sürekli low D-minor (D2 + A2 + harmonics), lowpass filter sweep
- **Sahne accent'leri** — sorularda tick'ler, typing'de keystroke'lar, risk
  kart'ı pop'larında C-E-G arpej
- **Brand theme motif** — 4 nota (D4 · F#4 · A4 · D5, D-major pentatonic ascending)
  - Sahne 1'in başında 0.4s'de hint (yumuşak, sin wave)
  - Sahne 6'da (18s) full forte resolve (triangle wave)
  - Bu motif = markanın işitsel imzası, akılda kalır

Audio context user-gesture gerektirir; `useEffect` içinde `setTimeout(arm, 80)` ile
programatik tetikleme + click/keydown listener fallback.

### 3) Recording pipeline

**Playwright + ffmpeg avfoundation:**

```ts
// scripts/record-senaryo.ts
const browser = await chromium.launch({
  headless: false,
  args: [
    "--autoplay-policy=no-user-gesture-required",
    "--window-size=1280,800",
  ],
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.mouse.click(640, 400);  // arm audio
await page.waitForTimeout(150);

// ffmpeg avfoundation: ekran (video idx 1) + BlackHole (audio idx)
spawn("ffmpeg", [
  "-f", "avfoundation",
  "-framerate", "30",
  "-i", `${VIDEO}:${AUDIO}`,
  "-t", "24",
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
  "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "160k",
  "tmp/output.mp4",
]);
```

**Önkoşul (macOS):**
- `brew install blackhole-2ch ffmpeg`
- System Settings → Audio MIDI Setup → Multi-Output Device (BlackHole + Speakers)
- `ffmpeg -f avfoundation -list_devices true -i ""` ile cihaz indekslerini doğrula

## File templates

Skill kullanılırken aşağıdaki dosya iskeletleri referans:

```
web/src/app/katalog/<scenario-slug>/
├── page.tsx           — 6 sahnelik animasyonlu route
├── Soundtrack.tsx     — client component, Web Audio synth
└── RECORDING.md       — kayıt rehberi (3 yol)

web/scripts/
└── record-<slug>.ts   — Playwright + ffmpeg automation

.claude/skills/scenario-video/
├── SKILL.md           — bu dosya
└── reference/         — örnek storyboard'lar
    └── 01-yonetici-sabahı.md
```

## Aşamalı rehber — yeni senaryo yapımı

1. **Storyboard yaz** — 6 sahnelik beat sheet (örn. `reference/01-yonetici-sabahı.md`)
2. **Sahne sayfası iskeletini kopyala** — mevcut `senaryo/page.tsx`'i yeni slug
   altında çoğalt, içerikleri değiştir, animation chain'i ihtiyaca göre yeniden
   timing'le
3. **Soundtrack senkronu** — yeni sahne timing'lerine göre `Soundtrack.tsx`'in
   accent atışlarını taşı; theme motif'i sabit tut (marka tutarlılığı)
4. **Recording script'i çoğalt** — `record-<slug>.ts`, route URL'sini ve
   DURATION_S'i güncelle
5. **Test** — `pnpm dev` ile browser'da izle, timing'i tutturmazsan keyframe
   yüzdelerini ayarla
6. **Kaydet** — `pnpm record:<slug>` → `tmp/<slug>.mp4`
7. **Dağıt** — WhatsApp/Telegram'a olduğu gibi at; ya da `gifski` ile GIF

## Pitfalls

- **AudioContext suspend'da kalır** → user gesture lazım. Playwright headed
  + `--autoplay-policy=no-user-gesture-required` + programatik mouse click şart.
- **Retina double resolution** → `--window-size=1280x800` ekran üzerinde 2560x1600
  fiziksel piksel. ffmpeg'in `-vf scale=` ile küçültme gerekebilir.
- **BlackHole karışıklığı** → Multi-Output Device default output olmalı, yoksa
  ffmpeg sessiz kayıt alır. `ffmpeg -list_devices` her zaman önce.
- **WhatsApp 16 MB limit** → 30 sn altında 1080p H.264 CRF 22 ile sığar; üstüne
  çıkarsan `gifski --quality 75 --width 720` ile küçült.

## Brand consistency

Tüm Altaris senaryoları için sabit kalanlar:

- **Renk paleti** — `#0a0908` background, sunset gradient `#ffb464 → #c15f3c`
- **Font** — `font-mono` (ui-monospace), no third-party fonts
- **Hairline rules** — `rgba(120,80,50,0.3)` köprü çizgileri
- **ALTARIS ASCII wordmark** — block-letter, shimmer gradient, kapanışta tam ölçek
- **Theme motif** — D-major pentatonic 4-note ascending (kurumsal işitsel imza)

Bunları değiştirme. İçerik değişir, dil değişmez.
