import { describe, expect, it } from 'vitest'
import {
  LOCAL_AI_PROVIDER_KINDS,
  aiModelProviderCatalog,
  aiModelProviderCatalogEntry,
  aiTargetCanQueuePrompt,
  aiTargetReady,
  configuredModelTargets,
  createMissingModelTarget,
  isLocalAiProvider,
  isMissingModelTarget,
  modelTargetId,
  normalizeAiModelProviders,
  resolveAiTarget,
  resolveAiTargetReadiness,
  type AiModelProvider,
} from './aiTargets'
import type { Settings } from '../types'

function provider(kind: AiModelProvider['kind']): AiModelProvider {
  return {
    id: ' Demo ',
    name: ' Demo Provider ',
    kind,
    base_url: ' https://example.com/v1 ',
    api_key_storage: null,
    api_key_env_var: ' DEMO_API_KEY ',
    headers: null,
    models: [{
      id: ' demo-model ',
      display_name: ' Demo Model ',
      context_window: null,
      max_output_tokens: null,
      capabilities: {
        streaming: true,
        tools: false,
        vision: false,
        json_mode: true,
        reasoning: false,
      },
    }],
  }
}

function resolveTarget(settings: Partial<Settings>): ReturnType<typeof resolveAiTarget> {
  return resolveAiTarget(settings as Settings)
}

describe('ai target provider contract', () => {
  it('resolves a configured api model target from settings', () => {
    const providers = normalizeAiModelProviders([provider('open_ai')])
    const targetId = modelTargetId(providers[0].id, providers[0].models[0].id)
    const target = resolveTarget({
      ai_model_providers: providers,
      default_ai_target: targetId,
    })

    expect(target).toMatchObject({
      kind: 'api_model',
      id: targetId,
      label: 'Demo Provider · Demo Model',
    })
  })

  it('ignores legacy agent defaults and falls back to the first configured model', () => {
    const providers = normalizeAiModelProviders([provider('anthropic')])
    const target = resolveTarget({
      ai_model_providers: providers,
      default_ai_agent: 'claude_code',
      default_ai_target: 'agent:claude_code',
    })

    expect(configuredModelTargets(providers)[0]).toMatchObject(target)
  })

  it('returns a missing sentinel when no models are configured', () => {
    const target = resolveTarget({ ai_model_providers: [] })

    expect(isMissingModelTarget(target)).toBe(true)
    expect(createMissingModelTarget()).toEqual(target)
  })

  it('reports readiness for configured and missing model targets', () => {
    const configured = configuredModelTargets(normalizeAiModelProviders([provider('open_ai')]))[0]
    const missing = createMissingModelTarget()

    expect(resolveAiTargetReadiness(configured)).toEqual({
      readiness: 'ready',
      ready: true,
      canQueuePrompt: true,
    })
    expect(resolveAiTargetReadiness(configured, { settingsLoaded: false })).toEqual({
      readiness: 'checking',
      ready: false,
      canQueuePrompt: true,
    })
    expect(resolveAiTargetReadiness(missing)).toEqual({
      readiness: 'missing',
      ready: false,
      canQueuePrompt: false,
    })
    expect(aiTargetReady(configured)).toBe(true)
    expect(aiTargetCanQueuePrompt(missing)).toBe(false)
  })

  it('keeps provider defaults in one catalog with stable grouping metadata', () => {
    const entries = aiModelProviderCatalog()
    const kinds = entries.map((entry) => entry.kind)

    expect(kinds).toEqual([
      'ollama',
      'lm_studio',
      'open_ai',
      'anthropic',
      'gemini',
      'open_router',
      'open_ai_compatible',
    ])
    expect(new Set(kinds).size).toBe(kinds.length)
    expect(LOCAL_AI_PROVIDER_KINDS).toEqual(['ollama', 'lm_studio'])
    expect(aiModelProviderCatalogEntry('anthropic')).toMatchObject({
      name: 'Anthropic',
      base_url: 'https://api.anthropic.com/v1',
      api_key_storage: 'local_file',
      api_key_env_var: 'ANTHROPIC_API_KEY',
      default_model_id: 'claude-3-5-sonnet-latest',
      local: false,
    })
    expect(aiModelProviderCatalogEntry('open_ai_compatible')).toMatchObject({
      base_url: 'https://api.example.com/v1',
      api_key_env_var: 'OPENAI_API_KEY',
      local: false,
    })
  })

  it('normalizes saved providers while using the catalog for local/provider classification', () => {
    const normalized = normalizeAiModelProviders([
      provider('open_ai_compatible'),
      { ...provider('ollama'), id: ' ', name: 'Missing ID' },
    ])

    expect(normalized).toHaveLength(1)
    expect(normalized[0]).toMatchObject({
      id: 'demo',
      name: 'Demo Provider',
      base_url: 'https://example.com/v1',
      api_key_env_var: 'DEMO_API_KEY',
      api_key_storage: 'env',
    })
    expect(normalized[0].models[0]).toMatchObject({
      id: 'demo-model',
      display_name: 'Demo Model',
    })
    expect(isLocalAiProvider(provider('lm_studio'))).toBe(true)
    expect(isLocalAiProvider(provider('open_router'))).toBe(false)
  })
})
