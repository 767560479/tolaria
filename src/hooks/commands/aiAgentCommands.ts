import {
  isVaultAiGuidanceStatusChecking,
  vaultAiGuidanceNeedsRestore,
  type VaultAiGuidanceStatus,
} from '../../lib/vaultAiGuidance'
import type { CommandAction } from './types'

interface AiAgentCommandsConfig {
  aiFeaturesEnabled?: boolean
  vaultAiGuidanceStatus?: VaultAiGuidanceStatus
  onRestoreVaultAiGuidance?: () => void
}

function restoreGuidanceCommands({
  vaultAiGuidanceStatus,
  onRestoreVaultAiGuidance,
}: Pick<AiAgentCommandsConfig, 'vaultAiGuidanceStatus' | 'onRestoreVaultAiGuidance'>): CommandAction[] {
  if (!vaultAiGuidanceStatus || !onRestoreVaultAiGuidance) return []
  if (isVaultAiGuidanceStatusChecking(vaultAiGuidanceStatus)) return []
  if (!vaultAiGuidanceNeedsRestore(vaultAiGuidanceStatus)) return []

  return [
    {
      id: 'restore-vault-ai-guidance',
      label: 'Restore Tolaria AI Guidance',
      group: 'Settings',
      keywords: ['ai', 'guidance', 'restore', 'repair', 'agents'],
      enabled: true,
      execute: () => onRestoreVaultAiGuidance(),
    },
  ]
}

export function buildAiAgentCommands({
  aiFeaturesEnabled = true,
  vaultAiGuidanceStatus,
  onRestoreVaultAiGuidance,
}: AiAgentCommandsConfig): CommandAction[] {
  if (!aiFeaturesEnabled) return []

  return restoreGuidanceCommands({
    vaultAiGuidanceStatus,
    onRestoreVaultAiGuidance,
  })
}
