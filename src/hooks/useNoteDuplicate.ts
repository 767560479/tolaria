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

function entryFromReload(
  refreshed: unknown,
  newPath: string,
  fallback: VaultEntry,
): VaultEntry {
  const filename = filenameFromPath(newPath)
  if (Array.isArray(refreshed)) {
    const found = refreshed.find((entry): entry is VaultEntry => (
      typeof entry === 'object'
      && entry !== null
      && 'path' in entry
      && (entry as VaultEntry).path === newPath
    ))
    if (found) return found
  }
  return {
    ...fallback,
    path: newPath,
    filename,
  }
}

export function useNoteDuplicate({
  vaultPath,
  reloadVault,
  setToastMessage,
  onOpenEntry,
}: {
  vaultPath: string
  reloadVault: () => Promise<unknown> | unknown
  setToastMessage: (message: string | null) => void
  onOpenEntry: (entry: VaultEntry) => void | Promise<void>
}) {
  const handleDuplicateNote = useCallback(async (entry: VaultEntry) => {
    const sourceVaultPath = vaultPathForEntry(entry, vaultPath)
    try {
      const result = await performDuplicateNote(entry.path, sourceVaultPath)
      trackEvent('note_duplicated')
      const refreshed = await Promise.resolve(reloadVault())
      const filename = filenameFromPath(result.new_path)
      setToastMessage(`Duplicated “${entry.filename || entry.title}”`)
      await onOpenEntry(entryFromReload(refreshed, result.new_path, {
        ...entry,
        path: result.new_path,
        filename,
      }))
    } catch (error) {
      console.warn('[duplicate] Failed to duplicate note:', error)
      setToastMessage(error instanceof Error ? error.message : String(error))
    }
  }, [onOpenEntry, reloadVault, setToastMessage, vaultPath])

  return { handleDuplicateNote }
}
