#!/usr/bin/env bun
/**
 * Altaris CLI — local cross-compile.
 * Produces single-file native binaries for all supported targets.
 *
 * Usage:
 *   bun run release            # all targets
 *   bun run release darwin     # only macOS
 *   bun run release linux      # only Linux
 */

import { mkdir, chmod, stat } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";

const ROOT = join(import.meta.dir, "..");
const DIST = join(ROOT, "dist", "cli.mjs");
const RELEASE = join(ROOT, "release");

const TARGETS = [
  { id: "bun-darwin-arm64", file: "altaris-darwin-arm64" },
  { id: "bun-darwin-x64",   file: "altaris-darwin-x64" },
  { id: "bun-linux-x64",    file: "altaris-linux-x64" },
  { id: "bun-linux-arm64",  file: "altaris-linux-arm64" },
  { id: "bun-windows-x64",  file: "altaris-windows-x64.exe" }
];

const filter = process.argv[2];
const selected = filter ? TARGETS.filter(t => t.id.includes(filter)) : TARGETS;
if (selected.length === 0) {
  console.error(`No targets match "${filter}". Known: ${TARGETS.map(t => t.id).join(", ")}`);
  process.exit(1);
}

await mkdir(RELEASE, { recursive: true });

// Ensure dist/cli.mjs exists
try { await stat(DIST); }
catch {
  console.log("dist/cli.mjs missing → running bun run build first");
  await $`bun run build`.cwd(ROOT);
}

for (const t of selected) {
  const out = join(RELEASE, t.file);
  console.log(`▸ ${t.id} → ${t.file}`);
  await $`bun build --compile --minify --sourcemap --target=${t.id} ${DIST} --outfile ${out}`.cwd(ROOT);
  if (!t.file.endsWith(".exe")) {
    try { await chmod(out, 0o755); } catch {}
  }
  const s = await stat(out);
  console.log(`  ✓ ${(s.size / 1024 / 1024).toFixed(1)} MB`);
}

console.log(`\nDone. Binaries in ${RELEASE}/`);
