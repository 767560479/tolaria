import type { FolderNode, VaultEntry } from '../../types'
import { filterEntries, isAllNotesEntry } from '../../utils/noteListHelpers'
import type { AllNotesFileVisibility } from '../../utils/allNotesFileVisibility'
import { DEFAULT_ALL_NOTES_FILE_VISIBILITY } from '../../utils/allNotesFileVisibility'

function sortEntriesByTitle(entries: VaultEntry[]): VaultEntry[] {
  return [...entries].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
}

/** Direct file children of a folder node (non-recursive). */
export function filesForFolderNode(
  entries: VaultEntry[],
  node: Pick<FolderNode, 'path' | 'rootPath'>,
  allNotesFileVisibility: AllNotesFileVisibility = DEFAULT_ALL_NOTES_FILE_VISIBILITY,
): VaultEntry[] {
  const folderEntries = filterEntries(
    entries,
    { kind: 'folder', path: node.path, rootPath: node.rootPath },
    { allNotesFileVisibility, folderRecursive: false },
  )
  return sortEntriesByTitle(
    folderEntries.filter((entry) => isAllNotesEntry(entry, allNotesFileVisibility)),
  )
}
