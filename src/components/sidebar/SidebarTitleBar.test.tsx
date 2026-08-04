import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SidebarTitleBar } from './SidebarSections'

function renderTitleBar(overrides: Partial<ComponentProps<typeof SidebarTitleBar>> = {}) {
  return render(<SidebarTitleBar {...overrides} />, { wrapper: TooltipProvider })
}

describe('SidebarTitleBar', () => {
  it('renders sidebar and history controls with shortcut tooltips', () => {
    const onCollapse = vi.fn()
    const onFindInVault = vi.fn()
    const onGoBack = vi.fn()
    const onGoForward = vi.fn()

    renderTitleBar({
      onCollapse,
      onFindInVault,
      onGoBack,
      onGoForward,
      canGoBack: true,
      canGoForward: false,
    })

    const collapse = screen.getByRole('button', { name: 'Collapse sidebar' })
    const findInVault = screen.getByRole('button', { name: 'Find in Vault' })
    const back = screen.getByRole('button', { name: 'Go Back' })
    const forward = screen.getByRole('button', { name: 'Go Forward' })

    expect(collapse).toHaveAttribute('title', expect.stringMatching(/^Collapse sidebar \((⌘|Ctrl\+)2\)$/))
    expect(findInVault).toHaveAttribute('title', expect.stringMatching(/^Find in Vault \((⌘⇧F|Ctrl\+Shift\+F)\)$/))
    expect(back).toHaveAttribute('title', expect.stringMatching(/^Go Back \((⌘←|Ctrl\+Left)\)$/))
    expect(forward).toHaveAttribute('title', expect.stringMatching(/^Go Forward \((⌘→|Ctrl\+Right)\)$/))
    expect(forward).toBeDisabled()

    fireEvent.click(collapse)
    fireEvent.click(findInVault)
    fireEvent.click(back)
    fireEvent.click(forward)

    expect(onCollapse).toHaveBeenCalledTimes(1)
    expect(onFindInVault).toHaveBeenCalledTimes(1)
    expect(onGoBack).toHaveBeenCalledTimes(1)
    expect(onGoForward).not.toHaveBeenCalled()
  })

  it('omits controls when sidebar callbacks are absent', () => {
    renderTitleBar()

    expect(screen.queryByRole('button', { name: 'Collapse sidebar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Find in Vault' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Go Back' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Go Forward' })).not.toBeInTheDocument()
  })

  it('uses the fullscreen-aware macOS traffic-light inset', () => {
    const { container } = renderTitleBar()

    expect(container.firstElementChild).toHaveStyle({
      paddingLeft: 'var(--tolaria-macos-traffic-light-padding, 90px)',
    })
  })
})
