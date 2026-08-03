import type { SidebarSelection } from '../types'

/** Folder / entity browse stays tree-first; list filters reopen the middle pane. */
export function selectionShowsNoteList(selection: SidebarSelection): boolean {
  if (selection.kind === 'view' || selection.kind === 'sectionGroup' || selection.kind === 'tag') {
    return true
  }
  if (selection.kind === 'filter') {
    return selection.filter !== 'favorites'
  }
  return false
}

export const VAULT_ROOT_SELECTION: SidebarSelection = { kind: 'folder', path: '' }
