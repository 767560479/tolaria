import { CaretDown } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { translate, type AppLocale } from '../lib/i18n'
import type { AiTarget } from '../lib/aiTargets'
import type { AiWorkspaceTargetGroups } from './aiWorkspaceTargetGroups'

interface AiTargetModelPickerProps {
  disabled: boolean
  groups: AiWorkspaceTargetGroups
  locale: AppLocale
  onSelectTarget: (targetId: string) => void
  selectedTarget: AiTarget
  side: 'bottom' | 'top'
}

interface SelectedModelPresentation {
  accessibleLabel: string
  label: string
}

function choiceValue(targetId: string): string {
  return targetId
}

function targetModelChoices(groups: AiWorkspaceTargetGroups): AiTarget[] {
  return [...groups.localModels, ...groups.apiModels]
}

function DirectTargetGroup({ label, targets }: { label: string; targets: AiTarget[] }) {
  if (targets.length === 0) return null
  return (
    <>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      {targets.map((target) => (
        <DropdownMenuRadioItem key={target.id} value={choiceValue(target.id)}>
          <span className="truncate" title={target.label}>{target.label}</span>
        </DropdownMenuRadioItem>
      ))}
    </>
  )
}

function selectedModelPresentation(
  locale: AppLocale,
  selectedTarget: AiTarget,
): SelectedModelPresentation {
  return {
    accessibleLabel: `${translate(locale, 'ai.workspace.targetLabel')}: ${selectedTarget.label}`,
    label: selectedTarget.shortLabel,
  }
}

function AiTargetModelTrigger({
  disabled,
  presentation,
}: {
  disabled: boolean
  presentation: SelectedModelPresentation
}) {
  return (
    <DropdownMenuTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="min-w-0 max-w-full flex-1 !flex-none justify-start gap-1.5 rounded-full px-2 text-[12px] text-muted-foreground hover:text-foreground"
        disabled={disabled}
        aria-label={presentation.accessibleLabel}
        title={presentation.accessibleLabel}
        data-testid="ai-workspace-target-trigger"
      >
        <span className="truncate">{presentation.label}</span>
        <CaretDown size={12} className="shrink-0" />
      </Button>
    </DropdownMenuTrigger>
  )
}

export function AiTargetModelPicker({
  disabled,
  groups,
  locale,
  onSelectTarget,
  selectedTarget,
  side,
}: AiTargetModelPickerProps) {
  const choices = targetModelChoices(groups)
  const presentation = selectedModelPresentation(locale, selectedTarget)
  const selectedValue = choiceValue(selectedTarget.id)

  return (
    <DropdownMenu>
      <AiTargetModelTrigger
        disabled={disabled || choices.length === 0}
        presentation={presentation}
      />
      <DropdownMenuContent
        align="start"
        side={side}
        className="max-w-[min(340px,var(--radix-dropdown-menu-content-available-width))] min-w-[220px]"
      >
        <DropdownMenuRadioGroup value={selectedValue} onValueChange={onSelectTarget}>
          <DirectTargetGroup label={translate(locale, 'ai.workspace.targetLocalModels')} targets={groups.localModels} />
          {groups.localModels.length > 0 && groups.apiModels.length > 0 && <DropdownMenuSeparator />}
          <DirectTargetGroup label={translate(locale, 'ai.workspace.targetApiModels')} targets={groups.apiModels} />
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
