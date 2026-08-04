import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { translate, type AppLocale } from '../../lib/i18n'
import { trackEvent } from '../../lib/telemetry'
import type { VaultEntry } from '../../types'
import type { NoteListContextMenuState } from './NoteListContextMenu'
import { getContextMenuPositionStyle } from '../contextMenuPosition'
import {
  buildNoteContextMenuItems,
  type NoteContextMenuActions,
  type NoteContextMenuItem,
} from '../note-context-menu/noteContextMenuItems'

interface NoteListContextMenuNodeProps extends NoteContextMenuActions {
  ctxMenu: NoteListContextMenuState | null
  ctxMenuRef: RefObject<HTMLDivElement | null>
  onClose: () => void
}

function NoteListContextMenuButton({ item }: { item: NoteContextMenuItem }) {
  const IconComponent = item.icon
  return (
    <Button
      type="button"
      variant="ghost"
      className={`flex h-auto w-full cursor-default items-center justify-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${item.destructive ? 'text-destructive hover:text-destructive' : ''}`}
      onClick={item.onSelect}
    >
      <IconComponent size={16} weight={item.iconWeight} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
      {item.shortcut && <span className="ml-4 shrink-0 text-xs text-muted-foreground">{item.shortcut}</span>}
    </Button>
  )
}

export function NoteListContextMenuNode(props: NoteListContextMenuNodeProps) {
  const {
    ctxMenu,
    ctxMenuRef,
    locale,
    onEnterNeighborhood,
    onOpenInNewWindow,
    onRequestRename,
    onMoveToFolder,
    onDuplicate,
    onArchivePaths,
    onDeletePaths,
    onExportPdf,
    onToggleFavorite,
    onToggleOrganized,
    onRevealFile,
    onCopyFilePath,
    canCopyGitUrl,
    onCopyGitUrl,
    onClose,
  } = props

  if (!ctxMenu) return null

  const { entry } = ctxMenu
  const selectAction = (action: string, run: () => void) => {
    trackEvent('note_item_context_menu_action', { action })
    onClose()
    run()
  }
  const items = buildNoteContextMenuItems({
    locale,
    onEnterNeighborhood,
    onOpenInNewWindow,
    onRequestRename,
    onMoveToFolder,
    onDuplicate,
    onArchivePaths,
    onDeletePaths,
    onExportPdf,
    onToggleFavorite,
    onToggleOrganized,
    onRevealFile,
    onCopyFilePath,
    canCopyGitUrl,
    onCopyGitUrl,
  }, entry, selectAction)

  return createPortal(
    <div
      ref={ctxMenuRef}
      className="fixed z-[12000] rounded-md border bg-popover p-1 shadow-md"
      style={getContextMenuPositionStyle(ctxMenu, { minWidth: 240 })}
      data-testid="note-list-context-menu"
    >
      {items.map((item) => <NoteListContextMenuButton key={item.label} item={item} />)}
    </div>,
    document.body,
  )
}

function renameDialogInitialFilenameStem(entry: VaultEntry): string {
  return entry.filename.replace(/\.md$/i, '').trim()
}

function normalizeRenameFilenameStem(value: string): string {
  return value.trim().replace(/\.md$/i, '').trim()
}

function renameDialogTargetFilenameStem(draftFilenameStem: string, initialFilenameStem: string): string | null {
  const nextFilenameStem = normalizeRenameFilenameStem(draftFilenameStem)
  if (!nextFilenameStem || nextFilenameStem === initialFilenameStem) return null
  return nextFilenameStem
}

function NoteListRenameForm({
  entry,
  locale,
  onClose,
  onRename,
}: {
  entry: VaultEntry
  locale: AppLocale
  onClose: () => void
  onRename: (newFilenameStem: string) => void
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const initialFilenameStem = renameDialogInitialFilenameStem(entry)
  const [draftFilenameStem, setDraftFilenameStem] = useState(initialFilenameStem)

  useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 50)

    return () => window.clearTimeout(focusTimer)
  }, [])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextFilenameStem = renameDialogTargetFilenameStem(draftFilenameStem, initialFilenameStem)
    if (!nextFilenameStem) {
      onClose()
      return
    }

    trackEvent('note_item_context_menu_rename_filename_submitted')
    onRename(nextFilenameStem)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
          {translate(locale, 'noteList.rename.nameLabel')}
        </label>
        <Input
          id={inputId}
          ref={inputRef}
          value={draftFilenameStem}
          onChange={(event) => setDraftFilenameStem(event.target.value)}
          data-testid="note-list-rename-input"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {translate(locale, 'noteList.rename.cancel')}
        </Button>
        <Button type="submit" disabled={!renameDialogTargetFilenameStem(draftFilenameStem, initialFilenameStem)}>
          {translate(locale, 'noteList.rename.confirm')}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function NoteListRenameDialog({
  entry,
  locale,
  onClose,
  onRename,
}: {
  entry: VaultEntry | null
  locale: AppLocale
  onClose: () => void
  onRename: (newFilenameStem: string) => void
}) {
  return (
    <Dialog open={Boolean(entry)} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent showCloseButton={false} className="sm:max-w-[420px]" data-testid="note-list-rename-dialog">
        <DialogHeader>
          <DialogTitle>{translate(locale, 'noteList.rename.title')}</DialogTitle>
          <DialogDescription className="sr-only">
            {translate(locale, 'noteList.rename.description')}
          </DialogDescription>
        </DialogHeader>
        {entry && (
          <NoteListRenameForm
            key={entry.path}
            entry={entry}
            locale={locale}
            onClose={onClose}
            onRename={onRename}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
