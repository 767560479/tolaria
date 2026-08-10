import { afterEach, describe, expect, it, vi } from 'vitest'
import { translateRevealInFileManager, revealInFileManagerTranslationKey } from './revealInFileManager'

vi.mock('../utils/platform', () => ({
  isMac: vi.fn(() => false),
  isWindows: vi.fn(() => false),
}))

import { isMac, isWindows } from '../utils/platform'

describe('revealInFileManager', () => {
  afterEach(() => {
    vi.mocked(isMac).mockReturnValue(false)
    vi.mocked(isWindows).mockReturnValue(false)
  })

  it('selects Finder copy on macOS', () => {
    vi.mocked(isMac).mockReturnValue(true)
    expect(revealInFileManagerTranslationKey('file')).toBe('editor.toolbar.revealFileMac')
    expect(translateRevealInFileManager('en', 'file')).toBe('Reveal in Finder')
    expect(translateRevealInFileManager('en', 'folder')).toBe('Reveal in Finder')
  })

  it('selects File Explorer copy on Windows', () => {
    vi.mocked(isWindows).mockReturnValue(true)
    expect(revealInFileManagerTranslationKey('file')).toBe('editor.toolbar.revealFileWindows')
    expect(translateRevealInFileManager('en', 'file')).toBe('Reveal in File Explorer')
    expect(translateRevealInFileManager('en', 'folder')).toBe('Reveal in File Explorer')
  })

  it('selects File Manager copy on Linux', () => {
    expect(revealInFileManagerTranslationKey('file')).toBe('editor.toolbar.revealFileLinux')
    expect(translateRevealInFileManager('en', 'file')).toBe('Reveal in File Manager')
    expect(translateRevealInFileManager('en', 'folder')).toBe('Reveal in File Manager')
  })

  it('keeps Chinese labels platform-neutral', () => {
    vi.mocked(isWindows).mockReturnValue(true)
    expect(translateRevealInFileManager('zh-CN', 'file')).toBe('在文件管理器中显示')
    expect(translateRevealInFileManager('zh-TW', 'folder')).toBe('在檔案管理器中顯示')
  })
})
