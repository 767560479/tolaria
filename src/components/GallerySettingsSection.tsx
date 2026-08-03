import { Images } from '@phosphor-icons/react'
import { useId } from 'react'
import type { TranslationKey, TranslationValues } from '../lib/i18n'
import { Input } from './ui/input'
import { SectionHeading, SettingsGroup, SettingsGroupItem } from './SettingsControls'

type Translate = (key: TranslationKey, values?: TranslationValues) => string

interface GallerySettingsSectionProps {
  t: Translate
  picgoServerUrl: string
  setPicgoServerUrl: (value: string) => void
  picgoServerToken: string
  setPicgoServerToken: (value: string) => void
}

export function GallerySettingsSection({
  t,
  picgoServerUrl,
  setPicgoServerUrl,
  picgoServerToken,
  setPicgoServerToken,
}: GallerySettingsSectionProps) {
  const urlId = useId()
  const tokenId = useId()

  return (
    <>
      <SectionHeading
        icon={<Images size={16} aria-hidden="true" />}
        title={t('settings.gallery.title')}
      />
      <p className="mb-3 text-sm text-muted-foreground">{t('settings.gallery.description')}</p>
      <SettingsGroup>
        <SettingsGroupItem testId="settings-gallery-server-url">
          <label htmlFor={urlId} className="mb-1.5 block text-sm font-medium text-foreground">
            {t('settings.gallery.serverUrl')}
          </label>
          <Input
            id={urlId}
            type="url"
            value={picgoServerUrl}
            placeholder={t('settings.gallery.serverUrlPlaceholder')}
            onChange={(event) => setPicgoServerUrl(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t('settings.gallery.serverUrlDescription')}
          </p>
        </SettingsGroupItem>
        <SettingsGroupItem testId="settings-gallery-server-token">
          <label htmlFor={tokenId} className="mb-1.5 block text-sm font-medium text-foreground">
            {t('settings.gallery.serverToken')}
          </label>
          <Input
            id={tokenId}
            type="password"
            value={picgoServerToken}
            placeholder={t('settings.gallery.serverTokenPlaceholder')}
            onChange={(event) => setPicgoServerToken(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t('settings.gallery.serverTokenDescription')}
          </p>
        </SettingsGroupItem>
      </SettingsGroup>
    </>
  )
}
