import { useMemo } from 'react'
import { Tag } from '@phosphor-icons/react'
import type { SidebarSelection } from '../../types'
import { isSelectionActive, NavItem } from '../SidebarParts'
import { SidebarGroupHeader } from './SidebarGroupHeader'
import { SIDEBAR_SECTION_CONTENT_PADDING_BOTTOM } from './sidebarStyles'
import { aggregateVaultTags } from '../../utils/noteTags'
import type { VaultEntry } from '../../types'
import { translate, type AppLocale } from '../../lib/i18n'

export function TagsSection({
  entries,
  selection,
  onSelect,
  collapsed,
  onToggle,
  locale = 'en',
}: {
  entries: VaultEntry[]
  selection: SidebarSelection
  onSelect: (selection: SidebarSelection) => void
  collapsed: boolean
  onToggle: () => void
  locale?: AppLocale
}) {
  const tags = useMemo(() => aggregateVaultTags(entries), [entries])
  if (tags.length === 0) return null

  return (
    <div className="border-b border-border" style={{ padding: '0 6px' }} data-testid="sidebar-tags">
      <SidebarGroupHeader
        label={translate(locale, 'sidebar.group.tags')}
        collapsed={collapsed}
        onToggle={onToggle}
      />
      {!collapsed && (
        <div className="flex flex-col gap-0.5" style={{ paddingBottom: SIDEBAR_SECTION_CONTENT_PADDING_BOTTOM }}>
          {tags.map(({ tag, count }) => (
            <NavItem
              key={tag}
              icon={Tag}
              label={tag}
              count={count}
              compact
              isActive={isSelectionActive(selection, { kind: 'tag', tag })}
              badgeClassName="text-muted-foreground"
              badgeStyle={{ background: 'var(--muted)' }}
              activeBadgeClassName="bg-primary text-primary-foreground"
              onClick={() => onSelect({ kind: 'tag', tag })}
            />
          ))}
        </div>
      )}
    </div>
  )
}
