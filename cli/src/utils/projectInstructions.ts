import { dirname, join } from 'path'

export const PRIMARY_PROJECT_INSTRUCTION_FILE = 'AGENTS.md'
export const FALLBACK_PROJECT_INSTRUCTION_FILE = 'ALTARIS.md'
// Cross-tool fallback: if neither AGENTS.md nor ALTARIS.md is in the repo
// but a CLAUDE.md is (e.g. existing Obsidian vault, project authored against
// upstream Claude Code), Altaris reads it too. Symmetric reading only — we
// don't write CLAUDE.md from our flows.
export const CROSS_TOOL_FALLBACK_INSTRUCTION_FILE = 'CLAUDE.md'

export function getProjectInstructionFilePaths(dir: string): string[] {
  return [
    join(dir, PRIMARY_PROJECT_INSTRUCTION_FILE),
    join(dir, FALLBACK_PROJECT_INSTRUCTION_FILE),
    join(dir, CROSS_TOOL_FALLBACK_INSTRUCTION_FILE),
  ]
}

export function getProjectInstructionFilePath(
  dir: string,
  existsSync: (path: string) => boolean,
): string {
  const paths = getProjectInstructionFilePaths(dir)
  for (const p of paths) {
    if (existsSync(p)) return p
  }
  // None exist — return the canonical fallback so callers that try to read
  // get a clean ENOENT they can ignore (preserves prior behaviour).
  return paths[1]
}

export function hasProjectInstructionFile(
  dir: string,
  existsSync: (path: string) => boolean,
): boolean {
  return getProjectInstructionFilePaths(dir).some(path => existsSync(path))
}

export function findProjectInstructionFilePathInAncestors(
  startDir: string,
  existsSync: (path: string) => boolean,
): string | null {
  let currentDir = startDir

  while (true) {
    if (hasProjectInstructionFile(currentDir, existsSync)) {
      return getProjectInstructionFilePath(currentDir, existsSync)
    }

    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) {
      return null
    }

    currentDir = parentDir
  }
}

export function isProjectInstructionFileName(name: string): boolean {
  return (
    name === PRIMARY_PROJECT_INSTRUCTION_FILE ||
    name === FALLBACK_PROJECT_INSTRUCTION_FILE ||
    name === CROSS_TOOL_FALLBACK_INSTRUCTION_FILE
  )
}
