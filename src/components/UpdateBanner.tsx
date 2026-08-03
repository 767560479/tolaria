import type { CSSProperties } from 'react'
import { ArrowSquareOut as ExternalLink, ArrowsClockwise as RefreshCw, Download, X } from '@phosphor-icons/react'
import type { UpdateStatus, UpdateActions } from '../hooks/useUpdater'
import { Button } from './ui/button'
import { translate, type AppLocale } from '../lib/i18n'

interface UpdateBannerProps {
  status: UpdateStatus
  actions: UpdateActions
  locale?: AppLocale
}

type VisibleUpdateStatus = Exclude<UpdateStatus, { state: 'idle' } | { state: 'error' }>

function isUpdateBannerVisible(status: UpdateStatus): status is VisibleUpdateStatus {
  return status.state !== 'idle' && status.state !== 'error'
}

const bannerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 12px',
  background: 'var(--accent-blue)',
  borderBottom: 'none',
  fontSize: 13,
  color: 'var(--text-inverse)',
  flexShrink: 0,
} satisfies CSSProperties

const iconStyle = {
  color: 'var(--text-inverse)',
  flexShrink: 0,
} satisfies CSSProperties

const primaryActionStyle = {
  marginLeft: 'auto',
  padding: '3px 10px',
  background: 'var(--text-inverse)',
  color: 'var(--accent-blue)',
  fontSize: 12,
  fontWeight: 500,
} satisfies CSSProperties

const dismissButtonStyle = {
  color: 'var(--text-inverse)',
  display: 'flex',
  padding: 2,
} satisfies CSSProperties

function renderAvailableContent(status: Extract<VisibleUpdateStatus, { state: 'available' }>, actions: UpdateActions, locale: AppLocale) {
  return (
    <>
      <Download size={14} style={iconStyle} />
      <span>
        <strong>Tolaria {status.displayVersion}</strong> {translate(locale, 'update.available')}
      </span>
      <Button
        type="button"
        variant="link"
        size="xs"
        data-testid="update-release-notes"
        onClick={actions.openReleaseNotes}
        style={{ color: 'var(--text-inverse)', padding: 0, height: 'auto' }}
      >
        {translate(locale, 'update.releaseNotes')} <ExternalLink size={11} />
      </Button>
      <Button
        type="button"
        size="xs"
        data-testid="update-now-btn"
        onClick={actions.openDownload}
        style={primaryActionStyle}
      >
        {translate(locale, 'update.downloadOnGitHub')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        data-testid="update-dismiss"
        onClick={actions.dismiss}
        style={dismissButtonStyle}
        aria-label={translate(locale, 'update.dismiss')}
      >
        <X size={14} />
      </Button>
    </>
  )
}

function renderCheckingContent(locale: AppLocale) {
  return (
    <>
      <RefreshCw size={14} style={{ ...iconStyle, animation: 'spin 1s linear infinite' }} />
      <span>{translate(locale, 'update.checking')}</span>
    </>
  )
}

function renderBannerContent(status: VisibleUpdateStatus, actions: UpdateActions, locale: AppLocale) {
  switch (status.state) {
    case 'checking':
      return renderCheckingContent(locale)
    case 'available':
      return renderAvailableContent(status, actions, locale)
  }
}

export function UpdateBanner({ status, actions, locale = 'en' }: UpdateBannerProps) {
  if (!isUpdateBannerVisible(status)) return null

  return <div data-testid="update-banner" style={bannerStyle}>{renderBannerContent(status, actions, locale)}</div>
}
