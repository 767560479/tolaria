import {
  configuredModelTargets,
  isLocalAiProvider,
  type AiModelProvider,
  type AiModelTarget,
} from '../lib/aiTargets'

export interface AiWorkspaceTargetGroups {
  localModels: AiModelTarget[]
  apiModels: AiModelTarget[]
}

export function buildAiWorkspaceTargetGroups(
  providers: AiModelProvider[] | null | undefined,
): AiWorkspaceTargetGroups {
  const models = configuredModelTargets(providers)

  return {
    localModels: models.filter((target) => isLocalAiProvider(target.provider)),
    apiModels: models.filter((target) => !isLocalAiProvider(target.provider)),
  }
}
