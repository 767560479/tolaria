import { memo, useCallback, useMemo, type MouseEvent as ReactMouseEvent } from 'react'
import type { FolderCreationParent, FolderNode, SidebarSelection, VaultEntry } from '../../types'
import { FolderNameInput } from './FolderNameInput'
import { FolderItemRow } from './FolderItemRow'
import { FolderFileRow } from './FolderFileRow'
import { FOLDER_ROW_CONTENT_INSET, getFolderConnectorLeft, getFolderDepthIndent } from './folderTreeLayout'
import { folderNodeKey } from './folderTreeUtils'
import { filesForFolderNode } from './folderTreeFiles'
import { notePathsMatch } from '../../utils/notePathIdentity'
import { translate, type AppLocale } from '../../lib/i18n'
import type { AllNotesFileVisibility } from '../../utils/allNotesFileVisibility'

interface FolderTreeRowProps {
  depth: number
  expanded: Record<string, boolean>
  node: FolderNode
  entries?: VaultEntry[]
  activeNotePath?: string | null
  allNotesFileVisibility?: AllNotesFileVisibility
  creationParent?: FolderCreationParent
  isCreating?: boolean
  onCancelCreateFolder?: () => void
  onCreateFolderSubmit?: (value: string) => Promise<boolean>
  onDeleteFolder?: (folderPath: string) => void
  onOpenMenu: (node: FolderNode, event: ReactMouseEvent<HTMLElement>) => void
  onRenameFolder?: (folderPath: string, nextName: string) => Promise<boolean> | boolean
  onSelect: (selection: SidebarSelection) => void
  onSelectNote?: (entry: VaultEntry) => void
  onStartRenameFolder?: (folderPath: string) => void
  onToggle: (path: string) => void
  onCancelRenameFolder?: () => void
  onCanDropNote?: (notePath: string, folderPath: string) => boolean
  onMoveNoteToFolder?: (notePath: string, folderPath: string) => Promise<unknown> | unknown
  locale?: AppLocale
  renamingFolderPath?: string | null
  rootPath?: string
  selection: SidebarSelection
}

function FolderRenameRow({
  contentInset,
  depthIndent,
  node,
  locale,
  onCancelRenameFolder,
  onRenameFolder,
}: {
  contentInset: number
  depthIndent: number
  node: FolderNode
  locale: AppLocale
  onCancelRenameFolder: () => void
  onRenameFolder: (folderPath: string, nextName: string) => Promise<boolean> | boolean
}) {
  return (
    <div style={{ paddingLeft: depthIndent }}>
      <FolderNameInput
        ariaLabel={translate(locale, 'sidebar.folder.name')}
        initialValue={node.name}
        placeholder={translate(locale, 'sidebar.folder.name')}
        leftInset={contentInset}
        selectTextOnFocus={true}
        submitOnBlur={true}
        testId="rename-folder-input"
        onCancel={onCancelRenameFolder}
        onSubmit={(nextName) => onRenameFolder(node.path, nextName)}
      />
    </div>
  )
}

function FolderCreateRow({
  contentInset,
  depth,
  node,
  locale,
  onCancelCreateFolder,
  onCreateFolderSubmit,
}: {
  contentInset: number
  depth: number
  node: FolderNode
  locale: AppLocale
  onCancelCreateFolder: () => void
  onCreateFolderSubmit: (value: string) => Promise<boolean>
}) {
  return (
    <div
      data-testid={`folder-create-parent:${node.path}`}
      style={{ paddingLeft: getFolderDepthIndent(depth + 1) }}
    >
      <FolderNameInput
        ariaLabel={translate(locale, 'sidebar.folder.newName')}
        initialValue=""
        leftInset={contentInset}
        placeholder={translate(locale, 'sidebar.folder.name')}
        submitOnBlur={true}
        testId="new-folder-input"
        onCancel={onCancelCreateFolder}
        onSubmit={onCreateFolderSubmit}
      />
    </div>
  )
}

function FolderCreateRowSlot({
  contentInset,
  creationParent,
  depth,
  isCreating,
  node,
  locale,
  onCancelCreateFolder,
  onCreateFolderSubmit,
  rootPath,
}: {
  contentInset: number
  creationParent?: FolderCreationParent
  depth: number
  isCreating: boolean
  node: FolderNode
  locale: AppLocale
  onCancelCreateFolder?: () => void
  onCreateFolderSubmit?: (value: string) => Promise<boolean>
  rootPath?: string
}) {
  if (!isCreating) return null
  if (!creationParentMatchesNode(creationParent, node, rootPath)) return null
  if (!onCancelCreateFolder || !onCreateFolderSubmit) return null

  return (
    <FolderCreateRow
      contentInset={contentInset}
      depth={depth}
      node={node}
      locale={locale}
      onCancelCreateFolder={onCancelCreateFolder}
      onCreateFolderSubmit={onCreateFolderSubmit}
    />
  )
}

function FolderChildren({
  creationParent,
  depth,
  expanded,
  isCreating,
  node,
  entries = [],
  activeNotePath,
  allNotesFileVisibility,
  onCancelCreateFolder,
  onCreateFolderSubmit,
  onDeleteFolder,
  onOpenMenu,
  onRenameFolder,
  onSelect,
  onSelectNote,
  onStartRenameFolder,
  onToggle,
  onCancelRenameFolder,
  onCanDropNote,
  onMoveNoteToFolder,
  locale,
  renamingFolderPath,
  rootPath,
  selection,
}: FolderTreeRowProps) {
  const nodeRootPath = node.rootPath ?? rootPath
  const isExpanded = expanded[folderNodeKey({ path: node.path, rootPath: nodeRootPath })] ?? false
  const files = useMemo(
    () => filesForFolderNode(entries, { path: node.path, rootPath: nodeRootPath }, allNotesFileVisibility),
    [allNotesFileVisibility, entries, node.path, nodeRootPath],
  )
  const hasFolderChildren = node.children.length > 0
  const hasContent = hasFolderChildren || files.length > 0
  if (!isExpanded || !hasContent) return null

  return (
    <div className="relative" data-testid={`folder-children:${node.path}`}>
      <div
        className="absolute top-0 bottom-0 bg-border"
        data-testid={`folder-connector:${node.path}`}
        style={{ left: getFolderConnectorLeft(depth), width: 1 }}
      />
      {node.children.map((child) => (
        <FolderTreeRow
          key={folderNodeKey({ path: child.path, rootPath: child.rootPath ?? rootPath })}
          depth={depth + 1}
          expanded={expanded}
          node={child}
          entries={entries}
          activeNotePath={activeNotePath}
          allNotesFileVisibility={allNotesFileVisibility}
          creationParent={creationParent}
          isCreating={isCreating}
          onCancelCreateFolder={onCancelCreateFolder}
          onCreateFolderSubmit={onCreateFolderSubmit}
          onDeleteFolder={onDeleteFolder}
          onOpenMenu={onOpenMenu}
          onRenameFolder={onRenameFolder}
          onSelect={onSelect}
          onSelectNote={onSelectNote}
          onStartRenameFolder={onStartRenameFolder}
          onToggle={onToggle}
          onCancelRenameFolder={onCancelRenameFolder}
          onCanDropNote={onCanDropNote}
          onMoveNoteToFolder={onMoveNoteToFolder}
          locale={locale}
          renamingFolderPath={renamingFolderPath}
          rootPath={rootPath}
          selection={selection}
        />
      ))}
      {files.map((entry) => (
        <FolderFileRow
          key={entry.path}
          depth={depth + 1}
          entry={entry}
          isActive={notePathsMatch(activeNotePath, entry.path)}
          onOpen={(file) => {
            onSelect(nodeRootPath
              ? { kind: 'folder', path: node.path, rootPath: nodeRootPath }
              : { kind: 'folder', path: node.path })
            onSelectNote?.(file)
          }}
        />
      ))}
    </div>
  )
}

function creationParentMatchesNode(
  creationParent: FolderCreationParent | undefined,
  node: FolderNode,
  defaultRootPath?: string,
): boolean {
  if (!creationParent || creationParent.path !== node.path) return false
  const nodeRootPath = node.rootPath ?? defaultRootPath
  const creationRootPath = creationParent.rootPath ?? defaultRootPath
  return nodeRootPath === creationRootPath
}

function folderSelectionMatches(
  selection: SidebarSelection,
  node: FolderNode,
  defaultRootPath?: string,
): boolean {
  if (selection.kind !== 'folder' || selection.path !== node.path) return false

  const nodeRootPath = node.rootPath ?? defaultRootPath
  if (!nodeRootPath) return !selection.rootPath
  if (selection.rootPath) return selection.rootPath === nodeRootPath
  return nodeRootPath === defaultRootPath
}

export const FolderTreeRow = memo(function FolderTreeRow({
  creationParent,
  depth,
  expanded,
  isCreating = false,
  node,
  entries = [],
  activeNotePath,
  allNotesFileVisibility,
  onCancelCreateFolder,
  onCreateFolderSubmit,
  onDeleteFolder,
  onOpenMenu,
  onRenameFolder,
  onSelect,
  onSelectNote,
  onStartRenameFolder,
  onToggle,
  onCancelRenameFolder,
  onCanDropNote,
  onMoveNoteToFolder,
  locale = 'en',
  renamingFolderPath,
  rootPath,
  selection,
}: FolderTreeRowProps) {
  const nodeKey = folderNodeKey({ path: node.path, rootPath: node.rootPath ?? rootPath })
  const nodeRootPath = node.rootPath ?? rootPath
  const isExpanded = expanded[nodeKey] ?? false
  const isSelected = folderSelectionMatches(selection, { ...node, rootPath: nodeRootPath }, rootPath)
  const canUseDefaultFolderActions = !nodeRootPath || nodeRootPath === rootPath
  const canMutateFolder = node.path.length > 0 && canUseDefaultFolderActions
  const isRenaming = canMutateFolder && renamingFolderPath === node.path
  const depthIndent = getFolderDepthIndent(depth)
  const contentInset = FOLDER_ROW_CONTENT_INSET
  const folderFiles = useMemo(
    () => filesForFolderNode(entries, { path: node.path, rootPath: nodeRootPath }, allNotesFileVisibility),
    [allNotesFileVisibility, entries, node.path, nodeRootPath],
  )
  const hasExpandableContent = node.children.length > 0 || folderFiles.length > 0
  const selectFolder = useCallback(() => {
    onSelect(nodeRootPath
      ? { kind: 'folder', path: node.path, rootPath: nodeRootPath }
      : { kind: 'folder', path: node.path })
  }, [node.path, nodeRootPath, onSelect])
  const row = (
    <FolderItemRow
      canOpenMenu={canUseDefaultFolderActions}
      contentInset={contentInset}
      depthIndent={depthIndent}
      isExpanded={isExpanded}
      isSelected={isSelected}
      node={node}
      hasChildren={hasExpandableContent}
      onOpenMenu={onOpenMenu}
      onSelect={selectFolder}
      onStartRenameFolder={canMutateFolder ? onStartRenameFolder : undefined}
      onToggle={() => onToggle(nodeKey)}
      onCanDropNote={onCanDropNote}
      onMoveNoteToFolder={onMoveNoteToFolder}
    />
  )

  return (
    <>
      {isRenaming && onRenameFolder && onCancelRenameFolder ? (
        <FolderRenameRow
          contentInset={contentInset}
          depthIndent={depthIndent}
          node={node}
          locale={locale}
          onCancelRenameFolder={onCancelRenameFolder}
          onRenameFolder={onRenameFolder}
        />
      ) : row}
      <FolderCreateRowSlot
        contentInset={contentInset}
        creationParent={creationParent}
        depth={depth}
        isCreating={isCreating}
        node={node}
        locale={locale}
        onCancelCreateFolder={onCancelCreateFolder}
        onCreateFolderSubmit={onCreateFolderSubmit}
        rootPath={rootPath}
      />
      <FolderChildren
        creationParent={creationParent}
        depth={depth}
        expanded={expanded}
        isCreating={isCreating}
        node={node}
        entries={entries}
        activeNotePath={activeNotePath}
        allNotesFileVisibility={allNotesFileVisibility}
        onCancelCreateFolder={onCancelCreateFolder}
        onCreateFolderSubmit={onCreateFolderSubmit}
        onDeleteFolder={onDeleteFolder}
        onOpenMenu={onOpenMenu}
        onRenameFolder={onRenameFolder}
        onSelect={onSelect}
        onSelectNote={onSelectNote}
        onStartRenameFolder={onStartRenameFolder}
        onToggle={onToggle}
        onCancelRenameFolder={onCancelRenameFolder}
        onCanDropNote={onCanDropNote}
        onMoveNoteToFolder={onMoveNoteToFolder}
        locale={locale}
        renamingFolderPath={renamingFolderPath}
        rootPath={rootPath}
        selection={selection}
      />
    </>
  )
})
