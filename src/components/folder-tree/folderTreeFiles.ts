import type { FolderNode, VaultEntry } from '../../types'
import { filterEntries, isAllNotesEntry } from '../../utils/noteListHelpers'
import type { AllNotesFileVisibility } from '../../utils/allNotesFileVisibility'
import { DEFAULT_ALL_NOTES_FILE_VISIBILITY } from '../../utils/allNotesFileVisibility'

function sortEntriesByTitle(entries: VaultEntry[]): VaultEntry[] {
  return [...entries].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
}

function normalizeVaultPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

/** All non-archived files under a vault root (any depth). */
function filterRecursiveRootEntries(entries: VaultEntry[], rootPath?: string): VaultEntry[] {
  if (!rootPath) return entries.filter((entry) => !entry.archived)

  const normalizedRoot = normalizeVaultPath(rootPath)
  return entries.filter((entry) => {
    if (entry.archived) return false
    const normalizedEntry = normalizeVaultPath(entry.path)
    return normalizedEntry.startsWith(`${normalizedRoot}/`)
  })
}

function visibleFilesForFolderNode(
  entries: VaultEntry[],
  node: Pick<FolderNode, 'path' | 'rootPath'>,
  allNotesFileVisibility: AllNotesFileVisibility,
  folderRecursive: boolean,
): VaultEntry[] {
  const selection = {
    kind: 'folder' as const,
    path: node.path,
    ...(node.rootPath ? { rootPath: node.rootPath } : {}),
  }

  // filterEntries ignores folderRecursive for the vault root (path ''); handle that here.
  const folderEntries = !node.path && folderRecursive
    ? filterRecursiveRootEntries(entries, node.rootPath)
    : filterEntries(entries, selection, { allNotesFileVisibility, folderRecursive })

  return folderEntries.filter((entry) => isAllNotesEntry(entry, allNotesFileVisibility))
}

/** Direct file children of a folder node (non-recursive). */
export function filesForFolderNode(
  entries: VaultEntry[],
  node: Pick<FolderNode, 'path' | 'rootPath'>,
  allNotesFileVisibility: AllNotesFileVisibility = DEFAULT_ALL_NOTES_FILE_VISIBILITY,
): VaultEntry[] {
  return sortEntriesByTitle(
    visibleFilesForFolderNode(entries, node, allNotesFileVisibility, false),
  )
}

/** Recursive visible-file count for a folder (includes nested subfolders). */
export function countFilesForFolderNode(
  entries: VaultEntry[],
  node: Pick<FolderNode, 'path' | 'rootPath'>,
  allNotesFileVisibility: AllNotesFileVisibility = DEFAULT_ALL_NOTES_FILE_VISIBILITY,
): number {
  return visibleFilesForFolderNode(entries, node, allNotesFileVisibility, true).length
}
