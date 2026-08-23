import { describe, expect, it } from 'vitest'
import {
  isShellMarkdownOpenPayload,
  normalizeShellMarkdownNavigation,
  shellMarkdownVaultLabel,
} from './openMarkdownFromShell'

describe('openMarkdownFromShell', () => {
  it('accepts well-formed shell open payloads', () => {
    expect(isShellMarkdownOpenPayload({
      markdownPath: 'D:/Notes/meeting.md',
      vaultPath: 'D:/Notes',
      relativeNote: 'meeting.md',
    })).toBe(true)
  })

  it('rejects incomplete payloads', () => {
    expect(isShellMarkdownOpenPayload({
      markdownPath: 'D:/Notes/meeting.md',
      vaultPath: 'D:/Notes',
    })).toBe(false)
    expect(isShellMarkdownOpenPayload(null)).toBe(false)
  })

  it('normalizes parent-folder navigation and labels', () => {
    expect(normalizeShellMarkdownNavigation({
      markdownPath: 'D:/Notes/meeting.md',
      vaultPath: 'D:/Notes/',
      relativeNote: 'meeting.md',
    })).toEqual({
      vaultPath: 'D:/Notes',
      relativeNote: 'meeting.md',
      markdownPath: 'D:/Notes/meeting.md',
    })
    expect(shellMarkdownVaultLabel('D:/Notes')).toBe('Notes')
    expect(shellMarkdownVaultLabel('D:\\Notes')).toBe('Notes')
  })

  it('rejects nested relative notes and non-markdown names', () => {
    expect(normalizeShellMarkdownNavigation({
      markdownPath: '/vault/nested/note.md',
      vaultPath: '/vault',
      relativeNote: 'nested/note.md',
    })).toBeNull()
    expect(normalizeShellMarkdownNavigation({
      markdownPath: '/vault/note.txt',
      vaultPath: '/vault',
      relativeNote: 'note.txt',
    })).toBeNull()
  })
})
