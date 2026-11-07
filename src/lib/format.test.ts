import { describe, expect, it } from 'vite-plus/test'
import { formatDateLong, formatNumber } from './format'

describe('file display formatting', () => {
  it('groups bytes and counts', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(1_234_567)).toBe('1,234,567')
  })

  it('formats timestamps in UTC regardless of the runtime time zone', () => {
    const originalTimeZone = process.env.TZ
    try {
      for (const zone of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
        process.env.TZ = zone
        expect(formatDateLong(new Date('2026-11-07T13:26:15.000Z'))).toBe(
          'Nov 7, 2026, 1:26:15 PM UTC',
        )
      }
    } finally {
      if (originalTimeZone === undefined) delete process.env.TZ
      else process.env.TZ = originalTimeZone
    }
  })
})
