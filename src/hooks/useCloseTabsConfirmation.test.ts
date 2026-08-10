import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCloseTabsConfirmation } from './useCloseTabsConfirmation'

function makeTabs(paths: string[]) {
  return paths.map((path) => ({ entry: { path } }))
}

describe('useCloseTabsConfirmation', () => {
  it('closes other tabs immediately when none are unsaved', () => {
    const closeOtherTabs = vi.fn()
    const clearUnsaved = vi.fn()
    const { result } = renderHook(() => useCloseTabsConfirmation({
      tabs: makeTabs(['/vault/a.md', '/vault/b.md']),
      unsavedPaths: new Set(),
      clearUnsaved,
      closeOtherTabs,
      closeAllTabs: vi.fn(),
    }))

    act(() => {
      result.current.requestCloseOtherTabs('/vault/a.md')
    })

    expect(closeOtherTabs).toHaveBeenCalledWith('/vault/a.md')
    expect(result.current.confirmClose).toBeNull()
    expect(clearUnsaved).not.toHaveBeenCalled()
  })

  it('asks before closing other tabs that have unsaved edits', () => {
    const closeOtherTabs = vi.fn()
    const clearUnsaved = vi.fn()
    const { result } = renderHook(() => useCloseTabsConfirmation({
      tabs: makeTabs(['/vault/a.md', '/vault/b.md', '/vault/c.md']),
      unsavedPaths: new Set(['/vault/b.md', '/vault/c.md']),
      clearUnsaved,
      closeOtherTabs,
      closeAllTabs: vi.fn(),
    }))

    act(() => {
      result.current.requestCloseOtherTabs('/vault/a.md')
    })

    expect(closeOtherTabs).not.toHaveBeenCalled()
    expect(result.current.confirmClose?.message).toContain('2')

    act(() => {
      result.current.confirmClose?.onConfirm()
    })

    expect(clearUnsaved).toHaveBeenCalledWith('/vault/b.md')
    expect(clearUnsaved).toHaveBeenCalledWith('/vault/c.md')
    expect(closeOtherTabs).toHaveBeenCalledWith('/vault/a.md')
    expect(result.current.confirmClose).toBeNull()
  })

  it('asks before closing all tabs that include unsaved edits', () => {
    const closeAllTabs = vi.fn()
    const clearUnsaved = vi.fn()
    const { result } = renderHook(() => useCloseTabsConfirmation({
      tabs: makeTabs(['/vault/a.md', '/vault/b.md']),
      unsavedPaths: new Set(['/vault/a.md']),
      clearUnsaved,
      closeOtherTabs: vi.fn(),
      closeAllTabs,
    }))

    act(() => {
      result.current.requestCloseAllTabs()
    })

    expect(closeAllTabs).not.toHaveBeenCalled()
    act(() => {
      result.current.confirmClose?.onConfirm()
    })

    expect(clearUnsaved).toHaveBeenCalledWith('/vault/a.md')
    expect(closeAllTabs).toHaveBeenCalledOnce()
  })

  it('exposes whether other/all close actions are available', () => {
    const { result, rerender } = renderHook(
      ({ tabs }) => useCloseTabsConfirmation({
        tabs,
        unsavedPaths: new Set(),
        clearUnsaved: vi.fn(),
        closeOtherTabs: vi.fn(),
        closeAllTabs: vi.fn(),
      }),
      { initialProps: { tabs: makeTabs(['/vault/a.md']) } },
    )

    expect(result.current.canCloseOtherTabs).toBe(false)
    expect(result.current.canCloseAllTabs).toBe(true)

    rerender({ tabs: makeTabs(['/vault/a.md', '/vault/b.md']) })
    expect(result.current.canCloseOtherTabs).toBe(true)
  })
})
