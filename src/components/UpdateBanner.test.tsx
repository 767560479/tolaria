import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UpdateBanner } from './UpdateBanner'
import type { UpdateActions, UpdateStatus } from '../hooks/useUpdater'

function createActions(overrides: Partial<UpdateActions> = {}): UpdateActions {
  return {
    checkForUpdates: vi.fn(),
    openDownload: vi.fn(),
    openReleaseNotes: vi.fn(),
    dismiss: vi.fn(),
    ...overrides,
  }
}

describe('UpdateBanner', () => {
  it('hides for idle and error states', () => {
    const { rerender } = render(
      <UpdateBanner status={{ state: 'idle' }} actions={createActions()} />,
    )
    expect(screen.queryByTestId('update-banner')).toBeNull()

    rerender(<UpdateBanner status={{ state: 'error' }} actions={createActions()} />)
    expect(screen.queryByTestId('update-banner')).toBeNull()
  })

  it('shows checking state', () => {
    render(<UpdateBanner status={{ state: 'checking' }} actions={createActions()} />)
    expect(screen.getByTestId('update-banner')).toHaveTextContent('Checking for updates')
  })

  it('shows available update and opens GitHub download', () => {
    const actions = createActions()
    const status: UpdateStatus = {
      state: 'available',
      version: '2026.5.8-alpha.17',
      displayVersion: 'Alpha 2026.5.8.17',
      htmlUrl: 'https://github.com/767560479/tolaria/releases/tag/x',
      notes: 'notes',
    }

    render(<UpdateBanner status={status} actions={actions} />)

    expect(screen.getByText(/Alpha 2026.5.8.17/)).toBeTruthy()
    fireEvent.click(screen.getByTestId('update-now-btn'))
    expect(actions.openDownload).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByTestId('update-release-notes'))
    expect(actions.openReleaseNotes).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByTestId('update-dismiss'))
    expect(actions.dismiss).toHaveBeenCalledOnce()
  })
})
