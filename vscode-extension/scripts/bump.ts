/**
 * Altaris VS Code extension — version bump script.
 *
 * Behavior:
 *   - If ALTARIS_NO_VERSION_BUMP=1 → skip; print current version (lokal dev).
 *   - Otherwise → semver patch bump (0.1.0 → 0.1.1). If a prerelease tag is
 *     present (0.1.0-alpha.5), the prerelease counter is incremented instead
 *     (0.1.0-alpha.6) — mirrors cli/scripts/build.ts bumpPrerelease() pattern.
 *
 * Mirrors CLI gating semantics: CI pipeline omits the env var so each build
 * gets a fresh patch; lokal `bun run package` exports ALTARIS_NO_VERSION_BUMP=1.
 *
 * Usage:
 *   bun run scripts/bump.ts
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const pkgPath = join(here, '..', 'package.json')

/**
 * Bump the patch component of a semver string.
 *
 * Handles:
 *   - "0.1.0"            → "0.1.1"
 *   - "0.1.42"           → "0.1.43"
 *   - "0.1.0-alpha.5"    → "0.1.0-alpha.6"   (prerelease counter)
 *   - "1.2.3-beta.0"     → "1.2.3-beta.1"
 *
 * Throws on inputs that don't match either shape.
 */
export function bumpPatchVersion(v: string): string {
  // Prerelease form: <major>.<minor>.<patch>-<channel>.<n>
  const pre = v.match(/^(\d+)\.(\d+)\.(\d+)-([a-zA-Z][a-zA-Z0-9]*)\.(\d+)$/)
  if (pre) {
    const [, major, minor, patch, channel, n] = pre
    return `${major}.${minor}.${patch}-${channel}.${Number(n) + 1}`
  }

  // Plain semver: <major>.<minor>.<patch>
  const plain = v.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (plain) {
    const [, major, minor, patch] = plain
    return `${major}.${minor}.${Number(patch) + 1}`
  }

  throw new Error(`bumpPatchVersion: unrecognised semver "${v}"`)
}

function main(): void {
  const raw = readFileSync(pkgPath, 'utf-8')
  const pkg = JSON.parse(raw) as { version: string }
  const current = pkg.version

  if (process.env.ALTARIS_NO_VERSION_BUMP === '1') {
    process.stdout.write(`${current}\n`)
    return
  }

  const next = bumpPatchVersion(current)
  pkg.version = next

  // Preserve trailing newline if the original had one (most editors do).
  const trailing = raw.endsWith('\n') ? '\n' : ''
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + trailing, 'utf-8')

  process.stdout.write(`${next}\n`)
}

// Only run main() when invoked as a script, not when imported by tests.
if (import.meta.main) {
  main()
}
