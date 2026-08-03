import { useMemo } from 'react'
import type { Settings, VaultEntry } from '../types'
import type { VaultOption } from '../components/status-bar/types'
import {
  filterEntriesToVisibleWorkspaces,
  graphWorkspaceVaultsForLoading,
  visibleWorkspacePaths,
  workspacesMountedInGraph,
  workspaceIdentityFromVault,
  writableWorkspacePaths,
} from '../utils/workspaces'

interface WorkspaceGraphConfig {
  allVaults: VaultOption[]
  defaultWorkspacePath?: string | null
  resolvedPath: string
  settings: Settings
  vaultSwitcherLoaded: boolean
  windowMode: boolean
}

interface WorkspaceGraphState {
  folderVaults?: VaultOption[]
  graphDefaultWorkspacePath: string
  graphVaults?: VaultOption[]
  inspectorWorkspaces: ReturnType<typeof workspaceIdentityFromVault>[]
  multiWorkspaceEnabled: boolean
  visibleWorkspacePathList?: string[]
  writableVaultPaths: string[]
}

interface GraphVaultParams {
  allVaults: VaultOption[]
  graphDefaultWorkspacePath: string
  windowMode: boolean
  workspaceGraphLoadingEnabled: boolean
}

interface VisibleWorkspacePathParams {
  allVaults: VaultOption[]
  graphDefaultWorkspacePath: string
  multiWorkspaceEnabled: boolean
  windowMode: boolean
}

interface InspectorWorkspaceParams {
  defaultWorkspacePath?: string | null
  graphVaults?: VaultOption[]
  multiWorkspaceEnabled: boolean
  windowMode: boolean
  writableVaultPaths: string[]
}

interface FolderVaultParams {
  allVaults: VaultOption[]
  graphDefaultWorkspacePath: string
  multiWorkspaceEnabled: boolean
  windowMode: boolean
}

function workspaceGraphDefaultPath({
  defaultWorkspacePath,
  multiWorkspaceEnabled,
  resolvedPath,
  windowMode,
}: Pick<WorkspaceGraphConfig, 'defaultWorkspacePath' | 'resolvedPath' | 'windowMode'> & {
  multiWorkspaceEnabled: boolean
}): string {
  return !windowMode && multiWorkspaceEnabled
    ? (defaultWorkspacePath ?? resolvedPath)
    : resolvedPath
}

function useGraphVaults({
  allVaults,
  graphDefaultWorkspacePath,
  windowMode,
  workspaceGraphLoadingEnabled,
}: GraphVaultParams): VaultOption[] | undefined {
  return useMemo(() => {
    if (windowMode) return undefined
    return graphWorkspaceVaultsForLoading({
      defaultVaultPath: graphDefaultWorkspacePath,
      enabled: workspaceGraphLoadingEnabled,
      vaults: allVaults,
    })
  }, [allVaults, graphDefaultWorkspacePath, windowMode, workspaceGraphLoadingEnabled])
}

function useVisibleWorkspacePathList({
  allVaults,
  graphDefaultWorkspacePath,
  multiWorkspaceEnabled,
  windowMode,
}: VisibleWorkspacePathParams): string[] | undefined {
  return useMemo(
    () => {
      if (windowMode) return undefined
      if (!multiWorkspaceEnabled) {
        return graphDefaultWorkspacePath.trim() ? [graphDefaultWorkspacePath] : undefined
      }
      return visibleWorkspacePaths({
        defaultVaultPath: graphDefaultWorkspacePath,
        enabled: true,
        vaults: allVaults,
      })
    },
    [allVaults, graphDefaultWorkspacePath, multiWorkspaceEnabled, windowMode],
  )
}

function useWritableVaultPaths(
  graphDefaultWorkspacePath: string,
  visibleWorkspacePathList?: string[],
): string[] {
  return useMemo(
    () => visibleWorkspacePathList ?? writableWorkspacePaths({
      defaultVaultPath: graphDefaultWorkspacePath,
      graphVaults: undefined,
    }),
    [graphDefaultWorkspacePath, visibleWorkspacePathList],
  )
}

function useInspectorWorkspaces({
  defaultWorkspacePath,
  graphVaults,
  multiWorkspaceEnabled,
  windowMode,
  writableVaultPaths,
}: InspectorWorkspaceParams): ReturnType<typeof workspaceIdentityFromVault>[] {
  return useMemo(() => {
    if (!multiWorkspaceEnabled || windowMode) return []
    const writablePathSet = new Set(writableVaultPaths)
    return (graphVaults ?? [])
      .filter((vault) => writablePathSet.has(vault.path))
      .map((vault) => workspaceIdentityFromVault(vault, { defaultWorkspacePath }))
  }, [defaultWorkspacePath, graphVaults, multiWorkspaceEnabled, windowMode, writableVaultPaths])
}

function useFolderVaults({
  allVaults,
  graphDefaultWorkspacePath,
  multiWorkspaceEnabled,
  windowMode,
}: FolderVaultParams): VaultOption[] | undefined {
  return useMemo(
    () => windowMode || !multiWorkspaceEnabled
      ? undefined
      : workspacesMountedInGraph({
        defaultVaultPath: graphDefaultWorkspacePath,
        vaults: allVaults,
      }),
    [allVaults, graphDefaultWorkspacePath, multiWorkspaceEnabled, windowMode],
  )
}

export function hideWorkspaceMetadata(entries: VaultEntry[]): VaultEntry[] {
  if (!entries.some((entry) => entry.workspace)) return entries
  return entries.map((entry) => entry.workspace ? { ...entry, workspace: undefined } : entry)
}

export function useWorkspaceGraphState({
  allVaults,
  defaultWorkspacePath,
  resolvedPath,
  settings,
  windowMode,
}: WorkspaceGraphConfig): WorkspaceGraphState {
  const multiWorkspaceEnabled = settings.multi_workspace_enabled === true
  const workspaceGraphLoadingEnabled = !windowMode
  const graphDefaultWorkspacePath = workspaceGraphDefaultPath({
    defaultWorkspacePath,
    multiWorkspaceEnabled,
    resolvedPath,
    windowMode,
  })
  const graphVaults = useGraphVaults({
    allVaults,
    graphDefaultWorkspacePath,
    windowMode,
    workspaceGraphLoadingEnabled,
  })
  const visibleWorkspacePathList = useVisibleWorkspacePathList({
    allVaults,
    graphDefaultWorkspacePath,
    multiWorkspaceEnabled,
    windowMode,
  })
  const writableVaultPaths = useWritableVaultPaths(graphDefaultWorkspacePath, visibleWorkspacePathList)
  const inspectorWorkspaces = useInspectorWorkspaces({
    defaultWorkspacePath,
    graphVaults,
    multiWorkspaceEnabled,
    windowMode,
    writableVaultPaths,
  })
  const folderVaults = useFolderVaults({
    allVaults,
    graphDefaultWorkspacePath,
    multiWorkspaceEnabled,
    windowMode,
  })

  return {
    folderVaults,
    graphDefaultWorkspacePath,
    graphVaults,
    inspectorWorkspaces,
    multiWorkspaceEnabled,
    visibleWorkspacePathList,
    writableVaultPaths,
  }
}

export function useVisibleWorkspaceEntries({
  entries,
  multiWorkspaceEnabled,
  visibleWorkspacePathList,
}: {
  entries: VaultEntry[]
  multiWorkspaceEnabled: boolean
  visibleWorkspacePathList?: string[]
}): VaultEntry[] {
  return useMemo(() => {
    const visibleEntries = filterEntriesToVisibleWorkspaces(entries, visibleWorkspacePathList)
    return multiWorkspaceEnabled ? visibleEntries : hideWorkspaceMetadata(visibleEntries)
  }, [entries, multiWorkspaceEnabled, visibleWorkspacePathList])
}
