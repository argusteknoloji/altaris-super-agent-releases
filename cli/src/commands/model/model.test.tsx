import { afterEach, expect, mock, test } from 'bun:test'

import { getAdditionalModelOptionsCacheScope } from '../../services/api/providerConfig.js'
import { getAPIProvider } from '../../utils/model/providers.js'

const originalEnv = {
  ALTARIS_USE_OPENAI: process.env.ALTARIS_USE_OPENAI,
  ALTARIS_USE_GEMINI: process.env.ALTARIS_USE_GEMINI,
  ALTARIS_USE_GITHUB: process.env.ALTARIS_USE_GITHUB,
  ALTARIS_USE_MISTRAL: process.env.ALTARIS_USE_MISTRAL,
  ALTARIS_USE_BEDROCK: process.env.ALTARIS_USE_BEDROCK,
  ALTARIS_USE_VERTEX: process.env.ALTARIS_USE_VERTEX,
  ALTARIS_USE_FOUNDRY: process.env.ALTARIS_USE_FOUNDRY,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_API_BASE: process.env.OPENAI_API_BASE,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
}

afterEach(() => {
  mock.restore()
  process.env.ALTARIS_USE_OPENAI = originalEnv.ALTARIS_USE_OPENAI
  process.env.ALTARIS_USE_GEMINI = originalEnv.ALTARIS_USE_GEMINI
  process.env.ALTARIS_USE_GITHUB = originalEnv.ALTARIS_USE_GITHUB
  process.env.ALTARIS_USE_MISTRAL = originalEnv.ALTARIS_USE_MISTRAL
  process.env.ALTARIS_USE_BEDROCK = originalEnv.ALTARIS_USE_BEDROCK
  process.env.ALTARIS_USE_VERTEX = originalEnv.ALTARIS_USE_VERTEX
  process.env.ALTARIS_USE_FOUNDRY = originalEnv.ALTARIS_USE_FOUNDRY
  process.env.OPENAI_BASE_URL = originalEnv.OPENAI_BASE_URL
  process.env.OPENAI_API_BASE = originalEnv.OPENAI_API_BASE
  process.env.OPENAI_MODEL = originalEnv.OPENAI_MODEL
})

test('opens the model picker without awaiting local model discovery refresh', async () => {
  process.env.ALTARIS_USE_OPENAI = '1'
  delete process.env.ALTARIS_USE_GEMINI
  delete process.env.ALTARIS_USE_GITHUB
  delete process.env.ALTARIS_USE_MISTRAL
  delete process.env.ALTARIS_USE_BEDROCK
  delete process.env.ALTARIS_USE_VERTEX
  delete process.env.ALTARIS_USE_FOUNDRY
  delete process.env.OPENAI_API_BASE
  process.env.OPENAI_BASE_URL = 'http://127.0.0.1:8080/v1'
  process.env.OPENAI_MODEL = 'qwen2.5-coder-7b-instruct'

  let resolveDiscovery: (() => void) | undefined
  const discoverOpenAICompatibleModelOptions = mock(
    () =>
      new Promise<void>(resolve => {
        resolveDiscovery = resolve
      }),
  )

  mock.module('../../utils/model/openaiModelDiscovery.js', () => ({
    discoverOpenAICompatibleModelOptions,
  }))

  expect(getAdditionalModelOptionsCacheScope()).toBe('openai:http://127.0.0.1:8080/v1')

  const { call } = await import('./model.js')
  const result = await Promise.race([
    call(() => {}, {} as never, ''),
    new Promise(resolve => setTimeout(() => resolve('timeout'), 50)),
  ])

  resolveDiscovery?.()

  expect(result).not.toBe('timeout')
})
