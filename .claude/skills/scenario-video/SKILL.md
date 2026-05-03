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

## Shared library pattern — 10+ senaryo için DRY altyapı

Tek senaryo yaparken page.tsx + Soundtrack.tsx tek dosyada toplanır.
**3+ senaryoda** aynı kalıbı tekrarlamak yerine paylaşılan kütüphane çıkar:

```
katalog/senaryo/
├── _lib/
│   ├── audio.ts            ─ Web Audio primitives (osc, gain, heartbeat,
│   │                          bell, pad, sweep, lfo, masterEnv, NOTES)
│   ├── SenaryoPlayer.tsx   ─ generic player + recorder (autoplay +
│   │                          window.__altarisRenderAudio + fullscreen)
│   └── SenaryoStage.tsx    ─ atmosphere + UI chrome + scene CSS rules
├── page.tsx                ─ senaryo 1 (eski standalone — bırakıyoruz)
├── 2/page.tsx              ─ yeni senaryolar — sadece schedule + scenes
├── 3/page.tsx              …
├── showcase/page.tsx       ─ tüm yetenekler özet
```

Yeni senaryo dosyası ~250 satır (önceden 600+). Her dosya:

```ts
"use client";
import { SenaryoPlayer, type ScheduleFn } from "../_lib/SenaryoPlayer";
import { SenaryoStage } from "../_lib/SenaryoStage";
import { bell, heartbeat, masterEnv, NOTES, pad } from "../_lib/audio";

const TOTAL = 22;
const SCENE_TIMINGS = [[0,3],[3,3],[6,3],[9,6],[15,3],[18,4]] as const;

const schedule: ScheduleFn = (ctx, recordDest) => {
  const t0 = ctx.currentTime;
  const master = masterEnv(ctx, recordDest, { peak: 0.5, totalDur: TOTAL });
  pad(ctx, master, t0, TOTAL, [NOTES.D3, NOTES.A3, NOTES.D4], [
    [0, 0], [2, 0.022], [9, 0.020], [17, 0.028], [21.6, 0],
  ]);
  // … sahne accent'leri
};

export default function Senaryo2Page() {
  return (
    <SenaryoStage
      sceneTimings={SCENE_TIMINGS}
      topLabel="argus · senaryo 02 · gece krizi"
      timeline={["alarm", "soru", "altaris", "kök neden", "süre", "sabah"]}
      accentColors={{ from: "#ffb464", via: "#d97757", to: "#c15f3c" }}
    >
      {/* 6 <section className="scene s1..s6"> */}
      <SenaryoPlayer schedule={schedule} durationSec={TOTAL}
        filenamePrefix="senaryo-02-gece" label="senaryo 02" />
    </SenaryoStage>
  );
}
```

`SenaryoPlayer` zaten Şu işleri yapıyor: autoplay URL paramı, offline audio
render API, MediaRecorder kayıt, fullscreen toggle, recording chrome gizleme.

`SenaryoStage` zaten: atmosphere, top/bottom UI chrome (ui-chrome class'ı),
scene CSS keyframe rules, accent gradient, recording-time chrome hide.

## Mood matrix — 13 senaryonun key + tone referansı

Yeni senaryo eklerken tonality'i daha önce kullanılmamış bir kombinasyon
seçmek brand variety yaratır. Mevcut 13'ün matrix'i:

| # | Senaryo | Müzik | Accent | Mood |
|---|---|---|---|---|
| 1 | Yönetici Sabahı | D minor pad + heartbeat | sunset orange | tense calm |
| 2 | Gecenin Kontrolü | D minor + alarm cluster + sweep | sunset | crisis tension |
| 3 | Boardroom | F major slow | sunset | methodical analytical |
| 4 | İlk Gün | C major warm | warm gold (#f0a060) | hopeful discovery |
| 5 | 10 Dakika Kala | tick-tock + D minor → D major | sunset | countdown triumph |
| 6 | İmza Öncesi | E minor vigilant | sunset | cautious alert |
| 7 | Sessiz Çıkış | A minor soft piano | sage green (#7fa890) | human contemplative |
| 8 | Q4 Hedefi | industrial + D drone + 0.6s kicks | sunset | mechanical pulse |
| 9 | 5M Dolar | G minor → G major heroic | sunset | cinematic trailer |
| 10 | Denetim Hazır | C major + clock ticks | blue (#7a98d8) | methodical official |
| 11 | Yeşil Sınır | E major + water-flow noise | green (#6fb573) | sustainable organic |
| 12 | Akşam Vardiyası (Sağlık) | A minor → A major, soft monitor pulse | teal (#5fa8a0) | warm clinical |
| 13 | Hat Duruşu (Üretim) | D minor mechanical, 0.7sn industrial kicks | steel (#7080a8) | industrial pulse |
| 14 | Davaya 24 Saat (Hukuk) | F major slow scholarly bells | burgundy (#8a4858) | methodical scholarly |
| 15 | Komite Sabahı (Bankacılık) | C major institutional clock | navy gold (#9a8a50) | precise official |
| 16 | Konteyner Gecikmesi (Lojistik) | E minor → E major kinetic | amber (#d8a050) | kinetic mechanical |
| ★ | Showcase | D major heroic build | sunset | premium cinematic |

Yeni senaryo eklerken:
- **Sektör'e göre accent rengi** — yeşil sürdürülebilirlik · mavi kamu/finans
  · gold MEB/devlet · sage İK/insan · sunset diğer
- **Tone'a göre key**: D minor crisis · F major methodical · C major calm
  · E major nature · G major heroic · A minor introspective
- **Heartbeat tempo**: 2sn aralık institutional/calm · 1.5sn boardroom · 1sn crisis ·
  0.6sn industrial mechanical

## Batch recording — birden fazla senaryoyu tek seferde mp4'e çevir

10+ senaryo için recording infrastructure'ı tek bir script'te toplandı.
Headless Chromium + offline audio render + ffmpeg mux pipeline'ı.

### Sayfa tarafı gereksinimler

Her senaryo sayfası şu iki API'yi expose etmeli (SenaryoPlayer'da var):

```ts
// 1) ?autoplay=1 URL paramı ile otomatik başlatma
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("autoplay") === "1") {
    setTimeout(() => void startPreview(), 200);
  }
}, []);

// 2) OfflineAudioContext ile sessiz audio rendering
window.__altarisRenderAudio = async () => {
  const sr = 44100;
  const off = new OfflineAudioContext({
    numberOfChannels: 2,
    sampleRate: sr,
    length: Math.ceil(sr * (durationSec + 0.5)),
  });
  schedule(off as unknown as AudioContext, null);
  const buf = await off.startRendering();
  return audioBufferToWavBase64(buf);  // base64-encoded WAV
};
```

Headless'da audio cihazı yok, ama OfflineAudioContext **render** real-time
gerektirmez — milisaniyede 22sn ses üretir.

### Batch script iskeleti

```ts
// scripts/batch-record-scenarios.ts
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, copyFileSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SCENARIOS = [
  { url: "/katalog/senaryo",    slug: "01-..." },
  { url: "/katalog/senaryo/2",  slug: "02-..." },
  // ...
];

async function recordOne(s, idx, total) {
  // Her senaryo için ayrı tmp alt-dir → video file pick deterministik
  const sceneTmp = join(TMP_DIR, s.slug);
  mkdirSync(sceneTmp, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,                                          // retina
    recordVideo: { dir: sceneTmp, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  await page.goto(`${BASE}${s.url}?autoplay=1`, { waitUntil: "networkidle" });
  await page.mouse.click(960, 540);                                 // double-arm audio
  await page.waitForTimeout(150);
  await page.waitForTimeout(22500);                                 // animation
  const audioBase64 = await page.evaluate(async () =>
    await window.__altarisRenderAudio()
  );
  writeFileSync(join(sceneTmp, "audio.wav"), Buffer.from(audioBase64, "base64"));
  await page.close();
  await context.close();
  await browser.close();
  // Tek senaryo için tek webm var, deterministik pick
  const silent = readdirSync(sceneTmp).find((f) => f.endsWith(".webm"));
  await muxToMp4(join(sceneTmp, silent), join(sceneTmp, "audio.wav"), mp4Path);
  copyFileSync(mp4Path, vaultPath);
  rmSync(sceneTmp, { recursive: true, force: true });
}
```

### ffmpeg mux ayarları (kalite için)

```bash
ffmpeg -y \
  -i silent.webm -i audio.wav \
  -c:v libx264 \
  -preset slow \                # yavaş encode = daha iyi compression
  -crf 16 \                      # visually lossless (20 = standart, 16 = premium)
  -pix_fmt yuv420p \
  -tune film \                   # animasyon/film için optimize
  -x264-params keyint=60:min-keyint=60 \
  -c:a aac -b:a 256k \
  -shortest \
  -movflags +faststart \
  output.mp4
```

### Çalıştırma

```bash
# 1. Web sunucusu ayakta olsun (docker veya pnpm dev)
# 2. Playwright kurulu olsun: pnpm add -D playwright && pnpm exec playwright install chromium
# 3. Çalıştır:
WIDTH=1920 HEIGHT=1080 bun run scripts/batch-record-scenarios.ts

# Mevcut mp4'leri tekrar üretmek için:
bun run scripts/batch-record-scenarios.ts --force
```

Tipik süre: senaryo başına ~25 sn (22 sn animasyon + browser launch/close +
ffmpeg). 11 senaryo için ~5 dakika.

### TEK-TEK RENDER ŞART — batch monolitik döngü kilitleniyor

**Pratik gözlem (2026-05-03 ingestion):** `batch-record-scenarios.ts` tek
process içinde 11+ senaryoyu döngüyle koşturduğunda, herhangi bir senaryoda
takılma (audio render timeout, networkidle hang, Playwright zombie) tüm
pipeline'ı kilitliyor — kalan senaryolar üretilmiyor, exit code 144 ile düşüyor.

**Çözüm:** her senaryo için ayrı OS process spawn et. `scripts/record-one-scenario.ts`
tek senaryoyu izole process'te çalıştırır:

```bash
bun run scripts/record-one-scenario.ts \
  /katalog/senaryo/13 \
  13-hat-durusu \
  ~/.claude/vaults/claude-obsidian/videos/altaris_scenarios
```

Her invocation:
- Yeni Chromium instance (zombie state birikmesi yok)
- Kendi `/tmp/altaris-record-<slug>-<ts>` dizini (deterministik webm pick)
- Bir senaryo başarısız olursa exit 1, **diğerlerini etkilemez**
- 60 saniye audio render timeout — sonsuz döngüden çıkar

**Outer wrapper pattern** (yeni 5 sahne için kullanıldı):

```bash
for slug_pair in \
  "13:13-hat-durusu" \
  "14:14-davaya-24-saat" \
  "15:15-komite-sabahi" \
  "16:16-konteyner-gecikmesi"; do
  num=${slug_pair%%:*}
  slug=${slug_pair##*:}
  bun run scripts/record-one-scenario.ts "/katalog/senaryo/$num" "$slug" "$VAULT_DIR"
done
```

`batch-record-scenarios.ts` toplu yeniden üretim için duruyor (hızlı, yeniden
inşa). Ama kısmi/yeni senaryolarda ve CI'da **tek-tek** rota tercih edilmeli.

### Public asset kopyalama — repo'da videolar eksik kalmasın

Kayıt scriptleri vault'a kopyaladıktan sonra `web/public/scenarios/<slug>.mp4`'a
da kopyalamalı. Aksi halde `git push` videoları içermez, deployment'ta sahne
çalışmaz:

```ts
const mp4Public = join("public", "scenarios", `${SLUG}.mp4`);
copyFileSync(mp4Local, mp4Public);
```

Hem `record-one-scenario.ts` hem `batch-record-scenarios.ts` bu kopyalamayı
yapmalı.

### Skip-existing pattern

Vault'ta zaten mp4 varsa atla — kısmi başarısızlıklarda hızlı yeniden başlat:

```ts
const todo = SCENARIOS.filter((s) => {
  const vp = join(VAULT_DIR, `${s.slug}.mp4`);
  if (!process.argv.includes("--force") && existsSync(vp)) {
    console.log(`✓ ${s.slug} — atlanıyor`);
    return false;
  }
  return true;
});
```

### Pitfalls — batch'e özel

- **Per-scenario tmp dir ŞART** — Playwright video dosyalarını UUID'li
  isimle (örn `page@a4a5c6...webm`) kaydeder. Tek bir TMP_DIR kullanırsan
  hangisi hangi senaryoya ait olduğu bilinmez. Her senaryo için
  `mkdir tmp/batch-recordings/<slug>/` aç.
- **deviceScaleFactor: 2** — yoksa metin/ince çizgi pixelated. 1080p'de
  bile retina rendering ile crisp görünür. Trade-off: render 2x daha yavaş
  (rendering pixel sayısı 4x).
- **`networkidle` timeout** — Next.js build öncesi cold start'ta sayfa geç
  yüklenebilir. Önceden bir `curl http://localhost:3000/` ile ısınma yap.
- **Audio render timeout** — `page.evaluate(fn, { timeout: 26_000 })`
  long-running için. Default 30s ama kısa bırakılırsa 22sn audio render +
  base64 encoding bazen aşar.
- **Headless chromium ses çıkışı yok** — Web Audio API context yine var ama
  fiziksel ses üretmez. Recording'de sessizlik. OfflineAudioContext bu yüzden
  ŞART — ayrı thread'de PCM data üretir.

## Pitfalls

### CSS — `:not([data-play="1"])` selector tuzağı *(2x tekrarladım, ÖNEMLİ)*

```css
/* ❌ YANLIŞ — html dışındaki tüm atalara da match eder */
:not([data-play="1"]) .scene { opacity: 0 !important; }
```

`:not([attr])` herhangi bir descendant selector'da kullanıldığında, **tüm
atalar** kontrol edilir. `<html data-play="1">` set edildiğinde:
- `<html>` → `[data-play="1"]` ile **eşleşir**, `:not()` bunu **dışlar** ✓
- `<main>` → `[data-play="1"]` yok, `:not()` **eşleşir** ✗
- `<body>` → `[data-play="1"]` yok, `:not()` **eşleşir** ✗

Sonuç: `.scene` öğesi yine `opacity: 0 !important` alır, animation override
edilir, sahne **boş** görünür. ⚠️ Animation çalışıyor ama görünmüyor.

```css
/* ✅ DOĞRU — sadece html'e bağla */
html:not([data-play="1"]) .scene { opacity: 0 !important; }

/* ✅ DAHA İYİ — :not() rule'una hiç gerek yok */
.scene { opacity: 0; }                                   /* base */
html[data-play="1"] .s1 { animation: scene-life 3s 0s ease-out forwards; }
/* keyframe'in 0% ve 100%'ünde opacity:0, ortada opacity:1 → otomatik şekillenir */
```

**Kontrol checklist:**
- Yeni `.scene`-benzeri animasyonlu element eklediysen, base CSS'inde `opacity: 0` olduğundan emin ol.
- `:not(...)` rule'u kullandıysan **`html` ile prefix'le** veya kaldır.
- Browser DevTools → Computed → `.scene` üzerine gel → `opacity` hangi rule'dan geliyor bak.

### Diğer pitfall'lar

- **AudioContext suspend'da kalır** → user gesture lazım. Playwright headed
  + `--autoplay-policy=no-user-gesture-required` + programatik mouse click şart.
- **Pad/drone "parazit gibi" geliyor** → continuous sustained ton, özellikle
  sawtooth/triangle düşük frekanslarda (D2 73Hz vs.) buzz yapar. Çözümler:
  - Sürekli pad'i tamamen kaldır → punctuated bell hits + heartbeat kicks (sahne 2'de yapıldı).
  - Pad bırakırsan sine wave + minimum oktav D3 (147Hz) + master gain ≤ 0.025 per voice.
  - Lowpass filter sweep (frekans 400→2400Hz) "warmth" katar ama buzz yine kalabilir.
- **Build cache eski kodu serve ediyor** → `docker compose --build` bazen cache hit eder, eski
  binary çalışır. Şüphe varsa `docker compose stop web && build --no-cache web && up -d web`.
- **Recording'de UI chrome görünüyor** → `data-recording="1"` attr set et, `html[data-recording="1"] .ui-chrome { opacity: 0 !important }` ile gizle.
  Status bar (kaydediliyor 5/22s) recording phase'inde tamamen `return null` olmalı, DOM'da hiç olmasın.
- **Animation kayıt frame 0'dan başlamıyor** → `setPhase()` ÖNCESİ direct DOM yazımı:
  `document.documentElement.setAttribute("data-play", "1")` + `recorder.start()` + `schedule(...)`
  hepsi aynı tick'te.
- **Retina double resolution** → `--window-size=1280x800` ekran üzerinde 2560x1600
  fiziksel piksel. ffmpeg'in `-vf scale=` ile küçültme gerekebilir.
- **BlackHole karışıklığı** → Multi-Output Device default output olmalı, yoksa
  ffmpeg sessiz kayıt alır. `ffmpeg -list_devices` her zaman önce.
- **WhatsApp 16 MB limit** → 30 sn altında 1080p H.264 CRF 22 ile sığar; üstüne
  çıkarsan `gifski --quality 75 --width 720` ile küçült.
- **Browser ekran paylaşımı sekme sesini almıyor** → kullanıcı paylaşım dialog'unda
  "Tab" sekmesini seçmeli + "Tab sesini paylaş" kutucuğunu işaretlemeli. UI'da
  bu yönergeyi tooltip ile göster.

## Brand consistency

Tüm Altaris senaryoları için sabit kalanlar:

- **Renk paleti** — `#0a0908` background, sunset gradient `#ffb464 → #c15f3c`
- **Font** — `font-mono` (ui-monospace), no third-party fonts
- **Hairline rules** — `rgba(120,80,50,0.3)` köprü çizgileri
- **ALTARIS ASCII wordmark** — block-letter, shimmer gradient, kapanışta tam ölçek
- **Theme motif** — D-major pentatonic 4-note ascending (kurumsal işitsel imza)

Bunları değiştirme. İçerik değişir, dil değişmez.
