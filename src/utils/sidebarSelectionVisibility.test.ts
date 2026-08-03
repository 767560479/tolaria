import { describe, expect, it } from 'vitest'
import { selectionShowsNoteList, VAULT_ROOT_SELECTION } from './sidebarSelectionVisibility'

describe('selectionShowsNoteList', () => {
  it('hides the note list for folder and entity selections', () => {
    expect(selectionShowsNoteList(VAULT_ROOT_SELECTION)).toBe(false)
    expect(selectionShowsNoteList({ kind: 'folder', path: 'notes' })).toBe(false)
    expect(selectionShowsNoteList({
      kind: 'entity',
      entry: { path: 'a.md' } as never,
    })).toBe(false)
  })

  it('shows the note list for views, types, tags, and filters', () => {
    expect(selectionShowsNoteList({ kind: 'view', filename: 'work.yml' })).toBe(true)
    expect(selectionShowsNoteList({ kind: 'sectionGroup', type: 'Project' })).toBe(true)
    expect(selectionShowsNoteList({ kind: 'tag', tag: 'ai' })).toBe(true)
    expect(selectionShowsNoteList({ kind: 'filter', filter: 'changes' })).toBe(true)
    expect(selectionShowsNoteList({ kind: 'filter', filter: 'pulse' })).toBe(true)
  })
})
