import {
  Archive,
  ArrowSquareOut,
  CheckCircle,
  ClipboardText,
  Copy,
  FilePdf,
  FolderOpen,
  FolderSimple,
  GitBranch,
  MapTrifold,
  PencilSimple,
  Star,
  Trash,
  type Icon,
} from '@phosphor-icons/react'
import { APP_COMMAND_IDS, getAppCommandShortcutDisplay } from '../../hooks/appCommandCatalog'
import { translate, type AppLocale } from '../../lib/i18n'
import type { VaultEntry } from '../../types'
import { isMarkdownEntry } from '../../utils/typeDefinitions'

export interface NoteContextMenuItem {
  destructive?: boolean
  icon: Icon
  iconWeight?: 'bold' | 'fill' | 'regular'
  label: string
  onSelect: () => void
  shortcut?: string
}

export type SelectNoteContextAction = (action: string, run: () => void) => void

export interface NoteContextMenuActions {
  locale: AppLocale
  onEnterNeighborhood?: (entry: VaultEntry) => void
  onOpenInNewWindow?: (entry: VaultEntry) => void
  onRequestRename?: (entry: VaultEntry) => void
  onMoveToFolder?: (entry: VaultEntry) => void
  onDuplicate?: (entry: VaultEntry) => void
  onArchivePaths?: (paths: string[]) => void
  onDeletePaths?: (paths: string[]) => void
  onExportPdf?: (entry: VaultEntry) => void
  onToggleFavorite?: (path: string) => void
  onToggleOrganized?: (path: string) => void
  onRevealFile?: (path: string) => void
  onCopyFilePath?: (path: string) => void
  canCopyGitUrl?: (entry: VaultEntry) => boolean
  onCopyGitUrl?: (entry: VaultEntry) => void
}

function openWindowItem(
  entry: VaultEntry,
  locale: AppLocale,
  onOpenInNewWindow: ((entry: VaultEntry) => void) | undefined,
  selectAction: SelectNoteContextAction,
): NoteContextMenuItem[] {
  if (!onOpenInNewWindow) return []
  return [{
    icon: ArrowSquareOut,
    label: translate(locale, 'command.note.openNewWindow'),
    onSelect: () => selectAction('open_new_window', () => onOpenInNewWindow(entry)),
    shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.noteOpenInNewWindow),
  }]
}

function favoriteItem(
  entry: VaultEntry,
  locale: AppLocale,
  onToggleFavorite: ((path: string) => void) | undefined,
  selectAction: SelectNoteContextAction,
): NoteContextMenuItem[] {
  if (!onToggleFavorite) return []
  return [{
    icon: Star,
    iconWeight: entry.favorite ? 'fill' as const : 'regular' as const,
    label: translate(locale, entry.favorite ? 'command.note.removeFavorite' : 'command.note.addFavorite'),
    onSelect: () => selectAction('toggle_favorite', () => onToggleFavorite(entry.path)),
    shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.noteToggleFavorite),
  }]
}

function organizedItem(
  entry: VaultEntry,
  locale: AppLocale,
  onToggleOrganized: ((path: string) => void) | undefined,
  selectAction: SelectNoteContextAction,
): NoteContextMenuItem[] {
  if (!onToggleOrganized || !isMarkdownEntry(entry)) return []
  return [{
    icon: CheckCircle,
    iconWeight: entry.organized ? 'fill' as const : 'regular' as const,
    label: translate(locale, entry.organized ? 'command.note.markUnorganized' : 'command.note.markOrganized'),
    onSelect: () => selectAction('toggle_organized', () => onToggleOrganized(entry.path)),
    shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.noteToggleOrganized),
  }]
}

function renameItem(
  entry: VaultEntry,
  locale: AppLocale,
  onRequestRename: ((entry: VaultEntry) => void) | undefined,
  selectAction: SelectNoteContextAction,
): NoteContextMenuItem[] {
  if (!onRequestRename || !isMarkdownEntry(entry)) return []
  return [{
    icon: PencilSimple,
    label: translate(locale, 'noteList.context.renameNote'),
    onSelect: () => selectAction('rename_filename', () => onRequestRename(entry)),
  }]
}

function moveToFolderItem(
  entry: VaultEntry,
  locale: AppLocale,
  onMoveToFolder: ((entry: VaultEntry) => void) | undefined,
  selectAction: SelectNoteContextAction,
): NoteContextMenuItem[] {
  if (!onMoveToFolder) return []
  return [{
    icon: FolderSimple,
    label: translate(locale, 'command.note.moveToFolder'),
    onSelect: () => selectAction('move_to_folder', () => onMoveToFolder(entry)),
  }]
}

function duplicateItem(
  entry: VaultEntry,
  locale: AppLocale,
  onDuplicate: ((entry: VaultEntry) => void) | undefined,
  selectAction: SelectNoteContextAction,
): NoteContextMenuItem[] {
  if (!onDuplicate) return []
  return [{
    icon: Copy,
    label: translate(locale, 'noteList.context.duplicateNote'),
    onSelect: () => selectAction('duplicate', () => onDuplicate(entry)),
  }]
}

function neighborhoodItem(
  entry: VaultEntry,
  locale: AppLocale,
  onEnterNeighborhood: ((entry: VaultEntry) => void) | undefined,
  selectAction: SelectNoteContextAction,
): NoteContextMenuItem[] {
  if (!onEnterNeighborhood || entry.fileKind === 'binary') return []
  return [{
    icon: MapTrifold,
    label: translate(locale, 'editor.toolbar.openNeighborhood'),
    onSelect: () => selectAction('open_neighborhood', () => onEnterNeighborhood(entry)),
  }]
}

function revealFileItem(
  entry: VaultEntry,
  locale: AppLocale,
  onRevealFile: ((path: string) => void) | undefined,
  selectAction: SelectNoteContextAction,
): NoteContextMenuItem[] {
  if (!onRevealFile) return []
  return [{
    icon: FolderOpen,
    label: translate(locale, 'editor.toolbar.revealFile'),
    onSelect: () => selectAction('reveal_file', () => onRevealFile(entry.path)),
  }]
}

function copyFilePathItem(
  entry: VaultEntry,
  locale: AppLocale,
  onCopyFilePath: ((path: string) => void) | undefined,
  selectAction: SelectNoteContextAction,
): NoteContextMenuItem[] {
  if (!onCopyFilePath) return []
  return [{
    icon: ClipboardText,
    label: translate(locale, 'editor.toolbar.copyFilePath'),
    onSelect: () => selectAction('copy_file_path', () => onCopyFilePath(entry.path)),
  }]
}

function copyGitUrlItem(
  entry: VaultEntry,
  locale: AppLocale,
  canCopyGitUrl: ((entry: VaultEntry) => boolean) | undefined,
  onCopyGitUrl: ((entry: VaultEntry) => void) | undefined,
  selectAction: SelectNoteContextAction,
): NoteContextMenuItem[] {
  if (!onCopyGitUrl || !canCopyGitUrl?.(entry)) return []
  return [{
    icon: GitBranch,
    label: translate(locale, 'editor.toolbar.copyNoteGitUrl'),
    onSelect: () => selectAction('copy_git_url', () => onCopyGitUrl(entry)),
  }]
}

function exportPdfItem(
  entry: VaultEntry,
  locale: AppLocale,
  onExportPdf: ((entry: VaultEntry) => void) | undefined,
  selectAction: SelectNoteContextAction,
): NoteContextMenuItem[] {
  if (!onExportPdf || !isMarkdownEntry(entry)) return []
  return [{
    icon: FilePdf,
    label: translate(locale, 'editor.toolbar.exportPdf'),
    onSelect: () => selectAction('export_pdf', () => onExportPdf(entry)),
    shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.noteExportPdf),
  }]
}

function archiveItem(
  entry: VaultEntry,
  locale: AppLocale,
  onArchivePaths: ((paths: string[]) => void) | undefined,
  selectAction: SelectNoteContextAction,
): NoteContextMenuItem[] {
  if (!onArchivePaths || entry.archived) return []
  return [{
    icon: Archive,
    label: translate(locale, 'editor.toolbar.archive'),
    onSelect: () => selectAction('archive', () => onArchivePaths([entry.path])),
  }]
}

function deleteItem(
  entry: VaultEntry,
  locale: AppLocale,
  onDeletePaths: ((paths: string[]) => void) | undefined,
  selectAction: SelectNoteContextAction,
): NoteContextMenuItem[] {
  if (!onDeletePaths) return []
  return [{
    destructive: true,
    icon: Trash,
    label: translate(locale, 'editor.toolbar.delete'),
    onSelect: () => selectAction('delete', () => onDeletePaths([entry.path])),
    shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.noteDelete),
  }]
}

export function buildNoteContextMenuItems(
  props: NoteContextMenuActions,
  entry: VaultEntry,
  selectAction: SelectNoteContextAction,
): NoteContextMenuItem[] {
  return [
    ...openWindowItem(entry, props.locale, props.onOpenInNewWindow, selectAction),
    ...favoriteItem(entry, props.locale, props.onToggleFavorite, selectAction),
    ...organizedItem(entry, props.locale, props.onToggleOrganized, selectAction),
    ...renameItem(entry, props.locale, props.onRequestRename, selectAction),
    ...moveToFolderItem(entry, props.locale, props.onMoveToFolder, selectAction),
    ...duplicateItem(entry, props.locale, props.onDuplicate, selectAction),
    ...neighborhoodItem(entry, props.locale, props.onEnterNeighborhood, selectAction),
    ...revealFileItem(entry, props.locale, props.onRevealFile, selectAction),
    ...copyFilePathItem(entry, props.locale, props.onCopyFilePath, selectAction),
    ...copyGitUrlItem(entry, props.locale, props.canCopyGitUrl, props.onCopyGitUrl, selectAction),
    ...exportPdfItem(entry, props.locale, props.onExportPdf, selectAction),
    ...archiveItem(entry, props.locale, props.onArchivePaths, selectAction),
    ...deleteItem(entry, props.locale, props.onDeletePaths, selectAction),
  ]
}

export function hasNoteContextMenuActions(
  actions: Omit<NoteContextMenuActions, 'locale'> & { entry: VaultEntry },
): boolean {
  const { entry } = actions
  return [
    actions.onOpenInNewWindow,
    actions.onRequestRename && isMarkdownEntry(entry),
    actions.onMoveToFolder,
    actions.onDuplicate,
    actions.onEnterNeighborhood && entry.fileKind !== 'binary',
    actions.onExportPdf && isMarkdownEntry(entry),
    actions.onArchivePaths && !entry.archived,
    actions.onDeletePaths,
    actions.onToggleFavorite,
    actions.onToggleOrganized && isMarkdownEntry(entry),
    actions.onRevealFile,
    actions.onCopyFilePath,
    actions.onCopyGitUrl && actions.canCopyGitUrl?.(entry),
  ].some(Boolean)
}
