import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAiAgentPreferences } from './useAiAgentPreferences'
import { modelTargetId, normalizeAiModelProviders } from '../lib/aiTargets'
import type { AiModelProvider } from '../lib/aiTargets'

function provider(kind: AiModelProvider['kind']): AiModelProvider {
  return {
    id: 'demo',
    name: 'Demo Provider',
    kind,
    base_url: 'https://example.com/v1',
    api_key_storage: 'env',
    api_key_env_var: 'DEMO_API_KEY',
    headers: null,
    models: [{
      id: 'demo-model',
      display_name: 'Demo Model',
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

const providers = normalizeAiModelProviders([provider('open_ai')])
const defaultTargetId = modelTargetId(providers[0].id, providers[0].models[0].id)

const settings = {
  auto_pull_interval_minutes: 5,
  telemetry_consent: true,
  crash_reporting_enabled: false,
  analytics_enabled: false,
  anonymous_id: null,
  release_channel: 'stable',
  default_ai_agent: 'claude_code' as const,
  ai_model_providers: providers,
  default_ai_target: defaultTargetId,
}

describe('useAiAgentPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves the selected model label and readiness', () => {
    const { result } = renderHook(() => useAiAgentPreferences({
      settings,
      settingsLoaded: true,
      saveSettings: vi.fn(),
    }))

    expect(result.current.defaultAiAgent).toBe('claude_code')
    expect(result.current.defaultAiAgentLabel).toBe('Demo Provider · Demo Model')
    expect(result.current.defaultAiAgentReadiness).toBe('ready')
    expect(result.current.defaultAiAgentReady).toBe(true)
  })

  it('keeps the selected target unavailable while settings are loading', () => {
    const { result } = renderHook(() => useAiAgentPreferences({
      settings,
      settingsLoaded: false,
      saveSettings: vi.fn(),
    }))

    expect(result.current.defaultAiAgentReadiness).toBe('checking')
    expect(result.current.defaultAiAgentReady).toBe(false)
  })

  it('does not cycle legacy agent defaults anymore', () => {
    const saveSettings = vi.fn()
    const onToast = vi.fn()

    const { result } = renderHook(() => useAiAgentPreferences({
      settings,
      settingsLoaded: true,
      saveSettings,
      onToast,
    }))

    act(() => {
      result.current.cycleDefaultAiAgent()
    })

    expect(saveSettings).not.toHaveBeenCalled()
    expect(onToast).not.toHaveBeenCalled()
  })

  it('reports missing readiness when no api model is configured', () => {
    const { result } = renderHook(() => useAiAgentPreferences({
      settings: { ...settings, ai_model_providers: [], default_ai_target: 'agent:codex' },
      settingsLoaded: true,
      saveSettings: vi.fn(),
    }))

    expect(result.current.defaultAiAgentReady).toBe(false)
    expect(result.current.defaultAiTargetReady).toBe(false)
  })
})
