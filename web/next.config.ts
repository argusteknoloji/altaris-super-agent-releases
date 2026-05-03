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
const BUILD_VERSION = readPkgVersion();
const BUILD_SHA     = readGitSha();
const BUILD_TIME    = new Date().toISOString();

const config: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_BUILD_VERSION: BUILD_VERSION,
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
