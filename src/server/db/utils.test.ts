import { describe, expect, it, vi } from 'vite-plus/test'
import { takeUniqueOrNull } from './utils'

vi.mock('@/server/db', () => ({ db: {} }))

describe('takeUniqueOrNull', () => {
  it('returns null for an empty result', () => {
    expect(takeUniqueOrNull([])).toBeNull()
  })

  it('returns the first row without checking uniqueness', () => {
    const first = { id: 'first' }
    expect(takeUniqueOrNull([first, { id: 'second' }])).toBe(first)
  })
})
