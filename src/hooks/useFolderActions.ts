import type { FolderNode, SidebarSelection, VaultEntry } from '../types'
import type { FolderTab } from './folder-actions/folderActionUtils'
import { useFolderDelete } from './folder-actions/useFolderDelete'
import { useFolderDuplicate } from './folder-actions/useFolderDuplicate'
import { useFolderMove } from './folder-actions/useFolderMove'
import { useFolderRename } from './folder-actions/useFolderRename'

interface UseFolderActionsInput {
  vaultPath: string
  folders: FolderNode[]
  selection: SidebarSelection
  setSelection: (selection: SidebarSelection) => void
  setTabs: React.Dispatch<React.SetStateAction<FolderTab[]>>
  activeTabPathRef: React.MutableRefObject<string | null>
  handleSwitchTab: (path: string) => void
  closeAllTabs: () => void
  reloadVault: () => Promise<VaultEntry[]>
  reloadFolders: () => Promise<FolderNode[]>
  setToastMessage: (message: string | null) => void
}

export function useFolderActions({
  vaultPath,
  folders,
  selection,
  setSelection,
  setTabs,
  activeTabPathRef,
  handleSwitchTab,
  closeAllTabs,
  reloadVault,
  reloadFolders,
  setToastMessage,
}: UseFolderActionsInput) {
  const renameActions = useFolderRename({
    activeTabPathRef,
    handleSwitchTab,
    reloadFolders,
    reloadVault,
    selection,
    setSelection,
    setTabs,
    setToastMessage,
    vaultPath,
  })
  const deleteActions = useFolderDelete({
    activeTabPathRef,
    clearFolderRename: renameActions.cancelFolderRename,
    closeAllTabs,
    reloadFolders,
    reloadVault,
    selection,
    setSelection,
    setTabs,
    setToastMessage,
    vaultPath,
  })
  const moveActions = useFolderMove({
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
  })
  const duplicateActions = useFolderDuplicate({
    reloadFolders,
    reloadVault,
    setSelection,
    setToastMessage,
    vaultPath,
  })

  return {
    ...renameActions,
    ...deleteActions,
    ...moveActions,
    ...duplicateActions,
  }
}
