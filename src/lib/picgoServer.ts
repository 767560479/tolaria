/** PicGo-compatible image host settings helpers. */

export function normalizePicgoServerUrl(value: unknown): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return null
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  return trimmed
}

export function normalizePicgoServerToken(value: unknown): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || null
}

export type ImageUploadDestination = {
  picgoServerUrl?: string | null
  picgoServerToken?: string | null
}

export function imageUploadDestinationFromSettings(settings: {
  picgo_server_url?: string | null
  picgo_server_token?: string | null
} | null | undefined): ImageUploadDestination {
  return {
    picgoServerUrl: normalizePicgoServerUrl(settings?.picgo_server_url),
    picgoServerToken: normalizePicgoServerToken(settings?.picgo_server_token),
  }
}
