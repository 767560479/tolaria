import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { VaultEntry } from '../types'
import { vaultPathForEntry } from '../utils/workspaces'
import { trackEvent } from '../lib/telemetry'

interface DuplicateNoteResult {
  new_path: string
}

function filenameFromPath(path: string): string {
  return path.split(/[/\\]/).pop() ?? path
}

async function performDuplicateNote(path: string, vaultPath: string): Promise<DuplicateNoteResult> {
  if (isTauri()) {
    return invoke<DuplicateNoteResult>('duplicate_note', { args: { vaultPath, path } })
  }
  return mockInvoke('duplicate_note', { vault_path: vaultPath, path }) as Promise<DuplicateNoteResult>
}

export function useNoteDuplicate({
  vaultPath,
  reloadVault,
  setToastMessage,
  onOpenEntry,
}: {
  vaultPath: string
  reloadVault: () => Promise<void> | void
  setToastMessage: (message: string | null) => void
  onOpenEntry: (entry: VaultEntry) => void | Promise<void>
}) {
  const handleDuplicateNote = useCallback(async (entry: VaultEntry) => {
    const sourceVaultPath = vaultPathForEntry(entry, vaultPath)
    try {
      const result = await performDuplicateNote(entry.path, sourceVaultPath)
      trackEvent('note_duplicated')
      await reloadVault()
      const filename = filenameFromPath(result.new_path)
      setToastMessage(`Duplicated “${entry.filename || entry.title}”`)
      await onOpenEntry({
        ...entry,
        path: result.new_path,
        filename,
        title: entry.title,
      })
    } catch (error) {
      console.warn('[duplicate] Failed to duplicate note:', error)
      setToastMessage(error instanceof Error ? error.message : String(error))
    }
  }, [onOpenEntry, reloadVault, setToastMessage, vaultPath])

  return { handleDuplicateNote }
}
