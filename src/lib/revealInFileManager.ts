import { isMac, isWindows } from '../utils/platform'
import { translate, type AppLocale, type TranslationKey } from './i18n'

export type RevealInFileManagerKind = 'file' | 'folder'

function revealPlatformSuffix(): 'Mac' | 'Windows' | 'Linux' {
  if (isMac()) return 'Mac'
  if (isWindows()) return 'Windows'
  return 'Linux'
}

export function revealInFileManagerTranslationKey(kind: RevealInFileManagerKind): TranslationKey {
  const suffix = revealPlatformSuffix()
  if (kind === 'folder') {
    if (suffix === 'Mac') return 'sidebar.action.revealFolderMenuMac'
    if (suffix === 'Windows') return 'sidebar.action.revealFolderMenuWindows'
    return 'sidebar.action.revealFolderMenuLinux'
  }
  if (suffix === 'Mac') return 'editor.toolbar.revealFileMac'
  if (suffix === 'Windows') return 'editor.toolbar.revealFileWindows'
  return 'editor.toolbar.revealFileLinux'
}

export function translateRevealInFileManager(
  locale: AppLocale,
  kind: RevealInFileManagerKind = 'file',
): string {
  return translate(locale, revealInFileManagerTranslationKey(kind))
}
