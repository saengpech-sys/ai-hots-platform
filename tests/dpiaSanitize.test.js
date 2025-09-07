import { describe, it, expect } from 'vitest'
import { sanitizeDPIAArray } from '@/utils/dpiaSanitize'

describe('sanitizeDPIAArray', () => {
  it('dedupes, trims, limits length & count', () => {
    const input = ['  risk one  ', 'risk one', 'risk two', '', '   ', 123, 'x'.repeat(500)]
    const out = sanitizeDPIAArray(input, { maxItems: 5, maxLen: 10 })
    expect(out).toEqual(['risk one', 'risk two', 'xxxxxxxxxx'])
  })

  it('returns undefined for non-array', () => {
    expect(sanitizeDPIAArray(null)).toBeUndefined()
  })
})
