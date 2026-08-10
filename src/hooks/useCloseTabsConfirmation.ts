import { useCallback, useState } from 'react'
import { translate, type AppLocale } from '../lib/i18n'
import { trackEvent } from '../lib/telemetry'
import { notePathsMatch } from '../utils/notePathIdentity'

interface TabLike {
  entry: { path: string }
}

export interface CloseTabsConfirmState {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
}

interface UseCloseTabsConfirmationInput {
  tabs: readonly TabLike[]
  unsavedPaths: ReadonlySet<string>
  clearUnsaved: (path: string) => void
  closeOtherTabs: (path: string) => void
  closeAllTabs: () => void
  locale?: AppLocale
}

function pathIsUnsaved(path: string, unsavedPaths: ReadonlySet<string>): boolean {
  if (unsavedPaths.has(path)) return true
  for (const unsavedPath of unsavedPaths) {
    if (notePathsMatch(unsavedPath, path)) return true
  }
  return false
}

function countUnsavedTabs(
  tabs: readonly TabLike[],
  unsavedPaths: ReadonlySet<string>,
  keepPath?: string | null,
): number {
  let count = 0
  for (const tab of tabs) {
    if (keepPath && notePathsMatch(tab.entry.path, keepPath)) continue
    if (pathIsUnsaved(tab.entry.path, unsavedPaths)) count += 1
  }
  return count
}

function discardUnsavedAmongTabs(
  tabs: readonly TabLike[],
  unsavedPaths: ReadonlySet<string>,
  clearUnsaved: (path: string) => void,
  keepPath?: string | null,
): void {
  for (const tab of tabs) {
    if (keepPath && notePathsMatch(tab.entry.path, keepPath)) continue
    if (pathIsUnsaved(tab.entry.path, unsavedPaths)) clearUnsaved(tab.entry.path)
  }
}

function buildConfirmCopy(locale: AppLocale, unsavedCount: number): Omit<CloseTabsConfirmState, 'onConfirm'> {
  return {
    title: translate(locale, 'editor.tabs.closeUnsavedTitle'),
    message: translate(locale, 'editor.tabs.closeUnsavedMessage', { count: unsavedCount }),
    confirmLabel: translate(locale, 'editor.tabs.closeUnsavedConfirm'),
  }
}

export function useCloseTabsConfirmation({
  tabs,
  unsavedPaths,
  clearUnsaved,
  closeOtherTabs,
  closeAllTabs,
  locale = 'en',
}: UseCloseTabsConfirmationInput) {
  const [confirmClose, setConfirmClose] = useState<CloseTabsConfirmState | null>(null)

  const requestCloseOtherTabs = useCallback((path: string) => {
    const unsavedCount = countUnsavedTabs(tabs, unsavedPaths, path)
    const perform = () => {
      discardUnsavedAmongTabs(tabs, unsavedPaths, clearUnsaved, path)
      closeOtherTabs(path)
      setConfirmClose(null)
    }
    if (unsavedCount === 0) {
      perform()
      return
    }
    setConfirmClose({
      ...buildConfirmCopy(locale, unsavedCount),
      onConfirm: () => {
        perform()
        trackEvent('tabs_close_unsaved_confirmed', { mode: 'others', unsaved_count: unsavedCount })
      },
    })
  }, [clearUnsaved, closeOtherTabs, locale, tabs, unsavedPaths])

  const requestCloseAllTabs = useCallback(() => {
    const unsavedCount = countUnsavedTabs(tabs, unsavedPaths)
    const perform = () => {
      discardUnsavedAmongTabs(tabs, unsavedPaths, clearUnsaved)
      closeAllTabs()
      setConfirmClose(null)
    }
    if (unsavedCount === 0) {
      perform()
      return
    }
    setConfirmClose({
      ...buildConfirmCopy(locale, unsavedCount),
      onConfirm: () => {
        perform()
        trackEvent('tabs_close_unsaved_confirmed', { mode: 'all', unsaved_count: unsavedCount })
      },
    })
  }, [clearUnsaved, closeAllTabs, locale, tabs, unsavedPaths])

  const cancelConfirmClose = useCallback(() => setConfirmClose(null), [])

  return {
    confirmClose,
    cancelConfirmClose,
    requestCloseOtherTabs,
    requestCloseAllTabs,
    canCloseOtherTabs: tabs.length > 1,
    canCloseAllTabs: tabs.length > 0,
  }
}
