import { describe, it, expect } from 'vitest'
import { __test__ } from './reportServiceTestHarness'

// Lightweight unit tests for stats helpers used in reportService (extracted via harness)

describe('reportService stats helpers', () => {
  it('basicStats computes correct aggregates', () => {
    const { basicStats } = __test__
    const stats = basicStats([10, 20, 30, 40])
    expect(stats.avg).toBe(25)
    expect(stats.median).toBe(25)
    expect(Math.round(stats.stdDev * 100) / 100).toBe(11.18) // population std dev
    expect(stats.min).toBe(10)
    expect(stats.max).toBe(40)
  })

  it('basicStats handles empty', () => {
    const { basicStats } = __test__
    const stats = basicStats([])
    expect(stats.avg).toBeNull()
  })
})
