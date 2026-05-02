# Senaryo — video kaydı

22 saniyelik mini film + cinematic ambient. Çıktı: WhatsApp / Telegram / e-posta'ya
olduğu gibi yollanabilen MP4.

---

## A) Otomatik · Playwright + ffmpeg + BlackHole *(önerilen)*

Tekrarlanabilir, build pipeline'a takılır, her seferinde aynı çıktı.

**Tek seferlik kurulum:**

```bash
# 1. Tarayıcı otomasyonu + media tools
cd web
pnpm add -D playwright
pnpm exec playwright install chromium

brew install ffmpeg blackhole-2ch

# 2. macOS sistem sesini ffmpeg'e gör:
#    System Settings → Sound → Audio MIDI Setup
#    → "+" → Multi-Output Device → BlackHole 2ch + Speakers tikle
#    → output device olarak Multi-Output Device'ı seç

# 3. ffmpeg cihaz indekslerini öğren:
ffmpeg -f avfoundation -list_devices true -i ""
# çıktıdan video index (genelde "1") + audio index (BlackHole 2ch) not al
```

**Çalıştır:**

```bash
cd web
AVF_VIDEO=1 AVF_AUDIO=2 pnpm record:senaryo
# tmp/altaris-senaryo.mp4 (~3-5 MB)
```

Script `scripts/record-senaryo.ts` → headed Chromium aç, 24 sn ekran+ses kaydı, mp4 yaz.

---

## B) Manuel · macOS Screen Recording + BlackHole

Tek seferlik için, kurulum yok-eşit.

```bash
brew install blackhole-2ch
# Multi-Output Device yukarıdaki gibi ayarlı olmalı.

# 1. http://localhost:3000/katalog/senaryo aç
# 2. CMD+Shift+5 → Record Selected Portion
# 3. Options → Microphone → BlackHole 2ch
# 4. Sayfaya tıkla (sesi armla) → 22 sn izle → durdur
# 5. ~/Movies/Screen Recording-*.mov ortaya çıkar
```

`.mov` zaten paylaşıma uygun. WhatsApp da kabul eder.

---

## C) BlackHole'suz · Sessiz video + ses dosyası mux

BlackHole kuramazsan:

```bash
# 1. Sessiz ekran kaydı (CMD+Shift+5, ses kapalı)
# 2. /katalog/senaryo'yu Chrome'da aç, OffscreenCanvas + MediaRecorder ile
#    audio context'in destination'ından ses kaydı al
#    → audio.webm dosyası elde et
# 3. Mux:
ffmpeg -i recording.mov -i audio.webm -c:v copy -c:a aac altaris-senaryo.mp4
```

Ses dosyasını sayfada üretmek için browser console'da:

```js
// Soundtrack mounted'tan sonra:
const ctx = new AudioContext();
const dest = ctx.createMediaStreamDestination();
// Soundtrack'in master gain'ine bağla (Soundtrack.tsx'de master.connect(dest) ekle)
const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
const chunks = [];
rec.ondataavailable = e => chunks.push(e.data);
rec.start();
setTimeout(() => rec.stop(), 22500);
rec.onstop = () => {
  const blob = new Blob(chunks);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'soundtrack.webm';
  a.click();
};
```

---

## GIF'e dönüştürme (gerekirse)

```bash
brew install gifski
gifski --fps 18 --quality 85 -o senaryo.gif tmp/altaris-senaryo.mp4
```

---

## Yeni sahne ekleme

`page.tsx`'te `s7`, `s8` … animation chain'ine timing ekle. CSS keyframe `scene-life`
zaten yeniden kullanılabilir; her sahnenin `animation-delay` ve `animation-duration`
değerlerini değiştir, hepsi otomatik akar.

`Soundtrack.tsx`'te ilgili sahneye senkron ses olayı ekle (mevcut yapıyı taklit et).

`scripts/record-senaryo.ts`'de `DURATION_S` değişkenini güncelle.
