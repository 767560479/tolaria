import { describe, expect, it } from 'vitest'
import { filesForFolderNode } from './folderTreeFiles'
import type { VaultEntry } from '../../types'

function entry(path: string): VaultEntry {
  return {
    path,
    filename: path.split('/').pop()!,
    title: path,
    archived: false,
    fileKind: 'markdown',
  } as VaultEntry
}

describe('filesForFolderNode', () => {
  it('returns direct children of a folder', () => {
    const entries = [
      entry('notes/a.md'),
      entry('notes/nested/b.md'),
      entry('root.md'),
    ]
    expect(filesForFolderNode(entries, { path: 'notes' }).map((e) => e.path)).toEqual(['notes/a.md'])
    expect(filesForFolderNode(entries, { path: '' }).map((e) => e.path)).toEqual(['root.md'])
  })
})
