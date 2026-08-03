import { useCallback, useMemo, useState } from 'react'
import type { AiAgentId, AiAgentReadiness } from '../lib/aiAgents'
import type { AiTarget } from '../lib/aiTargets'
import type { AppLocale } from '../lib/i18n'
import { useCliAiAgent, type AgentFileCallbacks } from '../hooks/useCliAiAgent'
import type { VaultEntry } from '../types'
import {
  type NoteListItem,
  type NoteReference,
} from '../utils/ai-context'
import { useAiPanelContextSnapshot } from './useAiPanelContextSnapshot'

interface UseAiPanelControllerArgs {
  vaultPath: string
  vaultPaths?: string[]
  defaultAiAgent: AiAgentId
  defaultAiTarget?: AiTarget
  defaultAiAgentReady: boolean
  defaultAiAgentReadiness?: AiAgentReadiness
  activeEntry?: VaultEntry | null
  activeNoteContent?: string | null
  entries?: VaultEntry[]
  openTabs?: VaultEntry[]
  noteList?: NoteListItem[]
  noteListFilter?: { type: string | null; query: string }
  locale?: AppLocale
  model?: string
  onOpenNote?: (path: string) => void
  onFileCreated?: (relativePath: string) => void
  onFileModified?: (relativePath: string) => void
  onVaultChanged?: () => void
  sessionId?: string
}

export interface AiPanelController {
  agent: ReturnType<typeof useCliAiAgent>
  input: string
  setInput: React.Dispatch<React.SetStateAction<string>>
  linkedEntries: ReturnType<typeof useAiPanelContextSnapshot>['linkedEntries']
  hasContext: boolean
  isActive: boolean
  handleSend: (text: string, references: NoteReference[]) => void
  handleStop: () => void
  handleNavigateWikilink: (target: string) => void
  handleNewChat: () => void
}

function resolveAgentReady(
  readiness: AiAgentReadiness | undefined,
  ready: boolean,
): boolean {
  return (readiness ?? (ready ? 'ready' : 'missing')) === 'ready'
}

function useAgentFileCallbacks({
  onFileCreated,
  onFileModified,
  onVaultChanged,
}: Pick<
  UseAiPanelControllerArgs,
  'onFileCreated' | 'onFileModified' | 'onVaultChanged'
>): AgentFileCallbacks {
  return useMemo<AgentFileCallbacks>(() => ({
    onFileCreated,
    onFileModified,
    onVaultChanged,
  }), [onFileCreated, onFileModified, onVaultChanged])
}

function usePanelAgent({
  vaultPath,
  vaultPaths,
  contextPrompt,
  defaultAiAgent,
  defaultAiTarget,
  defaultAiAgentReady,
  defaultAiAgentReadiness,
  locale,
  model,
  onFileCreated,
  onFileModified,
  onVaultChanged,
  sessionId,
}: Pick<
  UseAiPanelControllerArgs,
  | 'vaultPath'
  | 'vaultPaths'
  | 'defaultAiAgent'
  | 'defaultAiTarget'
  | 'defaultAiAgentReady'
  | 'defaultAiAgentReadiness'
  | 'locale'
  | 'model'
  | 'onFileCreated'
  | 'onFileModified'
  | 'onVaultChanged'
  | 'sessionId'
> & { contextPrompt?: string }) {
  const fileCallbacks = useAgentFileCallbacks({ onFileCreated, onFileModified, onVaultChanged })
  return useCliAiAgent(vaultPath, vaultPaths, contextPrompt, fileCallbacks, {
    agent: defaultAiAgent,
    model,
    target: defaultAiTarget,
    locale,
    agentReady: resolveAgentReady(defaultAiAgentReadiness, defaultAiAgentReady),
    sessionId,
  })
}

export function useAiPanelController({
  vaultPath,
  vaultPaths,
  defaultAiAgent,
  defaultAiTarget,
  defaultAiAgentReady,
  defaultAiAgentReadiness,
  activeEntry,
  activeNoteContent,
  entries,
  openTabs,
  noteList,
  noteListFilter,
  locale = 'en',
  model,
  onOpenNote,
  onFileCreated,
  onFileModified,
  onVaultChanged,
  sessionId,
}: UseAiPanelControllerArgs): AiPanelController {
  const [input, setInput] = useState('')
  const { linkedEntries, contextPrompt } = useAiPanelContextSnapshot({
    activeEntry,
    activeNoteContent,
    entries,
    input,
    openTabs,
    noteList,
    noteListFilter,
  })

  const agent = usePanelAgent({ vaultPath, vaultPaths, contextPrompt, defaultAiAgent, defaultAiTarget, defaultAiAgentReady, defaultAiAgentReadiness, locale, model, onFileCreated, onFileModified, onVaultChanged, sessionId })
  const isActive = agent.status === 'thinking' || agent.status === 'tool-executing'

  const handleSend = useCallback((text: string, references: NoteReference[]) => {
    if (!text.trim() || isActive) return
    agent.sendMessage(text, references)
    setInput('')
  }, [agent, isActive])

  const handleStop = useCallback(() => {
    if (!isActive) return
    agent.stopMessage()
  }, [agent, isActive])

  const handleNavigateWikilink = useCallback((target: string) => {
    onOpenNote?.(target)
  }, [onOpenNote])

  const handleNewChat = useCallback(() => {
    agent.clearConversation()
    setInput('')
  }, [agent])

  return {
    agent,
    input,
    setInput,
    linkedEntries,
    hasContext: !!activeEntry,
    isActive,
    handleSend,
    handleStop,
    handleNavigateWikilink,
    handleNewChat,
  }
}
