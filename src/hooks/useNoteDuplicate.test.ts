import { describe, expect, it, vi } from 'vitest'
import { useNoteDuplicate } from './useNoteDuplicate'
import { act, renderHook } from '@testing-library/react'
import type { VaultEntry } from '../types'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: vi.fn(async (_cmd: string, args: { path: string }) => ({
    new_path: args.path.replace(/\.md$/, ' copy.md'),
  })),
}))

describe('useNoteDuplicate', () => {
  it('duplicates a note, reloads the vault, and opens the copy', async () => {
    const reloadVault = vi.fn(async () => undefined)
    const setToastMessage = vi.fn()
    const onOpenEntry = vi.fn(async () => undefined)
    const entry = {
      path: '/vault/alpha.md',
      filename: 'alpha.md',
      title: 'Alpha',
    } as VaultEntry

    const { result } = renderHook(() => useNoteDuplicate({
      vaultPath: '/vault',
      reloadVault,
      setToastMessage,
      onOpenEntry,
    }))

    await act(async () => {
      await result.current.handleDuplicateNote(entry)
    })

    expect(reloadVault).toHaveBeenCalledOnce()
    expect(onOpenEntry).toHaveBeenCalledWith(expect.objectContaining({
      path: '/vault/alpha copy.md',
      filename: 'alpha copy.md',
    }))
    expect(setToastMessage).toHaveBeenCalled()
  })
})
