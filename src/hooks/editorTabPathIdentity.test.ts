import { describe, expect, it } from 'vitest'
import {
  cachedTabStateForPath,
  didActiveNotePathChange,
  findTabByNotePath,
  isNotePathIdentityChange,
  retargetCachedTabPath,
  tabContentForPath,
} from './editorTabPathIdentity'
import type { CachedTabState } from './editorBlockResolution'

const typedState: CachedTabState = {
  blocks: [{ type: 'heading' }],
  scrollTop: 12,
  sourceContent: '---\ntype: Note\n---\n\n# Typed\n',
}

function makeTab(path: string, content = 'body') {
  return { entry: { path }, content }
}

describe('editorTabPathIdentity', () => {
  it('finds tab content when only path separators differ', () => {
    const tabs = [makeTab(String.raw`D:\vault\notes\untitled-note-1.md`, '# Typed')]

    expect(tabContentForPath(tabs, String.raw`D:\vault\notes/untitled-note-1.md`)).toBe('# Typed')
    expect(findTabByNotePath(tabs, String.raw`D:\vault\notes/untitled-note-1.md`)?.entry.path)
      .toBe(String.raw`D:\vault\notes\untitled-note-1.md`)
  })

  it('treats mixed-separator path updates as the same note', () => {
    const optimistic = String.raw`D:\vault\notes/untitled-note-1.md`
    const scanned = String.raw`D:\vault\notes\untitled-note-1.md`

    expect(isNotePathIdentityChange(optimistic, scanned)).toBe(true)
    expect(didActiveNotePathChange(optimistic, scanned)).toBe(false)
    expect(didActiveNotePathChange(optimistic, String.raw`D:\vault\other.md`)).toBe(true)
  })

  it('retargets cached editor state onto the scanned path string', () => {
    const optimistic = String.raw`D:\vault\notes/untitled-note-1.md`
    const scanned = String.raw`D:\vault\notes\untitled-note-1.md`
    const cache = new Map<string, CachedTabState>([[optimistic, typedState]])

    retargetCachedTabPath(cache, optimistic, scanned)

    expect(cache.get(optimistic)).toBeUndefined()
    expect(cachedTabStateForPath(cache, optimistic)).toBe(typedState)
    expect(cache.get(scanned)).toBe(typedState)
  })
})
