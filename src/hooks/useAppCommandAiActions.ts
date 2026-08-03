import { useMemo } from 'react'

interface AppCommandDialogs {
  toggleAIChat: () => void
}

interface AppCommandAiActions {
  aiFeaturesEnabled: boolean
  onToggleAIChat?: () => void
}

export function useAppCommandAiActions(
  aiFeaturesEnabled: boolean,
  dialogs: AppCommandDialogs,
): AppCommandAiActions {
  return useMemo(() => {
    if (!aiFeaturesEnabled) return { aiFeaturesEnabled: false }

    return {
      aiFeaturesEnabled: true,
      onToggleAIChat: dialogs.toggleAIChat,
    }
  }, [aiFeaturesEnabled, dialogs.toggleAIChat])
}
