import { useCallback, type MouseEvent as ReactMouseEvent, type RefObject } from 'react'
import { X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Tab } from '../hooks/useTabManagement'
import { notePathsMatch } from '../utils/notePathIdentity'
import { translate, type AppLocale } from '../lib/i18n'
import { trackEvent } from '../lib/telemetry'
import { getContextMenuPositionStyle } from './contextMenuPosition'
import { useSidebarContextMenu } from './sidebar/sidebarHooks'

interface EditorTabBarProps {
  tabs: Tab[]
  activeTabPath: string | null
  dirtyPaths?: ReadonlySet<string>
  onSelectTab: (path: string) => void
  onCloseTab: (path: string) => void
  onCloseOtherTabs?: (path: string) => void
  onCloseAllTabs?: () => void
  locale?: AppLocale
}

function isDirty(path: string, dirtyPaths?: ReadonlySet<string>): boolean {
  return dirtyPaths?.has(path) === true
}

type TabMenuAction = 'close' | 'close_others' | 'close_all'

function EditorTabContextMenu({
  menu,
  menuRef,
  locale,
  onClose,
  onCloseTab,
  onCloseOtherTabs,
  onCloseAllTabs,
  hasOtherTabs,
}: {
  menu: { path: string; x: number; y: number } | null
  menuRef: RefObject<HTMLDivElement | null>
  locale: AppLocale
  onClose: () => void
  onCloseTab: (path: string) => void
  onCloseOtherTabs?: (path: string) => void
  onCloseAllTabs?: () => void
  hasOtherTabs: boolean
}) {
  if (!menu) return null

  const run = (action: TabMenuAction, fn: () => void) => {
    trackEvent('editor_tab_context_menu', { action })
    onClose()
    fn()
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[12000] min-w-[11.25rem] rounded-md border bg-popover p-1 shadow-md"
      style={getContextMenuPositionStyle(menu, { minWidth: 180 })}
      data-testid="editor-tab-context-menu"
    >
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full justify-start px-2 py-1.5 text-sm"
        data-testid="editor-tab-menu-close"
        onClick={() => run('close', () => onCloseTab(menu.path))}
      >
        {translate(locale, 'editor.tabs.closeMenu')}
      </Button>
      {onCloseOtherTabs && (
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full justify-start px-2 py-1.5 text-sm"
          data-testid="editor-tab-menu-close-others"
          disabled={!hasOtherTabs}
          onClick={() => run('close_others', () => onCloseOtherTabs(menu.path))}
        >
          {translate(locale, 'editor.tabs.closeOthers')}
        </Button>
      )}
      {onCloseAllTabs && (
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full justify-start px-2 py-1.5 text-sm"
          data-testid="editor-tab-menu-close-all"
          onClick={() => run('close_all', () => onCloseAllTabs())}
        >
          {translate(locale, 'editor.tabs.closeAll')}
        </Button>
      )}
    </div>
  )
}

export function EditorTabBar({
  tabs,
  activeTabPath,
  dirtyPaths,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseAllTabs,
  locale = 'en',
}: EditorTabBarProps) {
  const {
    closeContextMenu,
    contextMenu,
    contextMenuRef,
    openContextMenuFromPointer,
  } = useSidebarContextMenu<string>()

  const handleTabContextMenu = useCallback((path: string, event: ReactMouseEvent<HTMLElement>) => {
    openContextMenuFromPointer(path, event)
  }, [openContextMenuFromPointer])

  if (tabs.length === 0) return null

  const menuState = contextMenu
    ? { path: contextMenu.target, x: contextMenu.pos.x, y: contextMenu.pos.y }
    : null

  return (
    <>
      <div
        className="flex shrink-0 items-stretch gap-0.5 overflow-x-auto border-b border-border bg-background px-1"
        data-testid="editor-tab-bar"
        role="tablist"
        aria-label={translate(locale, 'editor.tabs.label')}
      >
        {tabs.map((tab) => {
          const path = tab.entry.path
          const active = notePathsMatch(activeTabPath, path)
          const dirty = isDirty(path, dirtyPaths)
          const label = tab.entry.filename || tab.entry.title || path
          return (
            <div
              key={path}
              role="tab"
              aria-selected={active}
              className={cn(
                'group flex max-w-[220px] items-center gap-1 rounded-t-md border border-b-0 px-2 py-1.5 text-[12px]',
                active
                  ? 'border-border bg-background text-foreground'
                  : 'border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              data-testid={`editor-tab:${path}`}
              onContextMenu={(event) => handleTabContextMenu(path, event)}
            >
              <Button
                type="button"
                variant="ghost"
                className="h-auto min-w-0 flex-1 justify-start gap-1.5 rounded-none p-0 font-normal shadow-none hover:bg-transparent"
                onClick={() => onSelectTab(path)}
              >
                {dirty && (
                  <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                )}
                <span className="min-w-0 truncate">{label}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="h-5 w-5 shrink-0 rounded-sm text-muted-foreground opacity-60 hover:bg-transparent hover:text-foreground group-hover:opacity-100"
                aria-label={translate(locale, 'editor.tabs.close', { name: label })}
                onClick={(event) => {
                  event.stopPropagation()
                  onCloseTab(path)
                }}
              >
                <X size={12} />
              </Button>
            </div>
          )
        })}
      </div>
      <EditorTabContextMenu
        menu={menuState}
        menuRef={contextMenuRef}
        locale={locale}
        onClose={closeContextMenu}
        onCloseTab={onCloseTab}
        onCloseOtherTabs={onCloseOtherTabs}
        onCloseAllTabs={onCloseAllTabs}
        hasOtherTabs={tabs.length > 1}
      />
    </>
  )
}
