import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { AppLocale } from '../lib/i18n'
import { translate } from '../lib/i18n'
import { trackEvent } from '../lib/telemetry'
import { isTauri } from '../mock-tauri'
import type { VaultEntry } from '../types'
import { relativePathForVaultItem } from '../utils/deepLinks'
import { notePathsCollide, notePathsMatch } from '../utils/notePathIdentity'
import {
  isShellMarkdownOpenPayload,
  normalizeShellMarkdownNavigation,
  SHELL_OPEN_MARKDOWN_EVENT,
  shellMarkdownNoteTitle,
  shellMarkdownVaultLabel,
  type ShellMarkdownNavigation,
  type ShellMarkdownOpenError,
  type ShellMarkdownOpenPayload,
} from '../utils/openMarkdownFromShell'
import { normalizeVaultEntry } from '../utils/vaultMetadataNormalization'
import { cleanupTauriEventListener, type TauriUnlisten } from '../utils/tauriEventCleanup'

interface ShellOpenVault {
  path: string
}

interface UseOpenMarkdownFromShellConfig {
  currentVaultPath: string
  enabled: boolean
  entries: VaultEntry[]
  locale?: AppLocale
  onSelectNote: (entry: VaultEntry) => Promise<void> | void
  registerVault: (path: string, label: string) => Promise<void> | void
  reloadVault: () => Promise<VaultEntry[]>
  setToastMessage: (message: string) => void
  switchVault: (path: string) => void
  vaultListLoaded: boolean
  vaults: ShellOpenVault[]
}

function shellOpenErrorMessage(error: ShellMarkdownOpenError, locale: AppLocale, detail?: string): string {
  if (error === 'open_failed') {
    return translate(locale, 'shellOpenMarkdown.error.openFailed', { detail: detail ?? 'unknown error' })
  }
  const key = {
    invalid_payload: 'shellOpenMarkdown.error.invalidPayload',
    missing_file: 'shellOpenMarkdown.error.missingFile',
    not_markdown: 'shellOpenMarkdown.error.notMarkdown',
  } satisfies Record<Exclude<ShellMarkdownOpenError, 'open_failed'>, Parameters<typeof translate>[1]>
  return translate(locale, key[error])
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function navigationKey(request: ShellMarkdownNavigation): string {
  return `${request.vaultPath}\n${request.markdownPath}`
}

function shellVaultPathsMatch(left: string, right: string): boolean {
  return notePathsMatch(left, right) || notePathsCollide(left, right)
}

function shellMarkdownVaultEntry(request: ShellMarkdownNavigation): VaultEntry {
  return normalizeVaultEntry({
    path: request.markdownPath,
    filename: request.relativeNote,
    title: shellMarkdownNoteTitle(request.relativeNote),
    fileKind: 'markdown',
  }, request.vaultPath)
}

function findEntryForShellOpen(
  entries: readonly VaultEntry[],
  request: ShellMarkdownNavigation,
): VaultEntry | undefined {
  return entries.find((entry) => {
    const relativePath = relativePathForVaultItem({ itemPath: entry.path, vaultPath: request.vaultPath })
    return notePathsMatch(relativePath, request.relativeNote)
  })
}

async function selectShellOpenEntry({
  entries,
  onSelectNote,
  request,
  reloadVault,
}: {
  entries: VaultEntry[]
  onSelectNote: (entry: VaultEntry) => Promise<void> | void
  request: ShellMarkdownNavigation
  reloadVault: () => Promise<VaultEntry[]>
}): Promise<boolean> {
  const indexedEntry = findEntryForShellOpen(entries, request)
  await onSelectNote(indexedEntry ?? shellMarkdownVaultEntry(request))
  void reloadVault().catch((error) => {
    console.warn('[shell-open-markdown] Background vault refresh after shell open failed:', error)
  })
  return true
}

function useShellMarkdownPayloadListener({
  enabled,
  queuePayload,
}: {
  enabled: boolean
  queuePayload: (payload: ShellMarkdownOpenPayload) => void
}) {
  useEffect(() => {
    if (!enabled || !isTauri()) return undefined

    let disposed = false
    let unlisten: TauriUnlisten | null = null

    const loadPending = async () => {
      const pending = await invoke<ShellMarkdownOpenPayload | null>('take_pending_shell_markdown_open')
      if (!disposed && isShellMarkdownOpenPayload(pending)) queuePayload(pending)
    }

    void loadPending().catch((error) => {
      console.warn('[shell-open-markdown] Failed to read pending open:', error)
    })

    void listen<ShellMarkdownOpenPayload>(SHELL_OPEN_MARKDOWN_EVENT, (event) => {
      if (!disposed && isShellMarkdownOpenPayload(event.payload)) queuePayload(event.payload)
    })
      .then((stopListening) => {
        unlisten = stopListening
        if (disposed) cleanupTauriEventListener(stopListening)
      })
      .catch((error) => {
        console.warn('[shell-open-markdown] Failed to install listener:', error)
      })

    return () => {
      disposed = true
      cleanupTauriEventListener(unlisten)
    }
  }, [enabled, queuePayload])
}

function useShellMarkdownResolver({
  currentVaultPath,
  enabled,
  locale,
  pendingPayload,
  registerVault,
  setPendingNavigation,
  setPendingPayload,
  setToastMessage,
  switchVault,
  vaultListLoaded,
  vaults,
}: {
  currentVaultPath: string
  enabled: boolean
  locale: AppLocale
  pendingPayload: ShellMarkdownOpenPayload | null
  registerVault: (path: string, label: string) => Promise<void> | void
  setPendingNavigation: (request: ShellMarkdownNavigation | null) => void
  setPendingPayload: (payload: ShellMarkdownOpenPayload | null) => void
  setToastMessage: (message: string) => void
  switchVault: (path: string) => void
  vaultListLoaded: boolean
  vaults: ShellOpenVault[]
}) {
  useEffect(() => {
    if (!enabled || !pendingPayload || !vaultListLoaded) return

    const payload = pendingPayload
    setPendingPayload(null)

    const navigation = normalizeShellMarkdownNavigation(payload)
    if (!navigation) {
      setToastMessage(shellOpenErrorMessage('invalid_payload', locale))
      trackEvent('shell_markdown_opened', { outcome: 'failed', reason: 'invalid_payload', mode: 'vault_instance' })
      return
    }

    const alreadyRegistered = vaults.some((vault) => shellVaultPathsMatch(vault.path, navigation.vaultPath))
    const run = async () => {
      if (!alreadyRegistered) {
        await registerVault(navigation.vaultPath, shellMarkdownVaultLabel(navigation.vaultPath))
      } else if (!shellVaultPathsMatch(currentVaultPath, navigation.vaultPath)) {
        switchVault(navigation.vaultPath)
      }
      setPendingNavigation(navigation)
      // Separate vault-instance processes may register this folder in the shared
      // vault list, but Rust preserve_shared_active_vault keeps the ordinary
      // active_vault unchanged when this process saves vaults.json.
      trackEvent('shell_markdown_opened', {
        outcome: 'accepted',
        mode: 'vault_instance',
        new_vault: alreadyRegistered ? 0 : 1,
      })
    }

    void run().catch((error) => {
      setToastMessage(shellOpenErrorMessage('open_failed', locale, errorDetail(error)))
      trackEvent('shell_markdown_opened', { outcome: 'failed', reason: 'open_failed', mode: 'vault_instance' })
    })
  }, [
    currentVaultPath,
    enabled,
    locale,
    pendingPayload,
    registerVault,
    setPendingNavigation,
    setPendingPayload,
    setToastMessage,
    switchVault,
    vaultListLoaded,
    vaults,
  ])
}

function useShellMarkdownNavigation({
  currentVaultPath,
  enabled,
  entries,
  locale,
  onSelectNote,
  pendingNavigation,
  reloadVault,
  setPendingNavigation,
  setToastMessage,
}: {
  currentVaultPath: string
  enabled: boolean
  entries: VaultEntry[]
  locale: AppLocale
  onSelectNote: (entry: VaultEntry) => Promise<void> | void
  pendingNavigation: ShellMarkdownNavigation | null
  reloadVault: () => Promise<VaultEntry[]>
  setPendingNavigation: (request: ShellMarkdownNavigation | null) => void
  setToastMessage: (message: string) => void
}) {
  const activeAttemptRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || !pendingNavigation) return
    if (!shellVaultPathsMatch(currentVaultPath, pendingNavigation.vaultPath)) return

    const key = navigationKey(pendingNavigation)
    if (activeAttemptRef.current === key) return
    activeAttemptRef.current = key

    const request = pendingNavigation
    void selectShellOpenEntry({ entries, onSelectNote, request, reloadVault })
      .then((selected) => {
        setPendingNavigation(null)
        if (selected) {
          trackEvent('shell_markdown_opened', { outcome: 'success', mode: 'vault_instance' })
          return
        }
        setToastMessage(shellOpenErrorMessage('missing_file', locale))
        trackEvent('shell_markdown_opened', { outcome: 'failed', reason: 'missing_file', mode: 'vault_instance' })
      })
      .catch((error) => {
        setPendingNavigation(null)
        setToastMessage(shellOpenErrorMessage('open_failed', locale, errorDetail(error)))
        trackEvent('shell_markdown_opened', { outcome: 'failed', reason: 'open_failed', mode: 'vault_instance' })
      })
      .finally(() => {
        if (activeAttemptRef.current === key) activeAttemptRef.current = null
      })
  }, [
    currentVaultPath,
    enabled,
    entries,
    locale,
    onSelectNote,
    pendingNavigation,
    reloadVault,
    setPendingNavigation,
    setToastMessage,
  ])
}

export function useOpenMarkdownFromShell({
  currentVaultPath,
  enabled,
  entries,
  locale = 'en',
  onSelectNote,
  registerVault,
  reloadVault,
  setToastMessage,
  switchVault,
  vaultListLoaded,
  vaults,
}: UseOpenMarkdownFromShellConfig) {
  const [pendingPayload, setPendingPayload] = useState<ShellMarkdownOpenPayload | null>(null)
  const [pendingNavigation, setPendingNavigation] = useState<ShellMarkdownNavigation | null>(null)

  const queuedKeyRef = useRef<string | null>(null)
  const queuePayload = useCallback((payload: ShellMarkdownOpenPayload) => {
    const navigation = normalizeShellMarkdownNavigation(payload)
    if (navigation) {
      const key = navigationKey(navigation)
      if (queuedKeyRef.current === key) return
      queuedKeyRef.current = key
    }
    setPendingPayload(payload)
  }, [])

  useShellMarkdownPayloadListener({ enabled, queuePayload })
  useShellMarkdownResolver({
    currentVaultPath,
    enabled,
    locale,
    pendingPayload,
    registerVault,
    setPendingNavigation,
    setPendingPayload,
    setToastMessage,
    switchVault,
    vaultListLoaded,
    vaults,
  })
  useShellMarkdownNavigation({
    currentVaultPath,
    enabled,
    entries,
    locale,
    onSelectNote,
    pendingNavigation,
    reloadVault,
    setPendingNavigation,
    setToastMessage,
  })
}
