import { X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Tab } from '../hooks/useTabManagement'
import { notePathsMatch } from '../utils/notePathIdentity'
import { translate, type AppLocale } from '../lib/i18n'

interface EditorTabBarProps {
  tabs: Tab[]
  activeTabPath: string | null
  dirtyPaths?: ReadonlySet<string>
  onSelectTab: (path: string) => void
  onCloseTab: (path: string) => void
  locale?: AppLocale
}

function isDirty(path: string, dirtyPaths?: ReadonlySet<string>): boolean {
  return dirtyPaths?.has(path) === true
}

export function EditorTabBar({
  tabs,
  activeTabPath,
  dirtyPaths,
  onSelectTab,
  onCloseTab,
  locale = 'en',
}: EditorTabBarProps) {
  if (tabs.length === 0) return null

  return (
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
  )
}
