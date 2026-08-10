export const AUTOGIT_THRESHOLD_MIN_SECONDS = 15
export const AUTOGIT_THRESHOLD_MAX_SECONDS = 3600
export const DEFAULT_AUTOGIT_IDLE_THRESHOLD_SECONDS = 90
export const DEFAULT_AUTOGIT_INACTIVE_THRESHOLD_SECONDS = 30

function clampThresholdSeconds(
  value: number | null | undefined,
  fallback: number,
): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback
  const rounded = Math.round(value)
  if (rounded < AUTOGIT_THRESHOLD_MIN_SECONDS) return AUTOGIT_THRESHOLD_MIN_SECONDS
  if (rounded > AUTOGIT_THRESHOLD_MAX_SECONDS) return AUTOGIT_THRESHOLD_MAX_SECONDS
  return rounded
}

export function sanitizeAutoGitIdleThreshold(value: number | null | undefined): number {
  return clampThresholdSeconds(value, DEFAULT_AUTOGIT_IDLE_THRESHOLD_SECONDS)
}

export function sanitizeAutoGitInactiveThreshold(
  value: number | null | undefined,
  idleThresholdSeconds: number = DEFAULT_AUTOGIT_IDLE_THRESHOLD_SECONDS,
): number {
  const idle = sanitizeAutoGitIdleThreshold(idleThresholdSeconds)
  const inactive = clampThresholdSeconds(value, DEFAULT_AUTOGIT_INACTIVE_THRESHOLD_SECONDS)
  return Math.min(inactive, idle)
}

export function sanitizeAutoGitThresholdPair(params: {
  idle: number | null | undefined
  inactive: number | null | undefined
}): { idle: number; inactive: number } {
  const idle = sanitizeAutoGitIdleThreshold(params.idle)
  return {
    idle,
    inactive: sanitizeAutoGitInactiveThreshold(params.inactive, idle),
  }
}
