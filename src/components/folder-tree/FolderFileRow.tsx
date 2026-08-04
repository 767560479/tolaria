import { FileText } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { VaultEntry } from '../../types'
import { getFolderDepthIndent, FOLDER_ROW_CONTENT_INSET } from './folderTreeLayout'
import type { MouseEvent as ReactMouseEvent } from 'react'

interface FolderFileRowProps {
  depth: number
  entry: VaultEntry
  isActive: boolean
  onOpen: (entry: VaultEntry) => void
  onContextMenu?: (entry: VaultEntry, event: ReactMouseEvent<HTMLElement>) => void
}

export function FolderFileRow({ depth, entry, isActive, onOpen, onContextMenu }: FolderFileRowProps) {
  const depthIndent = getFolderDepthIndent(depth)
  const label = entry.filename || entry.title

  return (
    <div
      className={cn(
        'group relative flex items-center gap-1 rounded transition-colors',
        isActive
          ? 'bg-[var(--accent-blue-light)] text-primary'
          : 'text-foreground hover:bg-accent',
      )}
      style={{ paddingLeft: depthIndent, borderRadius: 4 }}
      data-testid={`folder-file:${entry.path}`}
      onContextMenu={(event) => onContextMenu?.(entry, event)}
    >
      <Button
        type="button"
        variant="ghost"
        className={cn(
          'h-auto min-h-0 flex-1 justify-start gap-1.5 rounded-none px-0 py-1 text-left font-normal shadow-none hover:bg-transparent',
          isActive ? 'text-primary' : 'text-foreground',
        )}
        style={{ paddingLeft: FOLDER_ROW_CONTENT_INSET }}
        onClick={() => onOpen(entry)}
      >
        <FileText size={14} className="shrink-0 text-muted-foreground" weight={isActive ? 'fill' : 'regular'} />
        <span className="min-w-0 truncate text-[13px]">{label}</span>
      </Button>
    </div>
  )
}
