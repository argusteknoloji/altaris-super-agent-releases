import { afterEach, beforeEach, expect, test } from 'bun:test'

import { saveGlobalConfig } from '../config.js'
import { getDefaultMainLoopModelSetting, getUserSpecifiedModelSetting } from './model.js'

const env = {
  ALTARIS_USE_GITHUB: process.env.ALTARIS_USE_GITHUB,
  ALTARIS_USE_OPENAI: process.env.ALTARIS_USE_OPENAI,
  ALTARIS_USE_GEMINI: process.env.ALTARIS_USE_GEMINI,
  ALTARIS_USE_BEDROCK: process.env.ALTARIS_USE_BEDROCK,
  ALTARIS_USE_VERTEX: process.env.ALTARIS_USE_VERTEX,
  ALTARIS_USE_FOUNDRY: process.env.ALTARIS_USE_FOUNDRY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
}

beforeEach(() => {
  process.env.ALTARIS_USE_GITHUB = '1'
  delete process.env.ALTARIS_USE_OPENAI
  delete process.env.ALTARIS_USE_GEMINI
  delete process.env.ALTARIS_USE_BEDROCK
  delete process.env.ALTARIS_USE_VERTEX
  delete process.env.ALTARIS_USE_FOUNDRY
  delete process.env.OPENAI_MODEL
  saveGlobalConfig(current => ({
    ...current,
    model: ({ bad: true } as unknown) as string,
  }))
})

afterEach(() => {
  process.env.ALTARIS_USE_GITHUB = env.ALTARIS_USE_GITHUB
  process.env.ALTARIS_USE_OPENAI = env.ALTARIS_USE_OPENAI
  process.env.ALTARIS_USE_GEMINI = env.ALTARIS_USE_GEMINI
  process.env.ALTARIS_USE_BEDROCK = env.ALTARIS_USE_BEDROCK
  process.env.ALTARIS_USE_VERTEX = env.ALTARIS_USE_VERTEX
  process.env.ALTARIS_USE_FOUNDRY = env.ALTARIS_USE_FOUNDRY
  process.env.OPENAI_MODEL = env.OPENAI_MODEL
  saveGlobalConfig(current => ({
    ...current,
    model: undefined,
  }))
})

test('github default model setting ignores non-string saved model', () => {
  const model = getDefaultMainLoopModelSetting()
  expect(typeof model).toBe('string')
  expect(model).not.toBe('[object Object]')
  expect(model.length).toBeGreaterThan(0)
})

test('user specified model ignores non-string saved model', () => {
  const model = getUserSpecifiedModelSetting()
  if (model !== undefined && model !== null) {
    expect(typeof model).toBe('string')
    expect(model).not.toBe('[object Object]')
  }
})
