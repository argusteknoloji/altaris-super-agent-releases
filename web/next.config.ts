import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// ── Build-time constants ──────────────────────────────────────────────────
// Sürüm + build numarası + git SHA + build timestamp. TopNav'da rozet ile
// gösterilir; her deploy'da yeni numara → kullanıcı hangi sürümün canlı
// olduğunu anında görür. Build numarası CI'da otomatik artar
// (GITHUB_RUN_NUMBER), lokal dev'de commit sayısı.
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
  // CI'da: GITHUB_RUN_NUMBER her workflow run'da +1 (kalıcı, deterministik).
  // Lokal: git commit count → her commit'le artar, package.json'a el sürmeden
  // versiyon otomatik ilerler.
  if (process.env.GITHUB_RUN_NUMBER) return process.env.GITHUB_RUN_NUMBER;
  try { return execSync("git rev-list --count HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
  catch { return "0"; }
}
const PKG_VERSION   = readPkgVersion();
const BUILD_NUMBER  = readBuildNumber();
// SemVer build metadata (+ ile ayrılır, sürüm sırasını etkilemez)
const BUILD_VERSION = `${PKG_VERSION}+build.${BUILD_NUMBER}`;
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
