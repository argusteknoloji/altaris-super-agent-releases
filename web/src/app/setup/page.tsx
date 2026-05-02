"use client";

/**
 * /setup — Altaris CLI kurulum portalı.
 *
 *   Tarayıcı OS'u tespit edip o platformun tek-satır install komutunu
 *   üstte gösterir; alttaki sekmeler ile diğer platformlara geçilebilir
 *   (kurum BT'si tek bir browser'dan tüm operatörlere link gönderebilsin).
 */

import { useEffect, useMemo, useState } from "react";

type Os   = "macos" | "linux" | "windows";
type Arch = "arm64" | "x64";

interface CliAsset {
  os: Os; arch: Arch;
  filename: string;
  downloadUrl: string;
  installScript: string;
  postInstallHint: string;
}

interface SetupResponse {
  version: string;
  repo: string;
  apiBase: string;
  webBase: string;
  assets: CliAsset[];
}

interface DesktopAsset {
  os: string; arch: string;
  filename: string;
  downloadUrl: string;
  installHint: string;
}
interface DesktopResponse {
  version: string;
  repo: string;
  updaterManifestUrl: string;
  assets: DesktopAsset[];
}

type Kind = "cli" | "desktop";

function detectOs(): Os {
  if (typeof navigator === "undefined") return "macos";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux") || ua.includes("x11")) return "linux";
  return "macos";
}

function detectArch(): Arch {
  if (typeof navigator === "undefined") return "arm64";
  const ua = navigator.userAgent.toLowerCase();
  // Apple Silicon ipucu — UA'da "arm" veya "apple silicon" hep yok ama
  // Mac default'unu arm64 yapmak 2026 itibariyle sağlam tahmin.
  if (ua.includes("aarch64") || ua.includes("arm64")) return "arm64";
  return "x64";
}

const OS_LABEL: Record<Os, string> = {
  macos:   "macOS",
  linux:   "Linux",
  windows: "Windows",
};

export default function SetupPage() {
  const [kind, setKind]   = useState<Kind>("cli");
  const [data, setData]   = useState<SetupResponse | null>(null);
  const [desktop, setDesktop] = useState<DesktopResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [os, setOs]       = useState<Os>("macos");
  const [arch, setArch]   = useState<Arch>("arm64");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setOs(detectOs());
    setArch(detectArch());
  }, []);

  useEffect(() => {
    fetch("/api/proxy/setup?kind=cli", { cache: "no-store" })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(setData)
      .catch(e => setError((e as Error).message));
    fetch("/api/proxy/setup?kind=desktop", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(setDesktop)
      .catch(() => { /* desktop optional — fail silently */ });
  }, []);

  const desktopAsset = useMemo(() => {
    if (!desktop) return null;
    return desktop.assets.find(a => a.os === os && (a.arch === arch || a.arch.startsWith(arch)))
        ?? desktop.assets.find(a => a.os === os)
        ?? null;
  }, [desktop, os, arch]);

  const asset = useMemo(() => {
    if (!data) return null;
    return data.assets.find(a => a.os === os && a.arch === arch) ?? data.assets.find(a => a.os === os) ?? null;
  }, [data, os, arch]);

  const archOptions = useMemo(() => {
    if (!data) return [] as Arch[];
    return Array.from(new Set(data.assets.filter(a => a.os === os).map(a => a.arch)));
  }, [data, os]);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(prev => prev === key ? null : prev), 1500);
    } catch { /* no clipboard permission */ }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Altaris kurulumu</h1>
        <p className="mt-2 text-sm text-neutral-400">
          İki seçenek: terminalde çalışan <strong>CLI</strong> veya GUI'li <strong>Desktop App</strong>.
          İkisi de aynı portal hesabını kullanır; lokal makinende çalışır, veriniz dışarı çıkmaz.
        </p>
      </div>

      {/* CLI / Desktop product seçici */}
      <div className="mb-6 inline-flex rounded-lg border border-neutral-800 bg-neutral-900 p-1">
        {([
          { v: "cli" as Kind,     label: "🖥  CLI (terminal)" },
          { v: "desktop" as Kind, label: "🪟  Desktop App (GUI)" },
        ]).map(k => (
          <button
            key={k.v}
            onClick={() => setKind(k.v)}
            className={
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors " +
              (kind === k.v
                ? "bg-orange-500 text-white"
                : "text-neutral-400 hover:text-neutral-100")
            }
          >
            {k.label}
          </button>
        ))}
      </div>

      {kind === "cli" && data && (
        <p className="mb-4 text-xs text-neutral-500">
          CLI sürüm: <span className="font-mono text-neutral-300">{data.version}</span> ·
          Repo: <span className="font-mono text-neutral-300">{data.repo}</span> ·
          API: <span className="font-mono text-neutral-300">{data.apiBase}</span>
        </p>
      )}
      {kind === "desktop" && desktop && (
        <p className="mb-4 text-xs text-neutral-500">
          Desktop sürüm: <span className="font-mono text-neutral-300">{desktop.version}</span> ·
          Repo: <span className="font-mono text-neutral-300">{desktop.repo}</span> ·
          Otomatik güncellenir (Tauri updater)
        </p>
      )}

      {error && <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">Setup verisi yüklenemedi: {error}</p>}

      {/* OS sekmeleri */}
      <div className="flex gap-2 border-b border-neutral-800">
        {(["macos", "linux", "windows"] as Os[]).map(o => (
          <button
            key={o}
            onClick={() => {
              setOs(o);
              const first = data?.assets.find(a => a.os === o)?.arch;
              if (first) setArch(first);
            }}
            className={
              "rounded-t-md border-b-2 px-4 py-2 text-sm transition-colors " +
              (os === o
                ? "border-orange-500 text-orange-400"
                : "border-transparent text-neutral-400 hover:text-neutral-200")
            }
          >
            {OS_LABEL[o]}
          </button>
        ))}
      </div>

      {/* Arch seçimi */}
      {archOptions.length > 1 && (
        <div className="mt-4 flex gap-2">
          {archOptions.map(a => (
            <button
              key={a}
              onClick={() => setArch(a)}
              className={
                "rounded-md border px-3 py-1 text-xs " +
                (arch === a
                  ? "border-orange-500 bg-orange-500/10 text-orange-300"
                  : "border-neutral-800 text-neutral-400 hover:border-neutral-700")
              }
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {/* Install komutu — CLI */}
      {kind === "cli" && asset && (
        <section className="mt-6 space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-300">1. Tek-satır kurulum</h2>
              <button
                onClick={() => copy(asset.installScript, "install")}
                className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
              >
                {copied === "install" ? "Kopyalandı ✓" : "Kopyala"}
              </button>
            </div>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-neutral-800 bg-[#0a0a0a] p-4 font-mono text-xs leading-6 text-neutral-100">
{asset.installScript}
            </pre>
            <p className="mt-2 text-xs text-neutral-500">
              Yukarıdaki komut binary'yi {os === "windows" ? "%LOCALAPPDATA%\\Altaris\\altaris.exe" : os === "linux" ? "/usr/local/bin/altaris" : "~/.local/bin/altaris"} altına kurar.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-300">2. Bağlan</h2>
              <button
                onClick={() => copy(asset.postInstallHint, "post")}
                className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
              >
                {copied === "post" ? "Kopyalandı ✓" : "Kopyala"}
              </button>
            </div>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-neutral-800 bg-[#0a0a0a] p-4 font-mono text-xs leading-6 text-neutral-100">
{asset.postInstallHint}
            </pre>
            <p className="mt-2 text-xs text-neutral-500">
              Tarayıcıda Keycloak'tan giriş yap, doğrulama kodunu CLI'a yapıştır. Token ~/.altaris/credentials.json altında 7 gün geçerli kalır.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-neutral-300">3. Direkt indirme</h2>
            <p className="mt-2 text-xs text-neutral-500">
              Kurulum scripti çalışmazsa binary'yi elle indir:
            </p>
            <a
              href={asset.downloadUrl}
              className="mt-2 inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm text-orange-400 hover:bg-neutral-800"
            >
              ↓ {asset.filename}
            </a>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-neutral-300">4. İlk komutlar</h2>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-neutral-800 bg-[#0a0a0a] p-4 font-mono text-xs leading-6 text-neutral-100">
{`altaris login                           # Keycloak SSO ile giriş (haftada bir)
altaris vault list                      # senin kasalarının listesi
altaris vault create proje-alpha \\
  --name "Proje Alpha"                  # yeni vault + lokal mirror
altaris vault use proje-alpha           # vault dizininde interactive aç
altaris --remote-control                # web'den izlenebilir mod (broadcast)
altaris update                          # son sürümü GitHub'dan çek + atomik replace`}
            </pre>
          </div>
        </section>
      )}

      {/* Desktop App */}
      {kind === "desktop" && desktop && (
        <section className="mt-6 space-y-6">
          {desktopAsset ? (
            <>
              <div>
                <h2 className="text-sm font-semibold text-neutral-300">1. İndir</h2>
                <a
                  href={desktopAsset.downloadUrl}
                  className="mt-2 inline-flex items-center gap-3 rounded-md border border-orange-500/30 bg-orange-500/5 px-6 py-3 text-sm font-medium text-orange-400 hover:bg-orange-500/10"
                >
                  <span className="text-2xl">⬇</span>
                  <span>
                    <span className="block">{desktopAsset.filename}</span>
                    <span className="text-[11px] text-neutral-500">{OS_LABEL[os as Os] ?? os} · {desktopAsset.arch}</span>
                  </span>
                </a>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-neutral-300">2. Kur</h2>
                <pre className="mt-2 overflow-x-auto rounded-lg border border-neutral-800 bg-[#0a0a0a] p-4 font-mono text-xs leading-6 text-neutral-100">{desktopAsset.installHint}</pre>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-neutral-300">3. Bağlan</h2>
                <p className="mt-2 text-xs text-neutral-400">
                  Altaris'i aç → "Giriş yap" butonu → tarayıcı Keycloak'a düşer →
                  6-haneli kodu onayla → uygulamaya geri dönersin. 2FA kuruluysa
                  giriş sırasında 6-digit TOTP istenir.
                </p>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-neutral-300">Otomatik güncelleme</h2>
                <p className="mt-2 text-xs text-neutral-400">
                  Yeni sürüm yayımlandığında uygulama bunu kendisi tespit eder
                  ({" "}<code className="font-mono text-neutral-300">latest.json</code>{" "}
                  manifest takip eder) ve "Yeni sürüm var, indirilsin mi?" sorar.
                  Manuel kurulum gerekmez.
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-500">Bu OS için desktop release henüz yok.</p>
          )}

          <div>
            <h2 className="text-sm font-semibold text-neutral-300">Tüm platformlar</h2>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {desktop.assets.map(a => (
                <a
                  key={a.filename}
                  href={a.downloadUrl}
                  className="flex items-center gap-3 rounded-md border border-neutral-800 bg-neutral-900/40 p-3 text-xs text-neutral-300 hover:bg-neutral-800"
                >
                  <span className="rounded bg-neutral-800 px-2 py-1 font-mono uppercase">{a.os}/{a.arch}</span>
                  <span className="truncate">{a.filename}</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {kind === "desktop" && !desktop && (
        <p className="mt-6 text-sm text-neutral-500">
          Desktop App release'i henüz yapılmadı.
          <br />
          <code className="font-mono text-xs text-neutral-400">git tag v0.1.0-beta.6-desktop && git push --tags</code>
          {" "}komutuyla pipeline'ı tetikle.
        </p>
      )}
    </main>
  );
}
