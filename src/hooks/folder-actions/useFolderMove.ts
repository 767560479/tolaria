import { useCallback, useMemo, useState } from 'react'
import type { RetargetOption } from '../../components/note-retargeting/RetargetNoteDialog'
import type { FolderNode, SidebarSelection, VaultEntry } from '../../types'
import { trackEvent } from '../../lib/telemetry'
import {
  flattenRetargetFolders,
  normalizeRetargetFolderPath,
  prependVaultRootFolderDestination,
} from '../../utils/noteRetargetingPaths'
import {
  folderLabel,
  invokeMoveFolder,
  isWithinPrefix,
  type FolderTab,
  updateSelectionAfterFolderRename,
  updateTabsAfterFolderRename,
} from './folderActionUtils'

interface UseFolderMoveInput {
  activeTabPathRef: React.MutableRefObject<string | null>
  folders: FolderNode[]
  handleSwitchTab: (path: string) => void
  reloadFolders: () => Promise<unknown>
  reloadVault: () => Promise<VaultEntry[]>
  selection: SidebarSelection
  setSelection: (selection: SidebarSelection) => void
  setTabs: React.Dispatch<React.SetStateAction<FolderTab[]>>
  setToastMessage: (message: string | null) => void
  vaultPath: string
}

function parentFolderPath(folderPath: string): string {
  const normalized = normalizeRetargetFolderPath(folderPath)
  const slash = normalized.lastIndexOf('/')
  return slash >= 0 ? normalized.slice(0, slash) : ''
}

function isValidFolderMoveDestination(sourcePath: string, destParent: string): boolean {
  const source = normalizeRetargetFolderPath(sourcePath)
  const dest = normalizeRetargetFolderPath(destParent)
  if (!source) return false
  if (isWithinPrefix({ path: dest, prefix: source })) return false
  return true
}

export function useFolderMove({
  activeTabPathRef,
  folders,
  handleSwitchTab,
  reloadFolders,
  reloadVault,
  selection,
  setSelection,
  setTabs,
  setToastMessage,
  vaultPath,
}: UseFolderMoveInput) {
  const [movingFolderPath, setMovingFolderPath] = useState<string | null>(null)

  const openMoveFolderDialog = useCallback((folderPath: string) => {
    if (!folderPath) return
    setMovingFolderPath(folderPath)
  }, [])

  const closeMoveFolderDialog = useCallback(() => setMovingFolderPath(null), [])

  const moveFolderOptions = useMemo<RetargetOption[]>(() => {
    if (!movingFolderPath) return []
    const source = normalizeRetargetFolderPath(movingFolderPath)
    const currentParent = parentFolderPath(source)
    return prependVaultRootFolderDestination(flattenRetargetFolders(folders), vaultPath)
      .filter((folder) => isValidFolderMoveDestination(source, folder.path))
      .map((folder) => ({
        id: folder.path,
        label: folder.label,
        detail: folder.path === folder.label ? undefined : (folder.path || undefined),
        current: folder.path === currentParent,
      }))
  }, [folders, movingFolderPath, vaultPath])

  const moveFolderToParent = useCallback(async (destParentRelative: string) => {
    if (!movingFolderPath) return false
    try {
      const renameResult = await invokeMoveFolder({
        vaultPath,
        folderPath: movingFolderPath,
        destParentRelative,
      })
      trackEvent('folder_moved')
      setMovingFolderPath(null)
      await reloadFolders()
      const refreshedEntries = await reloadVault()
      updateTabsAfterFolderRename({
        activeTabPathRef,
        handleSwitchTab,
        refreshedEntries,
        renameResult,
        setTabs,
        vaultPath,
      })
      updateSelectionAfterFolderRename({
        refreshedEntries,
        renameResult,
        selection,
        setSelection,
        vaultPath,
      })
      const destinationLabel = renameResult.new_path || vaultPath
      setToastMessage(`Moved folder to "${destinationLabel}"`)
      return true
    } catch (error) {
      setToastMessage(`Failed to move folder: ${error}`)
      return false
    }
  }, [
    activeTabPathRef,
    handleSwitchTab,
    movingFolderPath,
    reloadFolders,
    reloadVault,
    selection,
    setSelection,
    setTabs,
    setToastMessage,
    vaultPath,
  ])

  return {
    closeMoveFolderDialog,
    movingFolderLabel: movingFolderPath ? folderLabel({ folderPath: movingFolderPath }) : null,
    movingFolderPath,
    moveFolderOptions,
    moveFolderToParent,
    openMoveFolderDialog,
  }
}
