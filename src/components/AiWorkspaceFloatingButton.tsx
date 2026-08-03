import { Sparkle } from '@phosphor-icons/react'
import type { AiModelProvider } from '../lib/aiTargets'
import { ActionTooltip } from '@/components/ui/action-tooltip'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { APP_COMMAND_IDS, getAppCommandShortcutDisplay } from '../hooks/appCommandCatalog'
import { translate, type AppLocale } from '../lib/i18n'

interface AiWorkspaceFloatingButtonProps {
  defaultTarget?: string
  locale?: AppLocale
  providers?: AiModelProvider[]
  updateBannerVisible?: boolean
  onOpen: () => void
}

export function AiWorkspaceFloatingButton({
  locale = 'en',
  updateBannerVisible = false,
  onOpen,
}: AiWorkspaceFloatingButtonProps) {
  const label = translate(locale, 'editor.toolbar.openAi')
  const shortcut = getAppCommandShortcutDisplay(APP_COMMAND_IDS.viewToggleAiChat)

  return (
    <ActionTooltip copy={{ label, shortcut }} side="top" align="end" sideOffset={10}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'fixed right-5 z-30 size-12 rounded-full border border-border bg-background text-foreground shadow-[0_10px_28px_rgba(15,23,42,0.18),0_2px_8px_rgba(15,23,42,0.12)] hover:bg-background hover:text-foreground',
          updateBannerVisible ? 'bottom-[80px]' : 'bottom-11',
        )}
        aria-label={label}
        data-testid="ai-workspace-floating-button"
        onClick={onOpen}
      >
        <span className="flex size-7 items-center justify-center leading-none">
          <Sparkle size={22} weight="regular" />
        </span>
      </Button>
    </ActionTooltip>
  )
}
