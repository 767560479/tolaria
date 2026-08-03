import { describe, expect, it } from 'vitest'

import { buildAgentSystemPrompt } from './ai-agent'

describe('buildAgentSystemPrompt', () => {
  it('returns preamble when no vault context', () => {
    const prompt = buildAgentSystemPrompt()
    expect(prompt).toContain('working inside Tolaria')
    expect(prompt).toContain('active vault')
    expect(prompt).toContain("vault's AGENTS.md")
    expect(prompt).not.toContain('Vault Safe mode is active')
    expect(prompt).not.toContain('Power User mode is active')
    expect(prompt).not.toContain('Vault context')
  })

  it('appends vault context when provided', () => {
    const prompt = buildAgentSystemPrompt('Recent notes: foo, bar')
    expect(prompt).toContain('working inside Tolaria')
    expect(prompt).toContain('Vault context:')
    expect(prompt).toContain('Recent notes: foo, bar')
  })

  it('points agents to bundled Tolaria docs without shell commands', () => {
    const prompt = buildAgentSystemPrompt({ agentDocsPath: '/app/agent-docs' })

    expect(prompt).toContain('/app/agent-docs/index.md')
    expect(prompt).toContain('/app/agent-docs/pages/templates/portent.md')
    expect(prompt).toContain("Portent as Tolaria's default best-practice model")
    expect(prompt).not.toContain('ripgrep')
    expect(prompt).toContain('Prefer bundled docs over guesses')
  })

  it('instructs AI to use wikilink syntax', () => {
    const prompt = buildAgentSystemPrompt()
    expect(prompt).toContain('[[')
    expect(prompt).toMatch(/wikilink/i)
  })
})
