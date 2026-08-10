import { useCallback } from 'react'
import type { SidebarSelection, VaultEntry } from '../../types'
import { trackEvent } from '../../lib/telemetry'
import {
  folderLabel,
  invokeDuplicateFolder,
} from './folderActionUtils'

interface UseFolderDuplicateInput {
  reloadFolders: () => Promise<unknown>
  reloadVault: () => Promise<VaultEntry[]>
  setSelection: (selection: SidebarSelection) => void
  setToastMessage: (message: string | null) => void
  vaultPath: string
}

export function useFolderDuplicate({
  reloadFolders,
  reloadVault,
  setSelection,
  setToastMessage,
  vaultPath,
}: UseFolderDuplicateInput) {
  const duplicateFolder = useCallback(async (folderPath: string) => {
    if (!folderPath) return
    try {
      const result = await invokeDuplicateFolder({ vaultPath, folderPath })
      trackEvent('folder_duplicated')
      await reloadFolders()
      await reloadVault()
      setSelection({ kind: 'folder', path: result.new_path })
      setToastMessage(`Duplicated folder "${folderLabel({ folderPath })}"`)
    } catch (error) {
      setToastMessage(`Failed to duplicate folder: ${error}`)
    }
  }, [reloadFolders, reloadVault, setSelection, setToastMessage, vaultPath])

  return { duplicateFolder }
}
