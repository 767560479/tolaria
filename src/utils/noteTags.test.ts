import { describe, expect, it } from 'vitest'
import { aggregateVaultTags, entryHasTag, entryTags } from './noteTags'
import type { VaultEntry } from '../types'

function entry(path: string, tags: unknown): VaultEntry {
  return {
    path,
    filename: path,
    title: path,
    properties: { tags: tags as never },
    archived: false,
    fileKind: 'markdown',
  } as VaultEntry
}

describe('noteTags', () => {
  it('reads tags from properties', () => {
    expect(entryTags(entry('a.md', ['Ai', 'ml']))).toEqual(['Ai', 'ml'])
    expect(entryHasTag(entry('a.md', ['Ai']), 'ai')).toBe(true)
  })

  it('aggregates unique tags with counts', () => {
    const tags = aggregateVaultTags([
      entry('a.md', ['Ai', 'ml']),
      entry('b.md', ['ai']),
      entry('c.md', 'solo'),
    ])
    expect(tags).toEqual([
      { tag: 'Ai', count: 2 },
      { tag: 'ml', count: 1 },
      { tag: 'solo', count: 1 },
    ])
  })
})
