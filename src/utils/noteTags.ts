import type { VaultEntry, VaultPropertyValue } from '../types'

function coerceTagList(value: VaultPropertyValue | undefined): string[] {
  if (value == null) return []
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : []
  }
  return []
}

export function entryTags(entry: VaultEntry): string[] {
  return coerceTagList(entry.properties?.tags)
}

export function entryHasTag(entry: VaultEntry, tag: string): boolean {
  const needle = tag.trim().toLowerCase()
  if (!needle) return false
  return entryTags(entry).some((candidate) => candidate.toLowerCase() === needle)
}

export interface TagCount {
  tag: string
  count: number
}

export function aggregateVaultTags(entries: VaultEntry[]): TagCount[] {
  const counts = new Map<string, { tag: string; count: number }>()
  for (const entry of entries) {
    if (entry.archived) continue
    if (entry.fileKind && entry.fileKind !== 'markdown') continue
    for (const tag of entryTags(entry)) {
      const key = tag.toLowerCase()
      const existing = counts.get(key)
      if (existing) {
        existing.count += 1
      } else {
        counts.set(key, { tag, count: 1 })
      }
    }
  }
  return [...counts.values()].sort((a, b) => a.tag.localeCompare(b.tag, undefined, { sensitivity: 'base' }))
}
