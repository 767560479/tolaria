import { invoke } from '@tauri-apps/api/core'

export interface AppUpdateMetadata {
  currentVersion: string
  version: string
  date?: string
  body?: string
  htmlUrl: string
}

export const GITHUB_RELEASES_PAGE_URL = 'https://github.com/767560479/tolaria/releases'

export const RESTART_REQUIRED_FOLDER_PICKER_MESSAGE =
  'Tolaria needs a restart before macOS can open another folder picker. Restart the app and try again.'

let restartRequiredAfterUpdate = false

export function markRestartRequiredAfterUpdate(): void {
  restartRequiredAfterUpdate = true
}

export function clearRestartRequiredAfterUpdate(): void {
  restartRequiredAfterUpdate = false
}

export function isRestartRequiredAfterUpdate(): boolean {
  return restartRequiredAfterUpdate
}

export async function checkForAppUpdate(): Promise<AppUpdateMetadata | null> {
  return invoke<AppUpdateMetadata | null>('check_for_app_update')
}
