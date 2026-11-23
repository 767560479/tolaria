import { describe, expect, it } from 'vitest'
import {
  formatDatePartsForDisplay,
  formatDateValueForDisplay,
  formatTimestampForDateTimeDisplay,
  normalizeDateDisplayFormat,
} from './dateDisplay'

describe('dateDisplay', () => {
  it('normalizes supported date display formats', () => {
    expect(normalizeDateDisplayFormat(' ISO ')).toBe('iso')
    expect(normalizeDateDisplayFormat('friendly')).toBe('friendly')
    expect(normalizeDateDisplayFormat('long')).toBeNull()
    expect(normalizeDateDisplayFormat(null)).toBeNull()
  })

  it('formats date parts in every supported display style', () => {
    const parts = { year: 2026, month: 5, day: 11 }

    expect(formatDatePartsForDisplay(parts, 'us')).toBe('5/11/2026')
    expect(formatDatePartsForDisplay(parts, 'european')).toBe('11/5/2026')
    expect(formatDatePartsForDisplay(parts, 'friendly')).toBe('May 11, 2026')
    expect(formatDatePartsForDisplay(parts, 'iso')).toBe('2026-05-11')
    expect(formatDatePartsForDisplay(parts)).toBe('2026-05-11')
  })

  it('formats ISO and slash date values without changing non-dates', () => {
    expect(formatDateValueForDisplay('2026-05-11', 'european')).toBe('11/5/2026')
    expect(formatDateValueForDisplay('05/11/2026', 'friendly')).toBe('May 11, 2026')
    expect(formatDateValueForDisplay('next Monday', 'iso')).toBe('next Monday')
  })

  it('formats timestamps with a 24-hour date and time', () => {
    const timestamp = Math.floor(new Date(2026, 4, 11, 14, 35, 8).getTime() / 1000)

    expect(formatTimestampForDateTimeDisplay(timestamp)).toBe('2026-05-11 14:35:08')
  })
})
