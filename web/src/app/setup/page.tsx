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
  const [data, setData]   = useState<SetupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [os, setOs]       = useState<Os>("macos");
  const [arch, setArch]   = useState<Arch>("arm64");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setOs(detectOs());
    setArch(detectArch());
  }, []);

  useEffect(() => {
    fetch("/api/proxy/setup", { cache: "no-store" })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(setData)
      .catch(e => setError((e as Error).message));
  }, []);

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
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Altaris CLI kurulumu</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Lokal makinende <code className="font-mono text-orange-400">altaris</code> komutunu çalıştırmak için
          işletim sistemine uygun tek-satır kurulum komutunu kopyalayıp terminale yapıştır.
          Kurulum sonrası <code className="font-mono text-orange-400">altaris login</code> ile portal hesabınla bağlan.
        </p>
        {data && (
          <p className="mt-2 text-xs text-neutral-500">
            Sürüm: <span className="font-mono text-neutral-300">{data.version}</span> ·
            Repo: <span className="font-mono text-neutral-300">{data.repo}</span> ·
            API: <span className="font-mono text-neutral-300">{data.apiBase}</span>
          </p>
        )}
      </div>

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

      {/* Install komutu */}
      {asset && (
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
altaris --remote-control                # web'den izlenebilir mod (broadcast)`}
            </pre>
          </div>
        </section>
      )}
    </main>
  );
}
