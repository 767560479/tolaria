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
})
