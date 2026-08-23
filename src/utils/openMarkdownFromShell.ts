import { normalizeNotePathSeparators } from './notePathIdentity'

export const SHELL_OPEN_MARKDOWN_EVENT = 'tolaria-open-markdown'

export interface ShellMarkdownOpenPayload {
  markdownPath: string
  relativeNote: string
  vaultPath: string
}

export type ShellMarkdownOpenError =
  | 'invalid_payload'
  | 'missing_file'
  | 'not_markdown'
  | 'open_failed'

export interface ShellMarkdownNavigation {
  markdownPath: string
  relativeNote: string
  vaultPath: string
}

export function isShellMarkdownOpenPayload(value: unknown): value is ShellMarkdownOpenPayload {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.markdownPath === 'string'
    && typeof candidate.vaultPath === 'string'
    && typeof candidate.relativeNote === 'string'
    && candidate.markdownPath.length > 0
    && candidate.vaultPath.length > 0
    && candidate.relativeNote.length > 0
}

export function shellMarkdownVaultLabel(vaultPath: string): string {
  const segments = normalizeNotePathSeparators(vaultPath).split('/').filter(Boolean)
  return segments.at(-1) || 'Local Vault'
}

export function shellMarkdownNoteTitle(relativeNote: string): string {
  const stem = relativeNote.replace(/\.md$/iu, '')
  return stem || relativeNote
}

export function normalizeShellMarkdownNavigation(
  payload: ShellMarkdownOpenPayload,
): ShellMarkdownNavigation | null {
  const markdownPath = normalizeNotePathSeparators(payload.markdownPath).replace(/\/+$/u, '')
  const vaultPath = normalizeNotePathSeparators(payload.vaultPath).replace(/\/+$/u, '')
  const relativeNote = normalizeNotePathSeparators(payload.relativeNote).replace(/^\/+/u, '')
  if (!markdownPath || !vaultPath || !relativeNote || relativeNote.includes('/')) return null
  if (!relativeNote.toLocaleLowerCase().endsWith('.md')) return null
  return { markdownPath, vaultPath, relativeNote }
}
