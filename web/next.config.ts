import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// ── Build-time constants ──────────────────────────────────────────────────
// Sürüm + git SHA + build timestamp; dashboard'da küçük badge ile gösterilir
// (deploy doğrulama). Build sırasında package.json + git rev-parse okunur.
function readPkgVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync("./package.json", "utf8"));
    return pkg.version ?? "0.0.0";
  } catch { return "0.0.0"; }
}
function readGitSha(): string {
  // CI'da GITHUB_SHA env var var; lokal dev'de git komutu
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try { return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
  catch { return "dev"; }
}
function readBuildNumber(): string {
  // CI'da: GITHUB_RUN_NUMBER (web/Dockerfile build-arg ile container'a inject)
  //        her workflow run'da +1, kalıcı, deterministik.
  // Lokal: git commit count → her commit'le artar.
  //        Docker build context'inde .git .dockerignore ile hariç → fallback "0".
  if (process.env.GITHUB_RUN_NUMBER) return process.env.GITHUB_RUN_NUMBER;
  try { return execSync("git rev-list --count HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
  catch { return "0"; }
}
const PKG_VERSION  = readPkgVersion();
const BUILD_NUMBER = readBuildNumber();

// Versiyon stratejisi:
//   - package.json sadece MAJOR.MINOR'u kontrol eder (1.0.0, 1.1.0, 2.0.0).
//     Pre-release suffix (-rc.1, -beta.3) MANUEL korunur.
//   - PATCH her CI run'ında GITHUB_RUN_NUMBER'dan türetilir → her push otomatik
//     bir patch bump (1.0.85 → 1.0.86 → 1.0.87 ...). package.json'a el sürmeden
//     dashboard rozetinde versiyon ilerler.
//   - Pre-release versiyonlarda (örn 1.1.0-rc.1) MANUEL kontrol; auto-bump yok.
function deriveVersion(): string {
  // Pre-release suffix varsa olduğu gibi kullan (manuel canary/RC kontrolü).
  if (PKG_VERSION.includes("-")) return PKG_VERSION;
  // "1.0.0" → ["1", "0", "0"]; major.minor sabit, patch = build number.
  const parts = PKG_VERSION.split(".");
  if (parts.length < 2) return PKG_VERSION;
  return `${parts[0]}.${parts[1]}.${BUILD_NUMBER}`;
}
const BUILD_VERSION = deriveVersion();
const BUILD_SHA     = readGitSha();
const BUILD_TIME    = new Date().toISOString();

const config: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_BUILD_VERSION: BUILD_VERSION,
    NEXT_PUBLIC_BUILD_NUMBER:  BUILD_NUMBER,
    NEXT_PUBLIC_BUILD_SHA:     BUILD_SHA,
    NEXT_PUBLIC_BUILD_TIME:    BUILD_TIME,
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" }
  },
  async rewrites() {
    return [
      { source: "/manifesto", destination: "/manifesto/index.html" }
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }
        ]
      }
    ];
  }
};

export default config;
