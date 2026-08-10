import { describe, expect, it } from 'vitest'
import {
  AUTOGIT_THRESHOLD_MAX_SECONDS,
  AUTOGIT_THRESHOLD_MIN_SECONDS,
  DEFAULT_AUTOGIT_IDLE_THRESHOLD_SECONDS,
  DEFAULT_AUTOGIT_INACTIVE_THRESHOLD_SECONDS,
  sanitizeAutoGitIdleThreshold,
  sanitizeAutoGitInactiveThreshold,
  sanitizeAutoGitThresholdPair,
} from './autoGitThresholds'

describe('autoGitThresholds', () => {
  it('clamps idle and inactive into the supported range', () => {
    expect(sanitizeAutoGitIdleThreshold(1)).toBe(AUTOGIT_THRESHOLD_MIN_SECONDS)
    expect(sanitizeAutoGitIdleThreshold(99999)).toBe(AUTOGIT_THRESHOLD_MAX_SECONDS)
    expect(sanitizeAutoGitIdleThreshold(null)).toBe(DEFAULT_AUTOGIT_IDLE_THRESHOLD_SECONDS)
    expect(sanitizeAutoGitInactiveThreshold(null)).toBe(DEFAULT_AUTOGIT_INACTIVE_THRESHOLD_SECONDS)
  })

  it('keeps inactive from exceeding idle', () => {
    expect(sanitizeAutoGitThresholdPair({ idle: 20, inactive: 45 })).toEqual({
      idle: 20,
      inactive: 20,
    })
    expect(sanitizeAutoGitThresholdPair({ idle: 120, inactive: 45 })).toEqual({
      idle: 120,
      inactive: 45,
    })
  })

  it('sanitizes inactive against the current idle value', () => {
    expect(sanitizeAutoGitInactiveThreshold(200, 90)).toBe(90)
    expect(sanitizeAutoGitInactiveThreshold(10, 90)).toBe(AUTOGIT_THRESHOLD_MIN_SECONDS)
  })
})
