import { afterEach, describe, expect, mock, test } from 'bun:test'
import * as fsPromises from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

const originalEnv = { ...process.env }
const originalArgv = [...process.argv]

async function importFreshEnvUtils() {
  return import(`./envUtils.ts?ts=${Date.now()}-${Math.random()}`)
}

async function importFreshSettings() {
  return import(`./settings/settings.ts?ts=${Date.now()}-${Math.random()}`)
}

async function importFreshLocalInstaller() {
  return import(`./localInstaller.ts?ts=${Date.now()}-${Math.random()}`)
}

afterEach(() => {
  process.env = { ...originalEnv }
  process.argv = [...originalArgv]
  mock.restore()
})

describe('Altaris paths', () => {
  test('defaults user config home to ~/.altaris', async () => {
    delete process.env.CLAUDE_CONFIG_DIR
    const { resolveClaudeConfigHomeDir } = await importFreshEnvUtils()

    expect(
      resolveClaudeConfigHomeDir({
        homeDir: homedir(),
        openClaudeExists: true,
        legacyClaudeExists: false,
      }),
    ).toBe(join(homedir(), '.altaris'))
  })

  test('falls back to ~/.altaris when legacy config exists and ~/.altaris does not', async () => {
    delete process.env.CLAUDE_CONFIG_DIR
    const { resolveClaudeConfigHomeDir } = await importFreshEnvUtils()

    expect(
      resolveClaudeConfigHomeDir({
        homeDir: homedir(),
        openClaudeExists: false,
        legacyClaudeExists: true,
      }),
    ).toBe(join(homedir(), '.altaris'))
  })

  test('uses CLAUDE_CONFIG_DIR override when provided', async () => {
    process.env.CLAUDE_CONFIG_DIR = '/tmp/custom-altaris'
    const { getClaudeConfigHomeDir, resolveClaudeConfigHomeDir } =
      await importFreshEnvUtils()

    expect(getClaudeConfigHomeDir()).toBe('/tmp/custom-altaris')
    expect(
      resolveClaudeConfigHomeDir({
        configDirEnv: '/tmp/custom-altaris',
      }),
    ).toBe('/tmp/custom-altaris')
  })

  test('project and local settings paths use .altaris', async () => {
    const { getRelativeSettingsFilePathForSource } = await importFreshSettings()

    expect(getRelativeSettingsFilePathForSource('projectSettings')).toBe(
      '.altaris/settings.json',
    )
    expect(getRelativeSettingsFilePathForSource('localSettings')).toBe(
      '.altaris/settings.local.json',
    )
  })

  test('local installer uses altaris wrapper path', async () => {
    // Force .altaris config home so the test doesn't fall back to
    // ~/.altaris when ~/.altaris doesn't exist on this machine.
    process.env.CLAUDE_CONFIG_DIR = join(homedir(), '.altaris')
    const { getLocalClaudePath } = await importFreshLocalInstaller()

    expect(getLocalClaudePath()).toBe(
      join(homedir(), '.altaris', 'local', 'altaris'),
    )
  })

  test('local installation detection matches .altaris path', async () => {
    const { isManagedLocalInstallationPath } =
      await importFreshLocalInstaller()

    expect(
      isManagedLocalInstallationPath(
        `${join(homedir(), '.altaris', 'local')}/node_modules/.bin/altaris`,
      ),
    ).toBe(true)
  })

  test('local installation detection still matches legacy .altaris path', async () => {
    const { isManagedLocalInstallationPath } =
      await importFreshLocalInstaller()

    expect(
      isManagedLocalInstallationPath(
        `${join(homedir(), '.altaris', 'local')}/node_modules/.bin/altaris`,
      ),
    ).toBe(true)
  })

  test('candidate local install dirs include both altaris and legacy altaris paths', async () => {
    const { getCandidateLocalInstallDirs } = await importFreshLocalInstaller()

    expect(
      getCandidateLocalInstallDirs({
        configHomeDir: join(homedir(), '.altaris'),
        homeDir: homedir(),
      }),
    ).toEqual([
      join(homedir(), '.altaris', 'local'),
      join(homedir(), '.altaris', 'local'),
    ])
  })

  test('legacy local installs are detected when they still expose the altaris binary', async () => {
    mock.module('fs/promises', () => ({
      ...fsPromises,
      access: async (path: string) => {
        if (
          path === join(homedir(), '.altaris', 'local', 'node_modules', '.bin', 'altaris')
        ) {
          return
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      },
    }))

    const { getDetectedLocalInstallDir, localInstallationExists } =
      await importFreshLocalInstaller()

    expect(await localInstallationExists()).toBe(true)
    expect(await getDetectedLocalInstallDir()).toBe(
      join(homedir(), '.altaris', 'local'),
    )
  })
})
