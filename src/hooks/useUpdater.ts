import { useCallback, useRef, useState } from 'react'
import { isTauri } from '../mock-tauri'
import {
  checkForAppUpdate,
  GITHUB_RELEASES_PAGE_URL,
  type AppUpdateMetadata,
} from '../lib/appUpdater'
import { formatCalendarVersionForDisplay } from '../utils/calendarVersion'
import { openExternalUrl } from '../utils/url'

interface UpdateVersionInfo {
  version: string
  displayVersion: string
  htmlUrl: string
}

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | ({ state: 'available'; notes: string | undefined } & UpdateVersionInfo)
  | { state: 'error' }

export type UpdateCheckResult =
  | { kind: 'up-to-date' }
  | ({ kind: 'available' } & UpdateVersionInfo)
  | { kind: 'error'; message: string }

export interface UpdateActions {
  checkForUpdates: () => Promise<UpdateCheckResult>
  openDownload: () => void
  openReleaseNotes: () => void
  dismiss: () => void
}

function formatReleaseDisplayVersion(version: string): string {
  const normalizedVersion = version.trim()
  if (!normalizedVersion) return normalizedVersion

  const baseVersion = normalizedVersion.split('+')[0]
  return formatCalendarVersionForDisplay(baseVersion) ?? baseVersion
}

function createVersionInfo(update: AppUpdateMetadata): UpdateVersionInfo {
  return {
    version: update.version,
    displayVersion: formatReleaseDisplayVersion(update.version),
    htmlUrl: update.htmlUrl?.trim() || GITHUB_RELEASES_PAGE_URL,
  }
}

function buildUpdateCheckErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return `Could not check for updates: ${error.message}`
  }
  if (typeof error === 'string' && error.trim()) {
    return `Could not check for updates: ${error}`
  }
  return 'Could not check for updates'
}

function toAvailableStatus(update: AppUpdateMetadata): UpdateStatus {
  const versionInfo = createVersionInfo(update)
  return {
    state: 'available',
    ...versionInfo,
    notes: update.body ?? undefined,
  }
}

export function useUpdater(): { status: UpdateStatus; actions: UpdateActions } {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
  const updateRef = useRef<AppUpdateMetadata | null>(null)

  const checkForUpdates = useCallback(async (): Promise<UpdateCheckResult> => {
    if (!isTauri()) return { kind: 'up-to-date' }

    setStatus({ state: 'checking' })

    try {
      const update = await checkForAppUpdate()
      if (!update) {
        updateRef.current = null
        setStatus({ state: 'idle' })
        return { kind: 'up-to-date' }
      }

      const versionInfo = createVersionInfo(update)
      updateRef.current = update
      setStatus(toAvailableStatus(update))
      return { kind: 'available', ...versionInfo }
    } catch (error) {
      console.warn('[updater] Failed to check for updates')
      setStatus({ state: 'error' })
      return { kind: 'error', message: buildUpdateCheckErrorMessage(error) }
    }
  }, [])

  const openDownload = useCallback(() => {
    const url = updateRef.current?.htmlUrl?.trim() || GITHUB_RELEASES_PAGE_URL
    openExternalUrl(url)
  }, [])

  const openReleaseNotes = useCallback(() => {
    const url = updateRef.current?.htmlUrl?.trim() || GITHUB_RELEASES_PAGE_URL
    openExternalUrl(url)
  }, [])

  const dismiss = useCallback(() => {
    updateRef.current = null
    setStatus({ state: 'idle' })
  }, [])

  return { status, actions: { checkForUpdates, openDownload, openReleaseNotes, dismiss } }
}
