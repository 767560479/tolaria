import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Settings, VaultEntry } from '../types'
import { useNoteWidthMode } from './useNoteWidthMode'

function makeEntry(path: string, title: string): VaultEntry {
  return {
    path,
    filename: 'meeting.md',
    title,
    isA: null,
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: false,
    modifiedAt: null,
    createdAt: null,
    fileSize: 128,
    snippet: '',
    wordCount: 10,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    sort: null,
    view: null,
    visible: null,
    organized: false,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks: [],
    properties: {},
    hasH1: true,
    fileKind: 'markdown',
  }
}

const baseSettings = { note_width_mode: null } as Settings

describe('useNoteWidthMode', () => {
  it('resolves the active tab when path separators differ only by normalization', () => {
    const tabPath = String.raw`D:\Notes\meeting.md`
    const activeTabPath = 'D:/Notes/meeting.md'
    const entry = makeEntry(tabPath, 'Meeting Notes')

    const { result } = renderHook(() => useNoteWidthMode({
      tabs: [{ entry, content: '# Meeting Notes\n\n## Agenda' }],
      activeTabPath,
      settings: baseSettings,
      saveSettings: vi.fn(),
      updateFrontmatter: vi.fn(),
      setToastMessage: vi.fn(),
    }))

    expect(result.current.activeTab?.entry.title).toBe('Meeting Notes')
    expect(result.current.activeTab?.content).toContain('## Agenda')
  })
})
