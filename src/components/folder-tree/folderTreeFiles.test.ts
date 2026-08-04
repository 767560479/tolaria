import { describe, expect, it } from 'vitest'
import { countFilesForFolderNode, filesForFolderNode } from './folderTreeFiles'
import type { VaultEntry } from '../../types'
import type { AllNotesFileVisibility } from '../../utils/allNotesFileVisibility'

function entry(path: string, overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    path,
    filename: path.split(/[/\\]/).pop()!,
    title: path,
    archived: false,
    fileKind: 'markdown',
    ...overrides,
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

describe('countFilesForFolderNode', () => {
  it('counts nested files under a folder recursively', () => {
    const entries = [
      entry('notes/a.md'),
      entry('notes/nested/b.md'),
      entry('notes/nested/deep/c.md'),
      entry('other/x.md'),
    ]
    expect(countFilesForFolderNode(entries, { path: 'notes' })).toBe(3)
    expect(countFilesForFolderNode(entries, { path: 'notes/nested' })).toBe(2)
  })

  it('returns 0 for an empty folder', () => {
    expect(countFilesForFolderNode([entry('notes/a.md')], { path: 'empty' })).toBe(0)
  })

  it('counts all files under the vault root recursively', () => {
    const entries = [
      entry('root.md'),
      entry('notes/a.md'),
      entry('notes/nested/b.md'),
    ]
    expect(countFilesForFolderNode(entries, { path: '' })).toBe(3)
  })

  it('scopes recursive root counts to rootPath', () => {
    const entries = [
      entry('/Users/luca/Personal/root.md'),
      entry('/Users/luca/Personal/projects/a.md'),
      entry('/Users/luca/Team/projects/b.md'),
    ]
    expect(countFilesForFolderNode(entries, { path: '', rootPath: '/Users/luca/Personal' })).toBe(2)
    expect(countFilesForFolderNode(entries, { path: 'projects', rootPath: '/Users/luca/Team' })).toBe(1)
  })

  it('excludes archived and hidden non-markdown files by default', () => {
    const entries = [
      entry('notes/a.md'),
      entry('notes/old.md', { archived: true }),
      entry('notes/shot.png', { fileKind: 'binary', filename: 'shot.png' }),
    ]
    expect(countFilesForFolderNode(entries, { path: 'notes' })).toBe(1)

    const visibility: AllNotesFileVisibility = { pdfs: false, images: true, unsupported: false }
    expect(countFilesForFolderNode(entries, { path: 'notes' }, visibility)).toBe(2)
  })
})
