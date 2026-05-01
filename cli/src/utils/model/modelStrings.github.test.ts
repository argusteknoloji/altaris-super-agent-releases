import { afterEach, expect, test } from 'bun:test'

import { resetModelStringsForTestingOnly } from '../../bootstrap/state.js'
import { parseUserSpecifiedModel } from './model.js'
import { getModelStrings } from './modelStrings.js'

const originalEnv = {
  ALTARIS_USE_GITHUB: process.env.ALTARIS_USE_GITHUB,
  ALTARIS_USE_OPENAI: process.env.ALTARIS_USE_OPENAI,
  ALTARIS_USE_GEMINI: process.env.ALTARIS_USE_GEMINI,
  ALTARIS_USE_BEDROCK: process.env.ALTARIS_USE_BEDROCK,
  ALTARIS_USE_VERTEX: process.env.ALTARIS_USE_VERTEX,
  ALTARIS_USE_FOUNDRY: process.env.ALTARIS_USE_FOUNDRY,
}

function clearProviderFlags(): void {
  delete process.env.ALTARIS_USE_GITHUB
  delete process.env.ALTARIS_USE_OPENAI
  delete process.env.ALTARIS_USE_GEMINI
  delete process.env.ALTARIS_USE_BEDROCK
  delete process.env.ALTARIS_USE_VERTEX
  delete process.env.ALTARIS_USE_FOUNDRY
}

afterEach(() => {
  process.env.ALTARIS_USE_GITHUB = originalEnv.ALTARIS_USE_GITHUB
  process.env.ALTARIS_USE_OPENAI = originalEnv.ALTARIS_USE_OPENAI
  process.env.ALTARIS_USE_GEMINI = originalEnv.ALTARIS_USE_GEMINI
  process.env.ALTARIS_USE_BEDROCK = originalEnv.ALTARIS_USE_BEDROCK
  process.env.ALTARIS_USE_VERTEX = originalEnv.ALTARIS_USE_VERTEX
  process.env.ALTARIS_USE_FOUNDRY = originalEnv.ALTARIS_USE_FOUNDRY
  resetModelStringsForTestingOnly()
})

test('GitHub provider model strings are concrete IDs', () => {
  clearProviderFlags()
  process.env.ALTARIS_USE_GITHUB = '1'

  const modelStrings = getModelStrings()

  for (const value of Object.values(modelStrings)) {
    expect(typeof value).toBe('string')
    expect(value.trim().length).toBeGreaterThan(0)
  }
})

test('GitHub provider model strings are safe to parse', () => {
  clearProviderFlags()
  process.env.ALTARIS_USE_GITHUB = '1'

  const modelStrings = getModelStrings()

  expect(() => parseUserSpecifiedModel(modelStrings.sonnet46 as any)).not.toThrow()
})
