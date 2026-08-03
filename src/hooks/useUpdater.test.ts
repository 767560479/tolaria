import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUpdater } from './useUpdater'
import {
  clearRestartRequiredAfterUpdate,
  isRestartRequiredAfterUpdate,
  markRestartRequiredAfterUpdate,
} from '../lib/appUpdater'

const mockInvoke = vi.fn()
const mockOpenExternalUrl = vi.fn()
const mockIsTauri = vi.fn(() => true)

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => mockIsTauri(),
}))

vi.mock('../utils/url', () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))

describe('useUpdater', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockOpenExternalUrl.mockReset()
    mockIsTauri.mockReturnValue(true)
    clearRestartRequiredAfterUpdate()
  })

  afterEach(() => {
    clearRestartRequiredAfterUpdate()
  })

  it('returns up-to-date when not running in Tauri', async () => {
    mockIsTauri.mockReturnValue(false)
    const { result } = renderHook(() => useUpdater())

    let outcome
    await act(async () => {
      outcome = await result.current.actions.checkForUpdates()
    })

    expect(outcome).toEqual({ kind: 'up-to-date' })
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('checks GitHub releases without release channel args', async () => {
    mockInvoke.mockResolvedValue(null)
    const { result } = renderHook(() => useUpdater())

    let outcome
    await act(async () => {
      outcome = await result.current.actions.checkForUpdates()
    })

    expect(mockInvoke).toHaveBeenCalledWith('check_for_app_update')
    expect(outcome).toEqual({ kind: 'up-to-date' })
    expect(result.current.status).toEqual({ state: 'idle' })
  })

  it('surfaces an available update and opens its GitHub release URL', async () => {
    mockInvoke.mockResolvedValue({
      currentVersion: '2026.5.8-alpha.1',
      version: '2026.5.8-alpha.17',
      body: 'notes',
      htmlUrl: 'https://github.com/767560479/tolaria/releases/tag/alpha-v2026.5.8-alpha.0017',
    })
    const { result } = renderHook(() => useUpdater())

    let outcome
    await act(async () => {
      outcome = await result.current.actions.checkForUpdates()
    })

    expect(outcome).toMatchObject({
      kind: 'available',
      version: '2026.5.8-alpha.17',
      htmlUrl: 'https://github.com/767560479/tolaria/releases/tag/alpha-v2026.5.8-alpha.0017',
    })
    expect(result.current.status.state).toBe('available')

    act(() => {
      result.current.actions.openDownload()
    })
    expect(mockOpenExternalUrl).toHaveBeenCalledWith(
      'https://github.com/767560479/tolaria/releases/tag/alpha-v2026.5.8-alpha.0017',
    )
  })

  it('falls back to the releases page when htmlUrl is missing', async () => {
    mockInvoke.mockResolvedValue({
      currentVersion: '2026.5.8-alpha.1',
      version: '2026.5.8-alpha.17',
      htmlUrl: '',
    })
    const { result } = renderHook(() => useUpdater())

    await act(async () => {
      await result.current.actions.checkForUpdates()
    })

    act(() => {
      result.current.actions.openReleaseNotes()
    })
    expect(mockOpenExternalUrl).toHaveBeenCalledWith(
      'https://github.com/767560479/tolaria/releases',
    )
  })

  it('reports check errors', async () => {
    mockInvoke.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useUpdater())

    let outcome
    await act(async () => {
      outcome = await result.current.actions.checkForUpdates()
    })

    expect(outcome).toEqual({
      kind: 'error',
      message: 'Could not check for updates: network down',
    })
    expect(result.current.status).toEqual({ state: 'error' })
  })

  it('keeps folder-picker restart helpers available', () => {
    expect(isRestartRequiredAfterUpdate()).toBe(false)
    markRestartRequiredAfterUpdate()
    expect(isRestartRequiredAfterUpdate()).toBe(true)
    clearRestartRequiredAfterUpdate()
    expect(isRestartRequiredAfterUpdate()).toBe(false)
  })
})
