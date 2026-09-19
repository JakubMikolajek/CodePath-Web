import { describe, expect, it } from 'vitest'

import { buildAiUsageChartPaths, formatCompactNumber, formatRelativeTime } from './dashboard-utils'

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-19T12:00:00.000Z')

  it('formats just-now, minute, and hour boundaries', () => {
    expect(formatRelativeTime('2026-09-19T11:59:01.000Z', now)).toBe('Just now')
    expect(formatRelativeTime('2026-09-19T11:59:00.000Z', now)).toBe('1m ago')
    expect(formatRelativeTime('2026-09-19T11:00:00.000Z', now)).toBe('1h ago')
  })

  it('formats yesterday and day boundaries', () => {
    expect(formatRelativeTime('2026-09-18T12:00:01.000Z', now)).toBe('23h ago')
    expect(formatRelativeTime('2026-09-18T12:00:00.000Z', now)).toBe('Yesterday')
    expect(formatRelativeTime('2026-09-17T12:00:00.000Z', now)).toBe('2d ago')
    expect(formatRelativeTime('2026-09-14T12:00:00.000Z', now)).toBe('5d ago')
  })
})

describe('formatCompactNumber', () => {
  it('keeps values below one thousand unabridged', () => {
    expect(formatCompactNumber(999)).toBe('999')
  })

  it('formats thousands with one decimal place', () => {
    expect(formatCompactNumber(1000)).toBe('1k')
    expect(formatCompactNumber(12_345)).toBe('12.3k')
  })
})

describe('buildAiUsageChartPaths', () => {
  it('renders all-zero data as a flat baseline', () => {
    const paths = buildAiUsageChartPaths([
      { date: '2026-09-13', requests: 0 },
      { date: '2026-09-14', requests: 0 }
    ])

    expect(paths.linePath).toBe('M0 120 L320 120')
    expect(paths.areaPath).not.toContain('NaN')
  })

  it('plots a single different point without invalid coordinates', () => {
    const paths = buildAiUsageChartPaths([
      { date: '2026-09-13', requests: 0 },
      { date: '2026-09-14', requests: 10 },
      { date: '2026-09-15', requests: 0 }
    ])

    expect(paths.linePath).toBe('M0 120 C80 120 80 12 160 12 C240 12 240 120 320 120')
    expect(paths.areaPath).not.toContain('NaN')
  })
})
