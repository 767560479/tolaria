import { useCallback, useMemo } from 'react'
import { DEFAULT_AI_AGENT } from '../lib/aiAgents'
import {
  resolveAiTargetReadiness,
  resolveAiTarget,
} from '../lib/aiTargets'
import type { Settings } from '../types'

interface UseAiAgentPreferencesArgs {
  settings: Settings
  settingsLoaded: boolean
  saveSettings: (settings: Settings) => void
  onToast?: (message: string) => void
}

export function useAiAgentPreferences({
  settings,
  settingsLoaded,
  saveSettings,
  onToast,
}: UseAiAgentPreferencesArgs) {
  const defaultAiTarget = useMemo(() => resolveAiTarget(settings), [settings])
  const defaultAiAgent = settings.default_ai_agent ?? DEFAULT_AI_AGENT

  const defaultAiAgentLabel = defaultAiTarget.label
  const defaultAiTargetReadiness = resolveAiTargetReadiness(defaultAiTarget, {
    settingsLoaded,
  })

  const setDefaultAiAgent = useCallback(() => {
    // Legacy no-op: CLI agents removed; default target is api_model only.
  }, [])

  const setDefaultAiTarget = useCallback((targetId: string) => {
    const nextSettings = { ...settings, default_ai_target: targetId }
    saveSettings(nextSettings)
    onToast?.(`Default AI target: ${resolveAiTarget(nextSettings).label}`)
  }, [onToast, saveSettings, settings])

  const cycleDefaultAiAgent = useCallback(() => {
    // Legacy no-op: CLI agents removed.
  }, [])

  return {
    defaultAiAgent,
    defaultAiTarget,
    defaultAiAgentLabel,
    defaultAiAgentReadiness: defaultAiTargetReadiness.readiness,
    defaultAiAgentReady: defaultAiTargetReadiness.ready,
    defaultAiTargetReady: defaultAiTargetReadiness.ready,
    setDefaultAiAgent,
    setDefaultAiTarget,
    cycleDefaultAiAgent,
  }
}
