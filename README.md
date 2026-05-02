# Releases-repo bootstrap

`argusteknoloji/altaris-super-agent-releases` (PUBLIC) repo'suna ilk
push için kullanılacak iskele.

## Kurulum

1. Bu klasördeki dosyaları yeni public repo'ya kopyala:

   ```bash
   # Lokal clone yarat
   git clone git@github.com:argusteknoloji/altaris-super-agent-releases.git /tmp/altaris-releases
   cd /tmp/altaris-releases

   # Workflow + README ekle
   mkdir -p .github/workflows
   cp ~/Desktop/Projects/Argus.Altaris.SuperAgent/infra/release-repo-bootstrap/publish-release.yml .github/workflows/
   cp ~/Desktop/Projects/Argus.Altaris.SuperAgent/infra/release-repo-bootstrap/README.md ./

   git add -A
   git commit -m "bootstrap: publish-release workflow"
   git push origin main
   ```

2. SSH Deploy Key ekle (Source CI'nın bu repo'ya push etmesi için):

   - Lokal makinenize özel-bu-repo bir keypair üretin (ayrı tutmak iyi pratik):

     ```bash
     ssh-keygen -t ed25519 -f ~/.ssh/altaris-releases-deploy -C "altaris-releases-ci" -N ""
     ```

   - Public yarısını (`altaris-releases-deploy.pub`) bu repo'nun
     **Settings → Deploy keys → Add deploy key**:
     - Title: `source-repo-ci`
     - Key: `altaris-releases-deploy.pub` içeriği
     - **Allow write access:** ✓ (zorunlu)

   - Private yarısını (`altaris-releases-deploy`) Source repo
     (`argusteknoloji/altaris-super-agent`) **Settings → Secrets and
     variables → Actions → New repository secret**:
     - Name: `RELEASES_DEPLOY_KEY`
     - Value: `altaris-releases-deploy` dosyasının tüm içeriği (BEGIN…END dahil)

3. İlk release tetiği (Source repo'sunda):

   ```bash
   cd ~/Desktop/Projects/Argus.Altaris.SuperAgent
   git tag v0.1.0-beta.1 && git push --tags
   ```

   Workflow akışı:
   - **Source repo CI** matrix build → 5 binary üretir → SSH ile bu repo'ya push (tag dahil)
   - **Bu repo CI** tag push'unu yakalar → `bin/v0.1.0-beta.1/altaris-*` dosyalarını GitHub Release asset olarak yükler
   - `https://github.com/argusteknoloji/altaris-super-agent-releases/releases/latest/download/altaris-darwin-arm64` çalışır

## Layout

```
.
├── README.md                       # bu dosya (override edilmez)
├── .github/workflows/
│   └── publish-release.yml         # tag push'unda release oluşturur
└── bin/
    ├── latest/                     # her zaman en son sürüm (overwrite)
    │   ├── altaris-darwin-arm64
    │   ├── altaris-darwin-x64
    │   ├── altaris-linux-x64
    │   ├── altaris-linux-arm64
    │   ├── altaris-windows-x64.exe
    │   └── SHA256SUMS
    └── v0.1.0-beta.1/              # versiyona pinli arşiv (immutable)
        └── ...
```
