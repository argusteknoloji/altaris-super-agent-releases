# Altaris Desktop — Apple Developer ID Sertifikası (Otomatik)

**Yapacak kişi:** Apple Developer hesabımıza erişimi olan ekip arkadaşı
**Süre:** 2–3 dakika (script çalıştırma) + 5 dk (GitHub'a yapıştırma)
**Cihaz:** Mac

---

## 0. Önce hazırla

Apple ID hesabından **App-Specific Password** üret (1 dk):

1. https://account.apple.com → giriş yap
2. **Sign-In and Security → App-Specific Passwords → +**
3. Ad: **`Altaris CI`** → Create
4. Apple bir şifre üretir (`xxxx-xxxx-xxxx-xxxx`). **Bir daha gösterilmez**, kopyala bekle.

Apple Team ID'yi de hazır tut:
- https://developer.apple.com/account → sayfanın üst kısmında 10 karakterlik kod (örn. `ABCD123XYZ`)

---

## 1. Script'i çalıştır

İlettiğim `generate-apple-cert.sh` dosyasını masaüstüne kopyala, sonra Terminal'de:

```bash
bash ~/Desktop/generate-apple-cert.sh
```

Script senden şunları soracak:
- **Apple ID e-postası**
- **App-specific password** (yukarıda 0. adımda kopyaladığın)
- **Apple Team ID** (10 karakter)

Script otomatik yapacak:
1. `fastlane` kurar (yoksa)
2. CSR üretir
3. Apple'dan **Developer ID Application** sertifikası talep eder
4. Sertifikayı keychain'e kurar
5. `.p12` dosyasına export eder (random güçlü şifre üretir)
6. Tüm değerleri base64'e çevirir, `SECRETS-TO-PASTE.txt` dosyası bırakır

**Süreç sırasında Apple iki şey isteyebilir:**
- İlk kez: 2FA kodu (cihazına gelecek 6 hane) — gir
- macOS keychain pop-up'ı: Mac şifreni iste — gir

---

## 2. Çıktıyı bana gönder

Script bittiğinde Finder otomatik açılır ve `SECRETS-TO-PASTE.txt` görünür. **İçinde 6 secret değeri var.**

İki seçenek:

**A) En kolay:** Bu txt dosyasını **1Password Secure Note** veya **Signal** ile bana gönder. Ben GitHub Secrets'a yapıştırırım.

**B) Sen yapmak istersen:** GitHub'a erişimin varsa kendin yapıştırabilirsin:
1. https://github.com/argusteknoloji/altaris-super-agent/settings/secrets/actions
2. Her secret için: "New repository secret" → name + value yapıştır → Add
3. Bittiğinde txt dosyasını **güvenli sil**: `rm -P ~/Desktop/altaris-apple-cert-*/SECRETS-TO-PASTE.txt`

---

## 3. Bittiğinde

`.p12` dosyası bilgisayarında kalır — istersen 1Password'a yedekle, sonra orijinali sil. 5 yıl geçerli.

---

## ❓ Takıldığın yer

| Hata | Sebep | Çözüm |
|---|---|---|
| `command not found: fastlane` | brew/ruby yok | Script otomatik kuracak; sudo şifresi iste, gir |
| `Authentication failed` | App-specific password yanlış | 0. adımı tekrarla, doğru Apple ID hesabında olduğundan emin ol |
| `Your team has reached the maximum number of certificates` | Eski cert hâlâ aktif | https://developer.apple.com/account/resources/certificates/list → eski Developer ID Application'ı **revoke** et, sonra script'i tekrar çalıştır |
| `You are not permitted to perform this operation` | Hesabın **Account Holder** veya **Admin** değil | Ben rolünü yükselteyim, haber ver |
| 2FA kodu sürekli soruyor | session expired | Normal, her gir; bir kere kabul edilince devam eder |

Sorun olursa Terminal'in tamamını ekran görüntüsü alıp gönder, üzerinden bakarım.

---

## ⚠️ Güvenlik

- Script **internet'e hiçbir credential göndermez** — sadece Apple'a (zaten oraya gidecek)
- `SECRETS-TO-PASTE.txt` çıktısını yapıştırdıktan sonra **mutlaka sil**
- `.p12` dosyası + şifresi **birlikte sızarsa** birisi Argus adına imzalı app yayınlayabilir — bu yüzden 1Password gibi şifreli yere koy
