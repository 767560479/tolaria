import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRef } from 'react'
import { AUTO_SAVE_DEBOUNCE_MS } from './useEditorSave'
import {
  RICH_EDITOR_CHANGE_DEBOUNCE_MS,
  useDebouncedEditorChange,
} from './editorChangeDebounce'

describe('rich-editor serialize idle vs disk autosave idle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps serialize coalesce shorter than the disk autosave idle window', () => {
    expect(RICH_EDITOR_CHANGE_DEBOUNCE_MS).toBe(500)
    expect(AUTO_SAVE_DEBOUNCE_MS).toBe(1_500)
    expect(RICH_EDITOR_CHANGE_DEBOUNCE_MS).toBeLessThan(AUTO_SAVE_DEBOUNCE_MS)
  })

  it('flushes coalesced editor changes after the serialize idle, not the disk idle', () => {
    const onFlush = vi.fn()
    const { result } = renderHook(() => {
      const suppressChangeRef = useRef(false)
      return useDebouncedEditorChange({ onFlush, suppressChangeRef })
    })

    act(() => {
      result.current.handleEditorChange()
      result.current.handleEditorChange()
    })
    expect(onFlush).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(RICH_EDITOR_CHANGE_DEBOUNCE_MS - 1)
    })
    expect(onFlush).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onFlush).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(AUTO_SAVE_DEBOUNCE_MS)
    })
    expect(onFlush).toHaveBeenCalledTimes(1)
  })
})
