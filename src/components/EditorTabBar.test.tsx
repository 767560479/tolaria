import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { EditorTabBar } from './EditorTabBar'
import type { Tab } from '../hooks/useTabManagement'
import type { VaultEntry } from '../types'

function tab(path: string, filename = path): Tab {
  return {
    content: '',
    entry: { path, filename, title: filename } as VaultEntry,
  }
}

describe('EditorTabBar', () => {
  it('renders open filenames and switches or closes tabs', () => {
    const onSelectTab = vi.fn()
    const onCloseTab = vi.fn()
    render(
      <EditorTabBar
        tabs={[tab('a.md'), tab('b.md')]}
        activeTabPath="a.md"
        onSelectTab={onSelectTab}
        onCloseTab={onCloseTab}
      />,
    )
    expect(screen.getByTestId('editor-tab-bar')).toBeInTheDocument()
    expect(screen.getByText('a.md')).toBeInTheDocument()
    expect(screen.getByText('b.md')).toBeInTheDocument()
    fireEvent.click(screen.getByText('b.md'))
    expect(onSelectTab).toHaveBeenCalledWith('b.md')
    fireEvent.click(screen.getByLabelText('Close a.md'))
    expect(onCloseTab).toHaveBeenCalledWith('a.md')
  })

  it('opens a context menu with close, close others, and close all', () => {
    const onCloseTab = vi.fn()
    const onCloseOtherTabs = vi.fn()
    const onCloseAllTabs = vi.fn()
    render(
      <EditorTabBar
        tabs={[tab('a.md'), tab('b.md')]}
        activeTabPath="a.md"
        onSelectTab={vi.fn()}
        onCloseTab={onCloseTab}
        onCloseOtherTabs={onCloseOtherTabs}
        onCloseAllTabs={onCloseAllTabs}
      />,
    )

    fireEvent.contextMenu(screen.getByTestId('editor-tab:a.md'))
    expect(screen.getByTestId('editor-tab-context-menu')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('editor-tab-menu-close-others'))
    expect(onCloseOtherTabs).toHaveBeenCalledWith('a.md')

    fireEvent.contextMenu(screen.getByTestId('editor-tab:b.md'))
    fireEvent.click(screen.getByTestId('editor-tab-menu-close-all'))
    expect(onCloseAllTabs).toHaveBeenCalledOnce()

    fireEvent.contextMenu(screen.getByTestId('editor-tab:b.md'))
    fireEvent.click(screen.getByTestId('editor-tab-menu-close'))
    expect(onCloseTab).toHaveBeenCalledWith('b.md')
  })
})
