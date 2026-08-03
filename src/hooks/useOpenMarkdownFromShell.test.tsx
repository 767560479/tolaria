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
      ({ entries, currentVaultPath, isVaultContentLoading }) => useOpenMarkdownFromShell({
        currentVaultPath,
        enabled: true,
        entries,
        isVaultContentLoading,
        onSelectNote,
        registerVault,
        reloadVault: vi.fn().mockResolvedValue([note]),
        setToastMessage: vi.fn(),
        switchVault,
        vaultListLoaded: true,
        vaults: [],
      }),
      {
        initialProps: {
          currentVaultPath: '/old',
          entries: [] as VaultEntry[],
          isVaultContentLoading: true,
        },
      },
    )

    await waitFor(() => expect(registerVault).toHaveBeenCalledWith('/Notes', 'Notes'))

    await act(async () => {
      rerender({
        currentVaultPath: '/Notes',
        entries: [note],
        isVaultContentLoading: false,
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
      ({ currentVaultPath, isVaultContentLoading, entries }) => useOpenMarkdownFromShell({
        currentVaultPath,
        enabled: true,
        entries,
        isVaultContentLoading,
        onSelectNote: vi.fn(),
        registerVault,
        reloadVault: vi.fn().mockResolvedValue([note]),
        setToastMessage: vi.fn(),
        switchVault,
        vaultListLoaded: true,
        vaults: [{ path: '/Notes' }],
      }),
      {
        initialProps: {
          currentVaultPath: '/other',
          entries: [] as VaultEntry[],
          isVaultContentLoading: true,
        },
      },
    )

    await waitFor(() => expect(switchVault).toHaveBeenCalledWith('/Notes'))
    expect(registerVault).not.toHaveBeenCalled()

    await act(async () => {
      rerender({
        currentVaultPath: '/Notes',
        entries: [note],
        isVaultContentLoading: false,
      })
    })
  })

  it('toasts when the markdown file is missing after vault load', async () => {
    const setToastMessage = vi.fn()

    invoke.mockResolvedValue({
      markdownPath: '/Notes/missing.md',
      vaultPath: '/Notes',
      relativeNote: 'missing.md',
    })

    const { rerender } = renderHook(
      ({ isVaultContentLoading }) => useOpenMarkdownFromShell({
        currentVaultPath: '/Notes',
        enabled: true,
        entries: [],
        isVaultContentLoading,
        onSelectNote: vi.fn(),
        registerVault: vi.fn(),
        reloadVault: vi.fn().mockResolvedValue([]),
        setToastMessage,
        switchVault: vi.fn(),
        vaultListLoaded: true,
        vaults: [{ path: '/Notes' }],
      }),
      { initialProps: { isVaultContentLoading: true } },
    )

    await act(async () => {
      rerender({ isVaultContentLoading: false })
    })

    await waitFor(() => {
      expect(setToastMessage).toHaveBeenCalledWith(
        'That Markdown file is not available in the opened folder.',
      )
    })
  })
})
