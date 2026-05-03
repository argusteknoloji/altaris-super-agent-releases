/**
 *  curl -fsSL https://altaris.run/install | sh
 *
 *  POSIX shell installer that detects OS+arch (uname -s / -m), downloads the
 *  matching binary from the latest GitHub release of
 *  argusteknoloji/altaris-super-agent-releases, installs to /usr/local/bin
 *  (sudo if needed) or ~/.local/bin (fallback), then verifies version.
 *
 *  Served plain text (no caching by intermediaries) so a fresh release is
 *  picked up immediately by the next curl.
 */

const RELEASES_REPO = "argusteknoloji/altaris-super-agent-releases";
const SCRIPT = `#!/bin/sh
# Altaris CLI installer — POSIX sh
# https://altaris.run/install
set -eu

REPO="${RELEASES_REPO}"
RELEASE_BASE="https://github.com/\${REPO}/releases/latest/download"

# ── helpers ────────────────────────────────────────────────────────────
red() { printf '\\033[31m%s\\033[0m\\n' "$1" >&2; }
grn() { printf '\\033[32m%s\\033[0m\\n' "$1"; }
dim() { printf '\\033[2m%s\\033[0m\\n' "$1"; }
die() { red "✗ $1"; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "$1 yok — yükleyin ve tekrar deneyin."; }
need curl
need uname

# ── platform detect ────────────────────────────────────────────────────
OS_RAW=$(uname -s)
ARCH_RAW=$(uname -m)
case "$OS_RAW" in
  Darwin)        OS=darwin ;;
  Linux)         OS=linux ;;
  MINGW*|MSYS*|CYGWIN*) die "Windows için PowerShell installer kullanın (yakında)." ;;
  *)             die "desteklenmiyor: $OS_RAW" ;;
esac
case "$ARCH_RAW" in
  arm64|aarch64) ARCH=arm64 ;;
  x86_64|amd64)  ARCH=x64 ;;
  *)             die "desteklenmiyor: $ARCH_RAW" ;;
esac
ARTIFACT="altaris-\${OS}-\${ARCH}"
URL="\${RELEASE_BASE}/\${ARTIFACT}"

dim "→ platform: \${OS}/\${ARCH}"
dim "→ kaynak:   \${URL}"

# ── target dir (writable preferred, sudo fallback) ─────────────────────
if [ -w /usr/local/bin ] 2>/dev/null; then
  TARGET=/usr/local/bin/altaris
  SUDO=""
elif [ -d /usr/local/bin ]; then
  if command -v sudo >/dev/null 2>&1; then
    TARGET=/usr/local/bin/altaris
    SUDO="sudo"
    dim "→ /usr/local/bin için sudo şifresi istenecek"
  else
    TARGET="\${HOME}/.local/bin/altaris"
    SUDO=""
    mkdir -p "\${HOME}/.local/bin"
    dim "→ sudo yok; ~/.local/bin'e kuruluyor (PATH'inize ekleyin)"
  fi
else
  TARGET="\${HOME}/.local/bin/altaris"
  SUDO=""
  mkdir -p "\${HOME}/.local/bin"
fi

# ── download (atomic via tmpfile) ──────────────────────────────────────
TMP=$(mktemp 2>/dev/null || mktemp -t altaris-install)
trap 'rm -f "$TMP"' EXIT

dim "→ indiriliyor…"
HTTP_CODE=$(curl -fsSL -w "%{http_code}" -o "$TMP" "$URL" 2>/dev/null || true)
if [ ! -s "$TMP" ]; then
  red "✗ indirme başarısız (HTTP $HTTP_CODE)"
  red "  Henüz \${OS}/\${ARCH} için release yayınlanmamış olabilir."
  red "  Manuel: https://github.com/\${REPO}/releases/latest"
  exit 1
fi

# ── install ────────────────────────────────────────────────────────────
chmod +x "$TMP"
\${SUDO} mv "$TMP" "$TARGET"
trap - EXIT

# ── verify ─────────────────────────────────────────────────────────────
if ! command -v altaris >/dev/null 2>&1; then
  case ":$PATH:" in
    *":\${HOME}/.local/bin:"*) ;;
    *)
      red "⚠ \${TARGET} kuruldu ama PATH'inizde değil."
      red "  Şu satırı ~/.zshrc veya ~/.bashrc'ye ekleyin:"
      red "    export PATH=\\"\\\$HOME/.local/bin:\\\$PATH\\""
      ;;
  esac
fi

VER=$("$TARGET" --version 2>/dev/null || echo "?")
grn "✓ Altaris kuruldu: \${TARGET}"
grn "  versiyon: \${VER}"
echo
dim "Başlangıç:  altaris auth login --tenant <tenant>"
dim "Yardım:     altaris --help"
`;

export async function GET() {
  return new Response(SCRIPT, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
