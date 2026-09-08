import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isTauri } from '../mock-tauri'
import { useOpenMarkdownFromShell } from './useOpenMarkdownFromShell'
import type { VaultEntry } from '../types'

const { invoke, listen } = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke,
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen,
}))

vi.mock('../lib/telemetry', () => ({
  trackEvent: vi.fn(),
}))

function entry(path: string): VaultEntry {
  return {
    path,
    title: 'Note',
    modifiedAt: '2026-01-01T00:00:00.000Z',
    fileKind: 'markdown',
  } as VaultEntry
}

function shellHookProps(overrides: Partial<Parameters<typeof useOpenMarkdownFromShell>[0]> = {}) {
  return {
    currentVaultPath: '/Notes',
    enabled: true,
    entries: [] as VaultEntry[],
    onSelectNote: vi.fn(),
    registerVault: vi.fn().mockResolvedValue(undefined),
    setToastMessage: vi.fn(),
    switchVault: vi.fn(),
    vaultListLoaded: true,
    vaults: [{ path: '/Notes' }],
    ...overrides,
  }
}

describe('useOpenMarkdownFromShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isTauri).mockReturnValue(true)
    invoke.mockResolvedValue(null)
    listen.mockResolvedValue(vi.fn())
  })

  it('registers the parent folder vault and selects the note', async () => {
    const onSelectNote = vi.fn()
    const registerVault = vi.fn().mockResolvedValue(undefined)
    const switchVault = vi.fn()
    const note = entry('/Notes/meeting.md')

    invoke.mockResolvedValue({
      markdownPath: '/Notes/meeting.md',
      vaultPath: '/Notes',
      relativeNote: 'meeting.md',
    })

    const { rerender } = renderHook(
      ({ entries, currentVaultPath }) => useOpenMarkdownFromShell({
        ...shellHookProps({
          currentVaultPath,
          entries,
          onSelectNote,
          registerVault,
          switchVault,
          vaults: [],
        }),
      }),
      {
        initialProps: {
          currentVaultPath: '/old',
          entries: [] as VaultEntry[],
        },
      },
    )

    await waitFor(() => expect(registerVault).toHaveBeenCalledWith('/Notes', 'Notes'))

    await act(async () => {
      rerender({
        currentVaultPath: '/Notes',
        entries: [note],
      })
    })

    await waitFor(() => expect(onSelectNote).toHaveBeenCalledWith(note))
    expect(switchVault).not.toHaveBeenCalled()
  })

  it('switches an already registered vault without re-registering', async () => {
    const registerVault = vi.fn()
    const switchVault = vi.fn()
    const note = entry('/Notes/meeting.md')

    invoke.mockResolvedValue({
      markdownPath: '/Notes/meeting.md',
      vaultPath: '/Notes',
      relativeNote: 'meeting.md',
    })

    const { rerender } = renderHook(
      ({ currentVaultPath, entries }) => useOpenMarkdownFromShell({
        ...shellHookProps({
          currentVaultPath,
          entries,
          registerVault,
          switchVault,
        }),
      }),
      {
        initialProps: {
          currentVaultPath: '/other',
          entries: [] as VaultEntry[],
        },
      },
    )

    await waitFor(() => expect(switchVault).toHaveBeenCalledWith('/Notes'))
    expect(registerVault).not.toHaveBeenCalled()

    await act(async () => {
      rerender({
        currentVaultPath: '/Notes',
        entries: [note],
      })
    })
  })

  it('opens the shell markdown path before the vault index finishes loading', async () => {
    const onSelectNote = vi.fn()

    invoke.mockResolvedValue({
      markdownPath: '/Notes/meeting.md',
      vaultPath: '/Notes',
      relativeNote: 'meeting.md',
    })

    renderHook(() => useOpenMarkdownFromShell({
      ...shellHookProps({
        entries: [],
        onSelectNote,
      }),
    }))

    await waitFor(() => expect(onSelectNote).toHaveBeenCalledWith(expect.objectContaining({
      path: '/Notes/meeting.md',
      title: 'meeting',
      filename: 'meeting.md',
      fileKind: 'markdown',
    })))
  })

  it('opens a nested note inside a registered vault without waiting for the index', async () => {
    const onSelectNote = vi.fn()

    invoke.mockResolvedValue({
      markdownPath: '/Notes/projects/meeting.md',
      vaultPath: '/Notes',
      relativeNote: 'projects/meeting.md',
    })

    renderHook(() => useOpenMarkdownFromShell({
      ...shellHookProps({
        currentVaultPath: '/Notes',
        entries: [],
        onSelectNote,
      }),
    }))

    await waitFor(() => expect(onSelectNote).toHaveBeenCalledWith(expect.objectContaining({
      path: '/Notes/projects/meeting.md',
      title: 'meeting',
      filename: 'meeting.md',
      fileKind: 'markdown',
    })))
  })

  it('matches vault paths case-insensitively on Windows-style paths', async () => {
    const onSelectNote = vi.fn()

    invoke.mockResolvedValue({
      markdownPath: 'D:/Notes/meeting.md',
      vaultPath: 'd:/notes',
      relativeNote: 'meeting.md',
    })

    renderHook(() => useOpenMarkdownFromShell({
      ...shellHookProps({
        currentVaultPath: 'D:/Notes',
        onSelectNote,
        vaults: [{ path: 'D:/Notes' }],
      }),
    }))

    await waitFor(() => expect(onSelectNote).toHaveBeenCalled())
  })
})
