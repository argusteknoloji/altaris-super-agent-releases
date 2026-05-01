import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const originalEnv = {
  CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
  ALTARIS_CUSTOM_OAUTH_URL: process.env.ALTARIS_CUSTOM_OAUTH_URL,
  USER_TYPE: process.env.USER_TYPE,
}

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'altaris-env-test-'))
  process.env.CLAUDE_CONFIG_DIR = tempDir
  delete process.env.ALTARIS_CUSTOM_OAUTH_URL
  delete process.env.USER_TYPE
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
  if (originalEnv.CLAUDE_CONFIG_DIR === undefined) {
    delete process.env.CLAUDE_CONFIG_DIR
  } else {
    process.env.CLAUDE_CONFIG_DIR = originalEnv.CLAUDE_CONFIG_DIR
  }
  if (originalEnv.ALTARIS_CUSTOM_OAUTH_URL === undefined) {
    delete process.env.ALTARIS_CUSTOM_OAUTH_URL
  } else {
    process.env.ALTARIS_CUSTOM_OAUTH_URL = originalEnv.ALTARIS_CUSTOM_OAUTH_URL
  }
  if (originalEnv.USER_TYPE === undefined) {
    delete process.env.USER_TYPE
  } else {
    process.env.USER_TYPE = originalEnv.USER_TYPE
  }
})

async function importFreshEnvModule() {
  return import(`./env.js?ts=${Date.now()}-${Math.random()}`)
}

// getGlobalClaudeFile — three migration branches

test('getGlobalClaudeFile: new install returns .altaris.json when neither file exists', async () => {
  const { getGlobalClaudeFile } = await importFreshEnvModule()
  expect(getGlobalClaudeFile()).toBe(join(tempDir, '.altaris.json'))
})

test('getGlobalClaudeFile: existing user keeps .altaris.json when only legacy file exists', async () => {
  writeFileSync(join(tempDir, '.altaris.json'), '{}')
  const { getGlobalClaudeFile } = await importFreshEnvModule()
  expect(getGlobalClaudeFile()).toBe(join(tempDir, '.altaris.json'))
})

test('getGlobalClaudeFile: migrated user uses .altaris.json when both files exist', async () => {
  writeFileSync(join(tempDir, '.altaris.json'), '{}')
  writeFileSync(join(tempDir, '.altaris.json'), '{}')
  const { getGlobalClaudeFile } = await importFreshEnvModule()
  expect(getGlobalClaudeFile()).toBe(join(tempDir, '.altaris.json'))
})
