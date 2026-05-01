import { afterEach, expect, test } from 'bun:test'

// MACRO is replaced at build time by Bun.define but not in test mode.
// Define it globally so tests that import modules using MACRO don't crash.
;(globalThis as Record<string, unknown>).MACRO = {
  VERSION: '99.0.0',
  DISPLAY_VERSION: '0.0.0-test',
  BUILD_TIME: new Date().toISOString(),
  ISSUES_EXPLAINER: 'report the issue at https://github.com/anthropics/altaris/issues',
  PACKAGE_URL: '@gitlawb/altaris',
  NATIVE_PACKAGE_URL: undefined,
}

import { clearSystemPromptSections } from './systemPromptSections.js'
import { getSystemPrompt, DEFAULT_AGENT_PROMPT } from './prompts.js'
import { CLI_SYSPROMPT_PREFIXES, getCLISyspromptPrefix } from './system.js'
import { ALTARIS_GUIDE_AGENT } from '../tools/AgentTool/built-in/altarisGuideAgent.js'
import { GENERAL_PURPOSE_AGENT } from '../tools/AgentTool/built-in/generalPurposeAgent.js'
import { EXPLORE_AGENT } from '../tools/AgentTool/built-in/exploreAgent.js'
import { PLAN_AGENT } from '../tools/AgentTool/built-in/planAgent.js'
import { STATUSLINE_SETUP_AGENT } from '../tools/AgentTool/built-in/statuslineSetup.js'

const originalSimpleEnv = process.env.ALTARIS_SIMPLE

afterEach(() => {
  process.env.ALTARIS_SIMPLE = originalSimpleEnv
  clearSystemPromptSections()
})

test('CLI identity prefixes describe Altaris instead of Altaris', () => {
  expect(getCLISyspromptPrefix()).toContain('Altaris')
  expect(getCLISyspromptPrefix()).not.toContain('Altaris')
  expect(getCLISyspromptPrefix()).not.toContain("Anthropic's official CLI for Altaris")

  for (const prefix of CLI_SYSPROMPT_PREFIXES) {
    expect(prefix).toContain('Altaris')
    expect(prefix).not.toContain('Altaris')
    expect(prefix).not.toContain("Anthropic's official CLI for Altaris")
  }
})

test('simple mode identity describes Altaris instead of Altaris', async () => {
  process.env.ALTARIS_SIMPLE = '1'

  const prompt = await getSystemPrompt([], 'gpt-4o')

  expect(prompt[0]).toContain('Altaris')
  expect(prompt[0]).not.toContain('Altaris')
  expect(prompt[0]).not.toContain("Anthropic's official CLI for Altaris")
})

test('system prompt model identity updates when model changes mid-session', async () => {
  delete process.env.ALTARIS_SIMPLE
  clearSystemPromptSections()

  const firstPrompt = await getSystemPrompt([], 'old-test-model')
  const secondPrompt = await getSystemPrompt([], 'new-test-model')

  const firstText = firstPrompt.join('\n')
  const secondText = secondPrompt.join('\n')

  expect(firstText).toContain('You are powered by the model old-test-model.')
  expect(secondText).toContain('You are powered by the model new-test-model.')
  expect(secondText).not.toContain('You are powered by the model old-test-model.')
})

test('built-in agent prompts describe Altaris instead of Altaris', () => {
  expect(DEFAULT_AGENT_PROMPT).toContain('Altaris')
  expect(DEFAULT_AGENT_PROMPT).not.toContain('Altaris')
  expect(DEFAULT_AGENT_PROMPT).not.toContain("Anthropic's official CLI for Altaris")

  const generalPrompt = GENERAL_PURPOSE_AGENT.getSystemPrompt({
    toolUseContext: { options: {} as never },
  })
  expect(generalPrompt).toContain('Altaris')
  expect(generalPrompt).not.toContain('Altaris')
  expect(generalPrompt).not.toContain("Anthropic's official CLI for Altaris")

  const explorePrompt = EXPLORE_AGENT.getSystemPrompt({
    toolUseContext: { options: {} as never },
  })
  expect(explorePrompt).toContain('Altaris')
  expect(explorePrompt).not.toContain('Altaris')
  expect(explorePrompt).not.toContain("Anthropic's official CLI for Altaris")

  const planPrompt = PLAN_AGENT.getSystemPrompt({
    toolUseContext: { options: {} as never },
  })
  expect(planPrompt).toContain('Altaris')
  expect(planPrompt).not.toContain('Altaris')

  const statuslinePrompt = STATUSLINE_SETUP_AGENT.getSystemPrompt({
    toolUseContext: { options: {} as never },
  })
  expect(statuslinePrompt).toContain('Altaris')
  expect(statuslinePrompt).not.toContain('Altaris')

  const guidePrompt = ALTARIS_GUIDE_AGENT.getSystemPrompt({
    toolUseContext: {
      options: {
        commands: [],
        agentDefinitions: { activeAgents: [] },
        mcpClients: [],
      } as never,
    },
  })
  expect(guidePrompt).toContain('Altaris')
  expect(guidePrompt).toContain('You are the Altaris guide agent.')
  expect(guidePrompt).toContain('**Altaris** (the CLI tool)')
  expect(guidePrompt).not.toContain('You are the Altaris guide agent.')
  expect(guidePrompt).not.toContain('**Altaris** (the CLI tool)')
})
